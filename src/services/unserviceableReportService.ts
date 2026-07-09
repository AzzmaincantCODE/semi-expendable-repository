import { supabase, handleSupabaseResponse, createPaginationParams } from '../lib/supabase';

export interface UnserviceableItem {
    id: string;
    reportId: string;
    propertyNumber: string;
    description: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    dateAcquired: string;
    condition: string;
    defects: string;
    recommendation: 'Repair' | 'Condemn' | 'Donate' | 'Sell';
    estimatedRepairCost?: number;

    // New columns for Annex A.10
    accumulatedDepreciation?: number;
    accumulatedImpairment?: number;
    carryingAmount?: number;
    disposalMode?: 'Sale' | 'Transfer' | 'Destruction' | 'Others';
    appraisedValue?: number;
    orNumber?: string;
    amount?: number;
}

export interface UnserviceableReport {
    id: string;
    reportNumber: string;
    reportDate: string;
    department: string;
    inspectedBy: string[];
    reviewPeriod: string;
    totalValue: number;

    // New columns for Annex A.10
    fundCluster?: string;
    accountableOfficer?: string;
    designation?: string;
    station?: string;
    witness?: string;

    items?: UnserviceableItem[];
}

export const unserviceableReportService = {
    // Get all reports
    async getAll(filters: {
        page?: number;
        limit?: number;
        department?: string;
        search?: string;
    } = {}) {
        const { page = 1, limit = 50, department, search } = filters;
        const { from, to } = createPaginationParams(page, limit);

        let query = supabase
            .from('unserviceable_reports')
            .select('*', { count: 'exact' })
            .range(from, to);

        if (department) query = query.eq('department', department);
        if (search) {
            query = query.or(`report_number.ilike.%${search}%,department.ilike.%${search}%`);
        }

        const { data, error, count } = await query.order('report_date', { ascending: false });

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

    // Get single report with items
    async getById(id: string) {
        const { data, error } = await supabase
            .from('unserviceable_reports')
            .select(`
        *,
        items:unserviceable_report_items(*)
      `)
            .eq('id', id)
            .single();

        return { data, error, success: !error };
    },

    // Create report
    async create(report: Omit<UnserviceableReport, 'id' | 'items'>) {
        const { data, error } = await supabase
            .from('unserviceable_reports')
            .insert({
                report_number: report.reportNumber,
                report_date: report.reportDate,
                department: report.department,
                inspected_by: report.inspectedBy,
                review_period: report.reviewPeriod,
                total_value: report.totalValue,
                fund_cluster: report.fundCluster,
                accountable_officer: report.accountableOfficer,
                designation: report.designation,
                station: report.station,
                witness: report.witness
            })
            .select()
            .single();

        return { data, error, success: !error };
    },

    // Update report
    async update(id: string, updates: Partial<UnserviceableReport>) {
        const updateHeader: any = {};
        if (updates.reportNumber) updateHeader.report_number = updates.reportNumber;
        if (updates.reportDate) updateHeader.report_date = updates.reportDate;
        if (updates.department) updateHeader.department = updates.department;
        if (updates.inspectedBy) updateHeader.inspected_by = updates.inspectedBy;
        if (updates.reviewPeriod) updateHeader.review_period = updates.reviewPeriod;
        if (updates.totalValue !== undefined) updateHeader.total_value = updates.totalValue;
        if (updates.fundCluster) updateHeader.fund_cluster = updates.fundCluster;
        if (updates.accountableOfficer) updateHeader.accountable_officer = updates.accountableOfficer;
        if (updates.designation) updateHeader.designation = updates.designation;
        if (updates.station) updateHeader.station = updates.station;
        if (updates.witness) updateHeader.witness = updates.witness;

        const { data, error } = await supabase
            .from('unserviceable_reports')
            .update(updateHeader)
            .eq('id', id)
            .select()
            .single();

        return { data, error, success: !error };
    },

    // Add Item
    async addItem(reportId: string, item: Omit<UnserviceableItem, 'id' | 'reportId'>) {
        const { data, error } = await supabase
            .from('unserviceable_report_items')
            .insert({
                report_id: reportId,
                property_number: item.propertyNumber,
                description: item.description,
                quantity: item.quantity,
                unit_cost: item.unitCost,
                total_cost: item.totalCost,
                date_acquired: item.dateAcquired,
                condition: item.condition,
                defects: item.defects,
                recommendation: item.recommendation,
                estimated_repair_cost: item.estimatedRepairCost,
                accumulated_depreciation: item.accumulatedDepreciation,
                accumulated_impairment: item.accumulatedImpairment,
                carrying_amount: item.carryingAmount,
                disposal_mode: item.disposalMode,
                appraised_value: item.appraisedValue,
                or_number: item.orNumber,
                amount: item.amount
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
