// =====================================================
// Property Registry Service - Annex A.4 (RegSPI)
// =====================================================

import { supabase } from '@/lib/supabase';

export interface RegistryEntry {
    id: string;
    date: string;
    reference_type: 'ICS' | 'RRSP';
    reference_number: string;
    semi_expendable_property_no: string;
    item_description: string;
    estimated_useful_life?: number;
    issued_qty: number;
    issued_office_officer?: string;
    returned_qty: number;
    returned_office_officer?: string;
    reissued_qty: number;
    reissued_office_officer?: string;
    disposed_qty: number;
    disposed_office_officer?: string;
    balance_qty: number; // Auto-calculated
    amount?: number;
    remarks?: string;
    created_at?: string;
    updated_at?: string;
}

export const propertyRegistryService = {
    /**
     * Get all registry entries for a specific property number
     */
    async getByPropertyNumber(propertyNo: string): Promise<RegistryEntry[]> {
        const { data, error } = await supabase
            .from('property_registry')
            .select('*')
            .eq('semi_expendable_property_no', propertyNo)
            .order('date', { ascending: false });

        if (error) {
            console.error('Error fetching registry entries:', error);
            throw new Error(`Failed to fetch registry entries: ${error.message}`);
        }

        return data || [];
    },

    /**
     * Get all registry entries with optional filters
     */
    async getAll(params?: {
        startDate?: string;
        endDate?: string;
        referenceType?: 'ICS' | 'RRSP';
        hasBalance?: boolean;
    }): Promise<RegistryEntry[]> {
        let query = supabase.from('property_registry').select('*');

        if (params?.startDate) {
            query = query.gte('date', params.startDate);
        }
        if (params?.endDate) {
            query = query.lte('date', params.endDate);
        }
        if (params?.referenceType) {
            query = query.eq('reference_type', params.referenceType);
        }
        if (params?.hasBalance) {
            query = query.gt('balance_qty', 0);
        }

        const { data, error } = await query.order('date', { ascending: false });

        if (error) {
            console.error('Error fetching registry entries:', error);
            throw new Error(`Failed to fetch registry entries: ${error.message}`);
        }

        return data || [];
    },

    /**
     * Create registry entry from ICS (called automatically when ICS is created)
     */
    async createFromICS(params: {
        ics_number: string;
        date: string;
        property_no: string;
        description: string;
        quantity: number;
        office_officer: string;
        amount: number;
        estimated_life?: number;
    }): Promise<string> {
        const { data, error } = await supabase.rpc('create_registry_entry_from_ics', {
            p_ics_number: params.ics_number,
            p_date: params.date,
            p_property_no: params.property_no,
            p_description: params.description,
            p_quantity: params.quantity,
            p_office_officer: params.office_officer,
            p_amount: params.amount,
            p_estimated_life: params.estimated_life
        });

        if (error) {
            console.error('Error creating registry entry from ICS:', error);
            throw new Error(`Failed to create registry entry: ${error.message}`);
        }

        return data; // Returns UUID of created entry
    },

    /**
     * Get summary statistics for property registry
     */
    async getSummary(): Promise<{
        total_issued: number;
        total_returned: number;
        total_disposed: number;
        current_balance: number;
    }> {
        const { data, error } = await supabase
            .from('property_registry')
            .select('issued_qty, returned_qty, disposed_qty, balance_qty');

        if (error) {
            console.error('Error fetching registry summary:', error);
            throw new Error(`Failed to fetch summary: ${error.message}`);
        }

        const summary = (data || []).reduce((acc, entry) => ({
            total_issued: acc.total_issued + (entry.issued_qty || 0),
            total_returned: acc.total_returned + (entry.returned_qty || 0),
            total_disposed: acc.total_disposed + (entry.disposed_qty || 0),
            current_balance: acc.current_balance + (entry.balance_qty || 0)
        }), {
            total_issued: 0,
            total_returned: 0,
            total_disposed: 0,
            current_balance: 0
        });

        return summary;
    },

    /**
     * Get registry entries by reference (ICS or RRSP number)
     */
    async getByReference(referenceType: 'ICS' | 'RRSP', referenceNumber: string): Promise<RegistryEntry[]> {
        const { data, error } = await supabase
            .from('property_registry')
            .select('*')
            .eq('reference_type', referenceType)
            .eq('reference_number', referenceNumber)
            .order('date', { ascending: false });

        if (error) {
            console.error('Error fetching registry by reference:', error);
            throw new Error(`Failed to fetch registry entries: ${error.message}`);
        }

        return data || [];
    },

    /**
     * Update registry entry (manual adjustments)
     */
    async update(id: string, data: Partial<RegistryEntry>): Promise<RegistryEntry> {
        const { data: entry, error } = await supabase
            .from('property_registry')
            .update(data)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating registry entry:', error);
            throw new Error(`Failed to update registry entry: ${error.message}`);
        }

        return entry;
    }
};
