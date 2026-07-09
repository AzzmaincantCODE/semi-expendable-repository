// =====================================================
// Return Receipt Service - Annex A.6 (RRSP)
// =====================================================

import { supabase } from '@/lib/supabase';

export interface ReturnReceiptItem {
    description: string;
    quantity: number;
    ics_no: string;
    end_user: string;
    remarks?: string;
}

export interface ReturnReceipt {
    id: string;
    entity_name: string;
    fund_cluster?: string;
    rrsp_number: string;
    rrsp_date: string;
    items: ReturnReceiptItem[];
    returned_by_name: string;
    returned_by_date?: string;
    received_by_name: string;
    received_by_position?: string;
    received_by_date?: string;
    created_at?: string;
    updated_at?: string;
}

export const returnReceiptService = {
    /**
     * Create a new return receipt (RRSP)
     * Automatically updates the property registry on creation
     */
    async create(data: Omit<ReturnReceipt, 'id' | 'rrsp_number' | 'created_at' | 'updated_at'>): Promise<ReturnReceipt> {
        const { data: receipt, error } = await supabase
            .from('return_receipts')
            .insert({
                entity_name: "PROVINCIAL GOVERNMENT OF APAYAO",
                fund_cluster: data.fund_cluster,
                rrsp_date: data.rrsp_date,
                items: data.items,
                returned_by_name: data.returned_by_name,
                returned_by_date: data.returned_by_date,
                received_by_name: data.received_by_name,
                received_by_position: data.received_by_position,
                received_by_date: data.received_by_date
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating return receipt:', error);
            throw new Error(`Failed to create return receipt: ${error.message}`);
        }

        // Update property registry for each returned item
        await this.updateRegistryOnReturn(receipt);

        return receipt;
    },

    /**
     * Update property registry when items are returned
     * @private
     */
    async updateRegistryOnReturn(receipt: ReturnReceipt) {
        for (const item of receipt.items) {
            try {
                const { error } = await supabase.rpc('update_registry_on_return', {
                    p_rrsp_number: receipt.rrsp_number,
                    p_date: receipt.rrsp_date,
                    p_property_no: item.ics_no, // Using ICS no to track back to property
                    p_quantity: item.quantity,
                    p_office_officer: item.end_user
                });

                if (error) {
                    console.error(`Error updating registry for item ${item.ics_no}:`, error);
                }
            } catch (err) {
                console.error('Registry update failed:', err);
            }
        }
    },

    /**
     * Get all return receipts
     */
    async getAll(): Promise<ReturnReceipt[]> {
        const { data, error } = await supabase
            .from('return_receipts')
            .select('*')
            .order('rrsp_date', { ascending: false });

        if (error) {
            console.error('Error fetching return receipts:', error);
            throw new Error(`Failed to fetch return receipts: ${error.message}`);
        }

        return data || [];
    },

    /**
     * Get return receipt by RRSP number
     */
    async getByNumber(rrspNumber: string): Promise<ReturnReceipt | null> {
        const { data, error } = await supabase
            .from('return_receipts')
            .select('*')
            .eq('rrsp_number', rrspNumber)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null; // Not found
            }
            console.error('Error fetching return receipt:', error);
            throw new Error(`Failed to fetch return receipt: ${error.message}`);
        }

        return data;
    },

    /**
     * Get return receipts within date range
     */
    async getByDateRange(startDate: string, endDate: string): Promise<ReturnReceipt[]> {
        const { data, error } = await supabase
            .from('return_receipts')
            .select('*')
            .gte('rrsp_date', startDate)
            .lte('rrsp_date', endDate)
            .order('rrsp_date', { ascending: false });

        if (error) {
            console.error('Error fetching return receipts by date range:', error);
            throw new Error(`Failed to fetch return receipts: ${error.message}`);
        }

        return data || [];
    },

    /**
     * Update an existing return receipt
     */
    async update(id: string, data: Partial<ReturnReceipt>): Promise<ReturnReceipt> {
        const { data: receipt, error } = await supabase
            .from('return_receipts')
            .update({ ...data, entity_name: "PROVINCIAL GOVERNMENT OF APAYAO" })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating return receipt:', error);
            throw new Error(`Failed to update return receipt: ${error.message}`);
        }

        return receipt;
    },

    /**
     * Delete return receipt (soft delete recommended)
     */
    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('return_receipts')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting return receipt:', error);
            throw new Error(`Failed to delete return receipt: ${error.message}`);
        }
    }
};
