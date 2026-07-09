import { supabase } from '@/lib/supabase';

export interface SearchResult {
  type: 'inventory' | 'custodian' | 'transfer' | 'ics' | 'property-card';
  id: string;
  title: string;
  subtitle?: string;
  metadata?: Record<string, any>;
}

export interface GlobalSearchResults {
  inventory: SearchResult[];
  custodians: SearchResult[];
  transfers: SearchResult[];
  icsSlips: SearchResult[];
  propertyCards: SearchResult[];
}

export const globalSearchService = {
  async search(query: string, limit: number = 10): Promise<GlobalSearchResults> {
    const searchTerm = query.trim();
    if (!searchTerm) {
      return {
        inventory: [],
        custodians: [],
        transfers: [],
        icsSlips: [],
        propertyCards: [],
      };
    }

    // Search across all entities in parallel
    const [inventoryResults, custodianResults, transferResults, icsResults, propertyCardResults] = await Promise.all([
      this.searchInventory(searchTerm, limit),
      this.searchCustodians(searchTerm, limit),
      this.searchTransfers(searchTerm, limit),
      this.searchIcsSlips(searchTerm, limit),
      this.searchPropertyCards(searchTerm, limit),
    ]);

    return {
      inventory: inventoryResults,
      custodians: custodianResults,
      transfers: transferResults,
      icsSlips: icsResults,
      propertyCards: propertyCardResults,
    };
  },

  async searchInventory(query: string, limit: number): Promise<SearchResult[]> {
    try {
      // Search by property number, description, brand, model, serial number, or subcategory
      // Note: date_acquired is excluded from ilike search as dates need to be cast to text
      // For date searches, we'll search by year/month in the format (e.g., "2025" or "2025-10")
      const escapedQuery = query.replace(/'/g, "''"); // Escape single quotes for SQL
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, property_number, description, brand, model, serial_number, date_acquired, custodian, sub_category')
        .or(`property_number.ilike.%${escapedQuery}%,description.ilike.%${escapedQuery}%,brand.ilike.%${escapedQuery}%,model.ilike.%${escapedQuery}%,serial_number.ilike.%${escapedQuery}%,sub_category.ilike.%${escapedQuery}%`)
        .limit(limit)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter by date if query looks like a date (contains numbers that could be a year)
      let filteredData = data || [];
      if (/^\d{4}/.test(query) || /^\d{4}-\d{2}/.test(query)) {
        // If query starts with YYYY or YYYY-MM, also filter by date
        filteredData = filteredData.filter(item => {
          if (!item.date_acquired) return true;
          const dateStr = item.date_acquired.toString();
          return dateStr.includes(query);
        });
      }

      return filteredData.map(item => ({
        type: 'inventory' as const,
        id: item.id,
        title: item.property_number,
        subtitle: item.description || `${item.brand || ''} ${item.model || ''}`.trim() || 'No description',
        metadata: {
          custodian: item.custodian,
          subCategory: item.sub_category,
          dateAcquired: item.date_acquired,
        },
      }));
    } catch (error) {
      console.error('Error searching inventory:', error);
      return [];
    }
  },

  async searchCustodians(query: string, limit: number): Promise<SearchResult[]> {
    try {
      const escapedQuery = query.replace(/'/g, "''"); // Escape single quotes for SQL
      const { data, error } = await supabase
        .from('custodians')
        .select('id, name, custodian_no, position')
        .or(`name.ilike.%${escapedQuery}%,custodian_no.ilike.%${escapedQuery}%,position.ilike.%${escapedQuery}%`)
        .eq('is_active', true)
        .limit(limit)
        .order('name', { ascending: true });

      if (error) throw error;

      return (data || []).map(custodian => ({
        type: 'custodian' as const,
        id: custodian.id,
        title: custodian.name,
        subtitle: custodian.position || custodian.custodian_no,
        metadata: {
          custodianNo: custodian.custodian_no,
          position: custodian.position,
        },
      }));
    } catch (error) {
      console.error('Error searching custodians:', error);
      return [];
    }
  },

  async searchTransfers(query: string, limit: number): Promise<SearchResult[]> {
    try {
      // Search by transfer number (ITR), from/to department, or status
      // Note: date_requested is excluded from ilike search as dates need to be cast to text
      const escapedQuery = query.replace(/'/g, "''"); // Escape single quotes for SQL
      const { data, error } = await supabase
        .from('property_transfers')
        .select('id, transfer_number, from_department, to_department, status, date_requested')
        .or(`transfer_number.ilike.%${escapedQuery}%,from_department.ilike.%${escapedQuery}%,to_department.ilike.%${escapedQuery}%,status.ilike.%${escapedQuery}%`)
        .limit(limit)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter by date if query looks like a date
      let filteredData = data || [];
      if (/^\d{4}/.test(query) || /^\d{4}-\d{2}/.test(query)) {
        filteredData = filteredData.filter(item => {
          if (!item.date_requested) return true;
          const dateStr = item.date_requested.toString();
          return dateStr.includes(query);
        });
      }

      return filteredData.map(transfer => ({
        type: 'transfer' as const,
        id: transfer.id,
        title: transfer.transfer_number || 'Transfer',
        subtitle: `${transfer.from_department} → ${transfer.to_department}`,
        metadata: {
          status: transfer.status,
          dateRequested: transfer.date_requested,
        },
      }));
    } catch (error) {
      console.error('Error searching transfers:', error);
      return [];
    }
  },

  async searchIcsSlips(query: string, limit: number): Promise<SearchResult[]> {
    try {
      // Search by ICS slip number, custodian name, or designation
      // Note: date_issued is excluded from ilike search as dates need to be cast to text
      const escapedQuery = query.replace(/'/g, "''"); // Escape single quotes for SQL
      const { data, error } = await supabase
        .from('custodian_slips')
        .select('id, slip_number, custodian_name, designation, date_issued')
        .or(`slip_number.ilike.%${escapedQuery}%,custodian_name.ilike.%${escapedQuery}%,designation.ilike.%${escapedQuery}%`)
        .limit(limit)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter by date if query looks like a date
      let filteredData = data || [];
      if (/^\d{4}/.test(query) || /^\d{4}-\d{2}/.test(query)) {
        filteredData = filteredData.filter(item => {
          if (!item.date_issued) return true;
          const dateStr = item.date_issued.toString();
          return dateStr.includes(query);
        });
      }

      return filteredData.map(slip => ({
        type: 'ics' as const,
        id: slip.id,
        title: slip.slip_number || 'ICS Slip',
        subtitle: `${slip.custodian_name}${slip.designation ? ` (${slip.designation})` : ''}`,
        metadata: {
          custodianName: slip.custodian_name,
          designation: slip.designation,
          dateIssued: slip.date_issued,
        },
      }));
    } catch (error) {
      console.error('Error searching ICS slips:', error);
      return [];
    }
  },

  async searchPropertyCards(query: string, limit: number): Promise<SearchResult[]> {
    try {
      // Search by property number, description, or entity name
      const escapedQuery = query.replace(/'/g, "''"); // Escape single quotes for SQL
      const { data, error } = await supabase
        .from('property_cards')
        .select('id, property_number, description, entity_name, semi_expendable_property')
        .or(`property_number.ilike.%${escapedQuery}%,description.ilike.%${escapedQuery}%,entity_name.ilike.%${escapedQuery}%,semi_expendable_property.ilike.%${escapedQuery}%`)
        .limit(limit)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(card => ({
        type: 'property-card' as const,
        id: card.id,
        title: card.property_number || 'Property Card',
        subtitle: card.description || card.semi_expendable_property || 'No description',
        metadata: {
          entityName: card.entity_name,
        },
      }));
    } catch (error) {
      console.error('Error searching property cards:', error);
      return [];
    }
  },
};

