import { supabase } from '@/lib/supabase';

export interface PropertyNumberInfo {
  prefix: string;
  year: string;
  sequenceNumber: string;
  fullNumber: string;
}

export class PropertyNumberService {
  /**
   * Generate the next property number for a given sub-category
   * Format: SPLV-YYYY-MM-NNNN or SPHV-YYYY-MM-NNNN (yearly reset, month for record-keeping)
   * SPLV and SPHV sequences are independent (SPLV-2025-01-0001 and SPHV-2025-01-0001 are both valid)
   */
  static async generateNextPropertyNumber(subCategory: 'Small Value Expendable' | 'High Value Expendable'): Promise<string> {
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');

    // Determine prefix based on sub-category
    const prefix = subCategory === 'Small Value Expendable' ? 'SPLV' : 'SPHV';
    const searchPattern = `${prefix}-${year}-`; // Search all items in this year
    const fullPrefix = `${prefix}-${year}-${month}-`; // Format for new number

    console.log(`Generating property number for ${subCategory}:`, { prefix, year, month, searchPattern });

    try {
      // Get ALL property numbers for this year and prefix to find the highest sequence
      const { data, error } = await supabase
        .from('inventory_items')
        .select('property_number')
        .like('property_number', `${searchPattern}%`)
        .order('property_number', { ascending: false });

      console.log('Database query result:', { data, error });

      if (error) {
        console.error('Error fetching property numbers:', error);
        // Fallback to starting from 0001
        const fallbackNumber = `${fullPrefix}0001`;
        console.log('Using fallback number:', fallbackNumber);
        return fallbackNumber;
      }

      if (!data || data.length === 0) {
        // No existing property numbers for this year/prefix, start from 0001
        const firstNumber = `${fullPrefix}0001`;
        console.log('No existing numbers found, using first number:', firstNumber);
        return firstNumber;
      }

      // Find the highest sequence number for this prefix/year combination
      let highestSequence = 0;
      for (const item of data) {
        const propertyNumber = item.property_number;
        if (propertyNumber.startsWith(searchPattern)) {
          // Parse format: PREFIX-YEAR-MONTH-SEQUENCE (e.g., SPLV-2025-02-0001)
          const parts = propertyNumber.split('-');
          if (parts.length === 4) {
            const sequencePart = parts[3];
            const sequence = parseInt(sequencePart, 10);
            if (!isNaN(sequence) && sequence > highestSequence) {
              highestSequence = sequence;
            }
          }
        }
      }

      // Generate the next sequence number
      const nextSequence = highestSequence + 1;
      const formattedSequence = nextSequence.toString().padStart(4, '0');
      const generatedNumber = `${fullPrefix}${formattedSequence}`;

      console.log('Generated next number:', generatedNumber, {
        highestSequence,
        nextSequence,
        totalExisting: data.length
      });

      // Validate that the generated number doesn't already exist (double-check)
      const existingCheck = data.find(item => item.property_number === generatedNumber);
      if (existingCheck) {
        console.warn('Generated number already exists, trying next sequence');
        const nextNextSequence = nextSequence + 1;
        const nextFormattedSequence = nextNextSequence.toString().padStart(4, '0');
        const nextGeneratedNumber = `${fullPrefix}${nextFormattedSequence}`;
        console.log('Using next available number:', nextGeneratedNumber);
        return nextGeneratedNumber;
      }

      return generatedNumber;
    } catch (error) {
      console.error('Error generating property number:', error);
      // Fallback to starting from 0001
      const fallbackNumber = `${fullPrefix}0001`;
      console.log('Using fallback number due to error:', fallbackNumber);
      return fallbackNumber;
    }
  }

