// =====================================================
// Weekly Property Reports Service - Annex A.7 (RSPI)
// =====================================================

import { supabase } from '@/lib/supabase';

export interface RSPIItem {
    ics_no: string;
    responsibility_center?: string;
    property_no: string;
    description: string;
    unit: string;
    qty_issued: number;
    accountable_officer: string;
    unit_cost: number;
    amount: number;
    remarks: string;
}

export interface WeeklyPropertyReport {
    id: string;
    entity_name: string;
    fund_cluster?: string;
    serial_number: string;
    report_date: string;
    period_start: string;
    period_end: string;
    items: RSPIItem[];
    certified_by_name?: string;
    certified_by_position?: string;
    certified_date?: string;
    posted_by_name?: string;
    posted_by_position?: string;
    posted_date?: string;
    status: 'draft' | 'certified' | 'posted';
    created_at?: string;
    updated_at?: string;
}

export const weeklyPropertyReportService = {
    /**
     * Generate RSPI report for a date range
     * Automatically aggregates all ICS issued within the period
     */
    async generate(params: {
        entity_name: string;
        period_start: string;
        period_end: string;
    }): Promise<WeeklyPropertyReport[]> {
        // Append time to period_end to ensure the entire day is included if date_issued has time
        const periodEndFull = params.period_end.includes('T') ? params.period_end : `${params.period_end}T23:59:59.999Z`;

        // Fetch all slips in period
        const { data: slips, error: slipsError } = await supabase
            .from('custodian_slips')
            .select(`
                id,
                slip_number,
                custodian_name,
                date_issued,
                custodian_slip_items (
                    id,
                    quantity,
                    unit,
                    unit_cost,
                    amount,
                    property_number,
                    description,
                    inventory_items (
                        semi_expandable_category,
                        category,
                        sub_category,
                        fund_sources ( name )
                    )
                )
            `)
            .eq('slip_status', 'Issued')
            .gte('date_issued', params.period_start)
            .lte('date_issued', periodEndFull);

        if (slipsError) {
            console.error('Error fetching slips for report:', slipsError);
            throw new Error(`Failed to fetch slips: ${slipsError.message}`);
        }

        // Group items by fund source + category (aligned with Registry logic)
        const groups = new Map<string, { fundCluster: string; category: string; items: RSPIItem[] }>();

        for (const slip of (slips || [])) {
            for (const item of (slip.custodian_slip_items || [])) {
                const inv = item.inventory_items as any;
                const fundCluster = inv?.fund_sources?.name || 'General Fund';
                
                // Mirror Registry.tsx category logic
                const category = inv?.semi_expandable_category 
                    || inv?.category 
                    || inv?.sub_category 
                    || 'Uncategorized';
                
                const groupKey = `${fundCluster}|||${category}`;
                
                if (!groups.has(groupKey)) {
                    groups.set(groupKey, { fundCluster, category, items: [] });
                }

                groups.get(groupKey)!.items.push({
                    ics_no: slip.slip_number,
                    responsibility_center: '',
                    property_no: item.property_number,
                    description: item.description,
                    unit: item.unit,
                    qty_issued: item.quantity,
                    accountable_officer: slip.custodian_name,
                    unit_cost: item.unit_cost || 0,
                    amount: item.amount || 0,
                    remarks: ''
                });
            }
        }

        if (groups.size === 0) {
            throw new Error("No issued properties found for the selected period.");
        }

        const generatedReports: WeeklyPropertyReport[] = [];
        let duplicateCount = 0;

        for (const group of Array.from(groups.values())) {
            // Store the combined name in the fund_cluster field
            const combinedName = `${group.fundCluster} - ${group.category}`;

            // Check if report already exists for this exact period and fund/category
            // If deleted, this query returns empty, allowing re-generation
            const { data: existing } = await supabase
                .from('weekly_property_reports')
                .select('id')
                .eq('fund_cluster', combinedName)
                .eq('period_start', params.period_start)
                .eq('period_end', params.period_end)
                .limit(1);

            if (existing && existing.length > 0) {
                duplicateCount++;
                continue;
            }
            
            const reportData = {
                entity_name: params.entity_name,
                fund_cluster: combinedName,
                report_date: new Date().toISOString().split('T')[0],
                period_start: params.period_start,
                period_end: params.period_end,
                items: group.items,
                status: 'draft' as const
            };

            const report = await weeklyPropertyReportService.create(reportData);
            generatedReports.push(report);
        }

        if (generatedReports.length === 0 && duplicateCount > 0) {
            throw new Error("Reports for this period and category already exist. Delete them first if you want to re-generate.");
        }

        return generatedReports;
    },

    /**
     * Create a manual RSPI report
     */
    async create(data: Omit<WeeklyPropertyReport, 'id' | 'serial_number' | 'created_at' | 'updated_at'>): Promise<WeeklyPropertyReport> {
        // Determine category code (SPHV/SPLV) from items
        const isHighValue = data.items.some(item => (item.unit_cost || 0) > 5000);
        const categoryCode = isHighValue ? 'SPHV' : 'SPLV';

        // Generate a serial number: YYYY-MM-NNNN (Category prefix removed per request)
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const prefix = `${year}-${month}`;

        // Count existing reports with this prefix to get next sequence
        const { count, error: countError } = await supabase
            .from('weekly_property_reports')
            .select('*', { count: 'exact', head: true })
            .like('serial_number', `${prefix}%`);

        if (countError) {
            console.error('Error counting reports for serial:', countError);
        }

        const seq = String((count || 0) + 1).padStart(4, '0');
        const serialNumber = `${prefix}-${seq}`;

        const { data: report, error } = await supabase
            .from('weekly_property_reports')
            .insert({
                entity_name: "PROVINCIAL GOVERNMENT OF APAYAO",
                fund_cluster: data.fund_cluster,
                serial_number: serialNumber,
                report_date: data.report_date,
                period_start: data.period_start,
                period_end: data.period_end,
                items: data.items,
                status: data.status || 'draft'
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating weekly report:', error);
            throw new Error(`Failed to create report: ${error.message}`);
        }

        return report;
    },

    /**
     * Get all weekly reports
     */
    async getAll(filters?: {
        startDate?: string;
        endDate?: string;
        status?: 'draft' | 'certified' | 'posted';
    }): Promise<WeeklyPropertyReport[]> {
        let query = supabase
            .from('weekly_property_reports')
            .select('*');

        if (filters?.startDate) {
            query = query.gte('period_start', filters.startDate);
        }
        if (filters?.endDate) {
            query = query.lte('period_end', filters.endDate);
        }
        if (filters?.status) {
            query = query.eq('status', filters.status);
        }

        const { data, error } = await query.order('report_date', { ascending: false });

        if (error) {
            console.error('Error fetching weekly reports:', error);
            throw new Error(`Failed to fetch reports: ${error.message}`);
        }

        return data || [];
    },

    /**
     * Get report by ID
     */
    async getById(id: string): Promise<WeeklyPropertyReport | null> {
        const { data, error } = await supabase
            .from('weekly_property_reports')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            console.error('Error fetching weekly report:', error);
            throw new Error(`Failed to fetch report: ${error.message}`);
        }

        return data;
    },

    /**
     * Get report by serial number
     */
    async getBySerialNumber(serialNumber: string): Promise<WeeklyPropertyReport | null> {
        const { data, error } = await supabase
            .from('weekly_property_reports')
            .select('*')
            .eq('serial_number', serialNumber)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            console.error('Error fetching weekly report:', error);
            throw new Error(`Failed to fetch report: ${error.message}`);
        }

        return data;
    },

    /**
     * Certify report (Property/Supply Custodian)
     */
    async certify(id: string, certifiedBy: {
        name: string;
        position: string;
        date: string;
    }): Promise<WeeklyPropertyReport> {
        const { data, error } = await supabase
            .from('weekly_property_reports')
            .update({
                certified_by_name: certifiedBy.name,
                certified_by_position: certifiedBy.position,
                certified_date: certifiedBy.date,
                status: 'certified'
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error certifying report:', error);
            throw new Error(`Failed to certify report: ${error.message}`);
        }

        return data;
    },

    /**
     * Mark as posted (Accounting Staff)
     */
    async markAsPosted(id: string, postedBy: {
        name: string;
        position: string;
        date: string;
    }): Promise<WeeklyPropertyReport> {
        const { data, error } = await supabase
            .from('weekly_property_reports')
            .update({
                posted_by_name: postedBy.name,
                posted_by_position: postedBy.position,
                posted_date: postedBy.date,
                status: 'posted'
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error marking report as posted:', error);
            throw new Error(`Failed to mark report as posted: ${error.message}`);
        }

        return data;
    },

    /**
     * Update report
     */
    async update(id: string, data: Partial<WeeklyPropertyReport>): Promise<WeeklyPropertyReport> {
        const { data: report, error } = await supabase
            .from('weekly_property_reports')
            .update({ ...data, entity_name: "PROVINCIAL GOVERNMENT OF APAYAO" })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating weekly report:', error);
            throw new Error(`Failed to update report: ${error.message}`);
        }

        return report;
    },

    /**
     * Delete report
     */
    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('weekly_property_reports')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting weekly report:', error);
            throw new Error(`Failed to delete report: ${error.message}`);
        }
    }
};
