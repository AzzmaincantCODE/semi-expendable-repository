import { supabase } from '@/lib/supabase';

export interface Custodian {
  id: string;
  custodian_no: string;
  name: string;
  position?: string;
  department_id?: string;
  department_name?: string;
  employee_no?: string;
  contact_number?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustodianItemHistory {
  id: string;
  property_number: string;
  description: string;
  category: string;
  sub_category?: string;
  unit_cost: number;
  total_cost: number;
  condition: string;
  status: string;
  assignment_status: string;
  assigned_date?: string;
  custodian_slip_id: string;
  custodian_slip_number: string;
  date_issued: string;
  date_returned?: string;
  is_currently_assigned: boolean;
}

export interface CustodianSummary {
  custodian: Custodian;
  total_items_assigned: number;
  total_value_assigned: number;
  currently_assigned_items: number;
  currently_assigned_value: number;
  historical_items: number;
  historical_value: number;
  last_activity_date?: string;
}

export interface CustodianFilters {
  limit?: number;
  offset?: number;
  search?: string;
  department_id?: string;
  is_active?: boolean;
}

export const custodianService = {
  // Get all custodians with optional filtering
  async getAll(filters: CustodianFilters = {}): Promise<Custodian[]> {
    let query = supabase
      .from('custodians')
      .select(`
        *,
        departments!custodians_department_id_fkey (
          id,
          name
        )
      `)
      .order('name', { ascending: true });

    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,custodian_no.ilike.%${filters.search}%`);
    }

    if (filters.department_id) {
      query = query.eq('department_id', filters.department_id);
    }

    if (filters.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data?.map(item => ({
      ...item,
      department_name: item.departments?.name
    })) || [];
  },

  // Get custodian by ID
  async getById(id: string): Promise<Custodian | null> {
    const { data, error } = await supabase
      .from('custodians')
      .select(`
        *,
        departments!custodians_department_id_fkey (
          id,
          name
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) return null;

    return {
      ...data,
      department_name: data.departments?.name
    };
  },

  // Get custodian summary with statistics
  async getSummary(id: string): Promise<CustodianSummary | null> {
    const custodian = await this.getById(id);
    if (!custodian) return null;

    // First, get all custodian slips for this custodian
    const { data: slips, error: slipsError } = await supabase
      .from('custodian_slips')
      .select('id, slip_number, custodian_name, date_issued')
      .eq('custodian_name', custodian.name);

    if (slipsError) throw slipsError;

    // Get slip IDs
    const slipIds = slips?.map(slip => slip.id) || [];

    let allItems: any[] = [];

    if (slipIds.length > 0) {
      // Get all items ever assigned to this custodian via slip items
      const { data, error: allItemsError } = await supabase
        .from('custodian_slip_items')
        .select(`
          *,
          inventory_items (
            property_number,
            description,
            category,
            sub_category,
            unit_cost,
            total_cost,
            condition,
            status,
            assignment_status,
            assigned_date
          )
        `)
        .in('slip_id', slipIds);

      if (allItemsError) throw allItemsError;
      allItems = data || [];
    }

    // Get currently assigned items
    const { data: currentItems, error: currentItemsError } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('custodian', custodian.name)
      .eq('assignment_status', 'Assigned')
      .eq('status', 'Active');

    if (currentItemsError) throw currentItemsError;

    const totalItemsAssigned = allItems?.length || 0;
    const totalValueAssigned = allItems?.reduce((sum, item) =>
      sum + (item.inventory_items?.total_cost || 0), 0) || 0;

    const currentlyAssignedItems = currentItems?.length || 0;
    const currentlyAssignedValue = currentItems?.reduce((sum, item) =>
      sum + (item.total_cost || 0), 0) || 0;

    const historicalItems = totalItemsAssigned - currentlyAssignedItems;
    const historicalValue = totalValueAssigned - currentlyAssignedValue;

    const lastActivityDate = slips?.length ?
      Math.max(...slips.map(slip => new Date(slip.date_issued || 0).getTime())) : undefined;

    return {
      custodian,
      total_items_assigned: totalItemsAssigned,
      total_value_assigned: totalValueAssigned,
      currently_assigned_items: currentlyAssignedItems,
      currently_assigned_value: currentlyAssignedValue,
      historical_items: historicalItems,
      historical_value: historicalValue,
      last_activity_date: lastActivityDate ? new Date(lastActivityDate).toISOString() : undefined
    };
  },

  // Get custodian item history
  async getItemHistory(id: string, filters: { limit?: number; offset?: number; includeReturned?: boolean } = {}): Promise<CustodianItemHistory[]> {
    const custodian = await this.getById(id);
    if (!custodian) return [];

    // First, get all custodian slips for this custodian
    const { data: slips, error: slipsError } = await supabase
      .from('custodian_slips')
      .select('id, slip_number, custodian_name, date_issued')
      .eq('custodian_name', custodian.name);

    if (slipsError) throw slipsError;
    if (!slips || slips.length === 0) return [];

    // Get slip IDs
    const slipIds = slips.map(slip => slip.id);

    // Get custodian slip items for these slips
    let query = supabase
      .from('custodian_slip_items')
      .select(`
        *,
        custodian_slips!inner (id, slip_number, custodian_name, date_issued),
        inventory_items (
          property_number,
          description,
          brand,
          model,
          category,
          sub_category,
          unit_cost,
          total_cost,
          condition,
          status,
          assignment_status,
          assigned_date
        )
      `)
      .in('slip_id', slipIds)
      .order('created_at', { ascending: false });

    if (!filters.includeReturned) {
      // Only show currently assigned items - filter in the processing step
      // We can't filter on nested fields directly
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Filter results if needed
    let filteredData = data || [];
    if (!filters.includeReturned) {
      filteredData = filteredData.filter(item =>
        item.inventory_items?.assignment_status === 'Assigned'
      );
    }

    return filteredData.map(item => {
      const slip = slips.find(s => s.id === item.slip_id);
      const invItem = item.inventory_items;
      // Safe description fallback
      const description = invItem?.description ||
        (invItem?.model ? `${invItem?.brand || ''} ${invItem?.model}`.trim() : invItem?.brand) ||
        'No description available';
      return {
        id: item.id,
        property_number: invItem?.property_number || '',
        description: description,
        category: invItem?.category || 'Semi-Expendable',
        sub_category: invItem?.sub_category,
        unit_cost: Number(invItem?.unit_cost) || 0,
        total_cost: Number(invItem?.total_cost) || 0,
        condition: invItem?.condition || '',
        status: invItem?.status || '',
        assignment_status: invItem?.assignment_status || '',
        assigned_date: invItem?.assigned_date,
        custodian_slip_id: item.slip_id,
        custodian_slip_number: slip?.slip_number || '',
        date_issued: slip?.date_issued || '',
        date_returned: invItem?.assignment_status === 'Available' ? invItem?.assigned_date : undefined,
        is_currently_assigned: invItem?.assignment_status === 'Assigned'
      };
    });
  },

  // Get currently assigned items for custodian
  async getCurrentItems(id: string): Promise<CustodianItemHistory[]> {
    const custodian = await this.getById(id);
    if (!custodian) return [];

    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('custodian', custodian.name)
      .eq('assignment_status', 'Assigned')
      .eq('status', 'Active')
      .order('assigned_date', { ascending: false });

    if (error) throw error;

    return data?.map(item => {
      // Safe description fallback
      const description = item.description ||
        (item.model ? `${item.brand || ''} ${item.model}`.trim() : item.brand) ||
        'No description available';
      return {
        id: item.id,
        property_number: item.property_number,
        description: description,
        category: item.category || 'Semi-Expendable',
        sub_category: item.sub_category,
        unit_cost: Number(item.unit_cost) || 0,
        total_cost: Number(item.total_cost) || 0,
        condition: item.condition,
        status: item.status,
        assignment_status: item.assignment_status,
        assigned_date: item.assigned_date,
        custodian_slip_id: '',
        custodian_slip_number: '',
        date_issued: item.assigned_date || '',
        date_returned: undefined,
        is_currently_assigned: true
      };
    }) || [];
  },

  // Create new custodian
  async create(custodian: Omit<Custodian, 'id' | 'created_at' | 'updated_at' | 'custodian_no'>): Promise<Custodian> {
    const { data, error } = await supabase
      .from('custodians')
      .insert([custodian])
      .select(`
        *,
        departments!custodians_department_id_fkey (
          id,
          name
        )
      `)
      .single();

    if (error) throw error;

    return {
      ...data,
      department_name: data.departments?.name
    };
  },

  // Update custodian
  async update(id: string, updates: Partial<Custodian>): Promise<Custodian> {
    const { data, error } = await supabase
      .from('custodians')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        departments!custodians_department_id_fkey (
          id,
          name
        )
      `)
      .single();

    if (error) throw error;

    return {
      ...data,
      department_name: data.departments?.name
    };
  },

  // Delete custodian
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('custodians')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Get all custodian summaries
  async getAllSummaries(filters: CustodianFilters = {}): Promise<CustodianSummary[]> {
    const custodians = await this.getAll(filters);
    const summaries: CustodianSummary[] = [];

    for (const custodian of custodians) {
      const summary = await this.getSummary(custodian.id);
      if (summary) {
        summaries.push(summary);
      }
    }

    return summaries;
  }
};