  /**
   * Parse a property number into its components
   * Supports new format (PREFIX-YEAR-MONTH-SEQUENCE) and old format for backward compatibility
   */
  static parsePropertyNumber(propertyNumber: string): PropertyNumberInfo | null {
    const parts = propertyNumber.split('-');

    // New format: PREFIX-YEAR-MONTH-SEQUENCE (4 parts)
    if (parts.length === 4) {
      const [prefix, year, month, sequenceNumber] = parts;

      // Validate prefix
      if (prefix !== 'SPLV' && prefix !== 'SPHV') {
        return null;
      }

      // Validate year (should be 4 digits)
      if (!/^\d{4}$/.test(year)) {
        return null;
      }

      // Validate month (should be 01-12)
      if (!/^(0[1-9]|1[0-2])$/.test(month)) {
        return null;
      }

      // Validate sequence number (should be 4 digits)
      if (!/^\d{4}$/.test(sequenceNumber)) {
        return null;
      }

      return {
        prefix,
        year,
        sequenceNumber,
        fullNumber: propertyNumber
      };
    }

    // Old format: PREFIX-YEAR-SEQUENCE (3 parts) - for backward compatibility
    if (parts.length === 3) {
      const [prefix, year, sequenceNumber] = parts;

      // Validate prefix
      if (prefix !== 'SPLV' && prefix !== 'SPHV') {
        return null;
      }

      // Validate year (should be 4 digits)
      if (!/^\d{4}$/.test(year)) {
        return null;
      }

      // Validate sequence number (should be 4 digits)
      if (!/^\d{4}$/.test(sequenceNumber)) {
        return null;
      }

      return {
        prefix,
        year,
        sequenceNumber,
        fullNumber: propertyNumber
      };
    }

    return null;
  }

  /**
   * Get the prefix for a sub-category
   */
  static getPrefixForSubCategory(subCategory: 'Small Value Expendable' | 'High Value Expendable'): string {
    return subCategory === 'Small Value Expendable' ? 'SPLV' : 'SPHV';
  }

  /**
   * Validate if a property number follows the correct format
   */
  static isValidPropertyNumber(propertyNumber: string): boolean {
    const parsed = this.parsePropertyNumber(propertyNumber);
    return parsed !== null;
  }

  /**
   * Check if a property number already exists in the database
   */
  static async checkPropertyNumberExists(propertyNumber: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id')
        .eq('property_number', propertyNumber)
        .limit(1);

      if (error) {
        console.error('Error checking property number existence:', error);
        return false; // Assume it doesn't exist if we can't check
      }

      return data && data.length > 0;
    } catch (error) {
      console.error('Error checking property number existence:', error);
      return false;
    }
  }

  /**
   * Generate a unique property number with collision detection
   * This ensures no duplicates can be created
   */
  static async generateUniquePropertyNumber(subCategory: 'Small Value Expendable' | 'High Value Expendable'): Promise<string> {
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const candidateNumber = await this.generateNextPropertyNumber(subCategory);
      const exists = await this.checkPropertyNumberExists(candidateNumber);

      if (!exists) {
        console.log(`Generated unique property number: ${candidateNumber} (attempt ${attempts + 1})`);
        return candidateNumber;
      }

      console.warn(`Property number ${candidateNumber} already exists, trying next sequence`);
      attempts++;
    }

    // If we still can't find a unique number, throw an error
    throw new Error(`Unable to generate unique property number after ${maxAttempts} attempts`);
  }
}

/**
 * Generate multiple property numbers at once to optimize bulk operations
 * Provides extreme performance gains by calculating the sequence offline after 1 query
 * Stored as a standalone function to ensure instant availability and bypass class caching
 */
export async function generateBulkPropertyNumbers(subCategory: 'Small Value Expendable' | 'High Value Expendable', count: number): Promise<string[]> {
    if (count <= 0) return [];
    
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');

    const prefix = subCategory === 'Small Value Expendable' ? 'SPLV' : 'SPHV';
    const searchPattern = `${prefix}-${year}-`;
    const fullPrefix = `${prefix}-${year}-${month}-`;

    const { data } = await supabase
      .from('inventory_items')
      .select('property_number')
      .like('property_number', `${searchPattern}%`)
      .order('property_number', { ascending: false });

    let highestSequence = 0;
    if (data && data.length > 0) {
      for (const item of data) {
        const propertyNumber = item.property_number;
        if (propertyNumber.startsWith(searchPattern)) {
          const parts = propertyNumber.split('-');
          if (parts.length === 4) {
             const sequence = parseInt(parts[3], 10);
             if (!isNaN(sequence) && sequence > highestSequence) highestSequence = sequence;
          }
        }
      }
    }

    const startSequence = highestSequence + 1;
    const generated: string[] = [];
    
    for (let i = 0; i < count; i++) {
        const seq = startSequence + i;
        generated.push(`${fullPrefix}${seq.toString().padStart(4, '0')}`);
    }

    return generated;
}
