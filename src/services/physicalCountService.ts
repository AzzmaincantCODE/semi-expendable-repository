import { supabase, handleSupabaseResponse, createPaginationParams } from '../lib/supabase';

export interface PhysicalCountItem {
    id: string;
    countId: string;
    propertyNumber: string;
    description: string;
    expectedQuantity: number;
    actualQuantity: number;
    variance: number; // Qty variance
    condition: string;
    location: string;
    remarks: string;

    // New columns
    unitCost?: number;
    varianceValue?: number;
}

export interface PhysicalCountReport {
    id: string;
    countNumber: string;
    department: string;
    countDate: string;
    countType: string;
    status: string;
    conductedBy: string[];
    witnessedBy: string; // UUID of user
    approvedBy: string; // UUID of user
    totalExpected: number;
    totalActual: number;
    totalVariance: number;
    remarks: string;

    // New columns
    fundCluster?: string;
    custodian?: string;
    custodianDesignation?: string;
    custodianStation?: string;
    dateOfAssumption?: string;
    coaRepresentative?: string;

    items?: PhysicalCountItem[];
}

export const physicalCountService = {
    // Get all counts
    async getAll(filters: {
        page?: number;
        limit?: number;
        department?: string;
        status?: string;
    } = {}) {
        const { page = 1, limit = 50, department, status } = filters;
        const { from, to } = createPaginationParams(page, limit);

        let query = supabase
            .from('physical_counts')
            .select('*', { count: 'exact' })
            .range(from, to);

        if (department) query = query.eq('department', department);
        if (status) query = query.eq('status', status);

        const { data, error, count } = await query.order('count_date', { ascending: false });

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

    // Get single count with items
    async getById(id: string) {
        const { data, error } = await supabase
            .from('physical_counts')
            .select(`
        *,
        items:physical_count_items(*)
      `)
            .eq('id', id)
            .single();

        // Map DB columns to camelCase if needed, but Supabase usually returns snake_case by default
        // We rely on the caller or a transforming hook to handle snake_case -> camelCase if strictly enforced.
        // However, usually it's easier to just use the returned shape.
        // For now, let's assume we return the raw data and let the component adapt or we map it here.
        // Let's stick to raw generic return to be safe, or typed if we had strict types.

        return {
            data,
            error: error?.message || null,
            success: !error
        };
    },

    // Create count
    async create(count: Omit<PhysicalCountReport, 'id' | 'items'>) {
        const { data, error } = await supabase
            .from('physical_counts')
            .insert({
                count_number: count.countNumber,
                department: count.department,
                count_date: count.countDate,
                count_type: count.countType,
                status: count.status,
                conducted_by: count.conductedBy,
                witnessed_by: count.witnessedBy, // UUID
                approved_by: count.approvedBy,   // UUID
                remarks: count.remarks,
                fund_cluster: count.fundCluster,
                custodian: count.custodian,
                custodian_designation: count.custodianDesignation,
                custodian_station: count.custodianStation,
                date_of_assumption: count.dateOfAssumption,
                coa_representative: count.coaRepresentative
            })
            .select()
            .single();

        return { data, error, success: !error };
    },

    // Add Item
    async addItem(countId: string, item: Omit<PhysicalCountItem, 'id' | 'countId'>) {
        const { data, error } = await supabase
            .from('physical_count_items')
            .insert({
                count_id: countId,
                property_number: item.propertyNumber,
                description: item.description,
                expected_quantity: item.expectedQuantity,
                actual_quantity: item.actualQuantity,
                variance: item.variance,
                condition: item.condition,
                location: item.location,
                remarks: item.remarks,
                unit_cost: item.unitCost,
                variance_value: item.varianceValue
            })
            .select()
            .single();

        return { data, error, success: !error };
    }
};
