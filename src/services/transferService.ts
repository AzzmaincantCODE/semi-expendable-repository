import { supabase, handleSupabaseResponse, createPaginationParams } from '../lib/supabase';

export interface TransferItem {
    id: string;
    transferId: string;
    propertyNumber: string;
    description: string;
    quantity: number;
    condition: string;
    // Others matching DB if needed
}

export interface PropertyTransfer {
    id: string;
    transferNumber: string;
    fromDepartment: string;
    toDepartment: string;
    transferType: string;
    status: string;
    requestedBy: string; // UUID
    dateRequested: string;
    reason: string;
    remarks: string;

    // New columns
    transferTypeOthers?: string;
    fromEntityName?: string;
    fromFundCluster?: string;
    toEntityName?: string;
    toFundCluster?: string;
    icsNumber?: string;
    icsDate?: string;

    items?: TransferItem[];
}

export const transferService = {
    // Get all transfers
    async getAll(filters: {
        page?: number;
        limit?: number;
        status?: string;
    } = {}) {
        const { page = 1, limit = 50, status } = filters;
        const { from, to } = createPaginationParams(page, limit);

        let query = supabase
            .from('property_transfers')
            .select('*', { count: 'exact' })
            .range(from, to);

        if (status) query = query.eq('status', status);

        const { data, error, count } = await query.order('date_requested', { ascending: false });
        return {
            data: data || [],
            pagination: {
                page,
                limit,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / limit)
            },
            success: !error,
            error: error?.message || null
        };
    },

    // Get single transfer
    async getById(id: string) {
        const { data, error } = await supabase
            .from('property_transfers')
            .select(`
        *,
        items:transfer_items(*)
      `)
            .eq('id', id)
            .single();

        return {
            data,
            error: error?.message || null,
            success: !error
        };
    },

    // Create transfer
    async create(transfer: Omit<PropertyTransfer, 'id' | 'items'>) {
        const { data, error } = await supabase
            .from('property_transfers')
            .insert({
                transfer_number: transfer.transferNumber,
                from_department: transfer.fromDepartment,
                to_department: transfer.toDepartment,
                transfer_type: transfer.transferType,
                status: transfer.status,
                requested_by: transfer.requestedBy,
                date_requested: transfer.dateRequested,
                reason: transfer.reason,
                remarks: transfer.remarks,
                transfer_type_others: transfer.transferTypeOthers,
                from_entity_name: "PROVINCIAL GOVERNMENT OF APAYAO",
                from_fund_cluster: transfer.fromFundCluster,
                to_entity_name: "PROVINCIAL GOVERNMENT OF APAYAO",
                to_fund_cluster: transfer.toFundCluster,
                ics_number: transfer.icsNumber,
                ics_date: transfer.icsDate
            })
            .select()
            .single();

        return { data, error, success: !error };
    },

    // Add item
    async addItem(transferId: string, item: Omit<TransferItem, 'id' | 'transferId'>) {
        const { data, error } = await supabase
            .from('transfer_items')
            .insert({
                transfer_id: transferId,
                property_number: item.propertyNumber,
                description: item.description,
                quantity: item.quantity,
                condition: item.condition
            })
            .select()
            .single();

        return {
            data,
            error: error?.message || null,
            success: !error
        };
    }
};
