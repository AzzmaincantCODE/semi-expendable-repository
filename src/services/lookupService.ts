// Lookup Service for related tables
import { supabase } from '../lib/supabase';
// OFFLINE EXPERIMENT
import { offlineLookupService } from '@/offline/offlineLookupService';
const isOffline = () => { try { return localStorage.getItem('offline-mode-enabled-v1') === 'true'; } catch { return false; } };

export interface LookupItem {
  id: string;
  name: string;
  code?: string;
  address?: string;
}

export const lookupService = {
  // Get all suppliers
  async getSuppliers(): Promise<LookupItem[]> {
    if (isOffline()) return offlineLookupService.getSuppliers();
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name, address')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error fetching suppliers:', error);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('Network error fetching suppliers:', err);
      return [];
    }
  },

  // Get all custodians (from dedicated table)
  async getCustodians(): Promise<LookupItem[]> {
    if (isOffline()) return offlineLookupService.getCustodians();
    try {
      const { data, error } = await supabase
        .from('custodians')
        .select('id, name, custodian_no')
        .order('name');

      if (error) {
        console.error('Error fetching custodians:', error);
        // Return empty array instead of throwing to prevent app crashes
        return [];
      }
      type CustodianRow = { id: string; name: string; custodian_no?: string | null };
      return (data || []).map((r: CustodianRow) => ({ id: r.id, name: r.name, code: r.custodian_no ?? undefined }));
    } catch (err) {
      console.error('Network error fetching custodians:', err);
      // Return empty array for network errors
      return [];
    }
  },


  // Get all fund sources
  async getFundSources(): Promise<LookupItem[]> {
    if (isOffline()) return offlineLookupService.getFundSources();
    const { data, error } = await supabase
      .from('fund_sources')
      .select('id, name, code')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error fetching fund sources:', error);
      return [];
    }

    return data || [];
  },

  // Get all users (for custodian)
  async getUsers(): Promise<LookupItem[]> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, full_name')
      .eq('is_active', true)
      .order('full_name');

    if (error) {
      console.error('Error fetching users:', error);
      return [];
    }

    type UserRow = { id: string; full_name: string };
    return (data || []).map((u: UserRow) => ({ id: u.id, name: u.full_name }));
  },

  // Get all departments
  async getDepartments(): Promise<LookupItem[]> {
    const { data, error } = await supabase
      .from('departments')
      .select('id, name, code')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error fetching departments:', error);
      return [];
    }

    return data || [];
  },

  // Get all semi expendable categories
  async getSemiExpandableCategories(): Promise<LookupItem[]> {
    if (isOffline()) return offlineLookupService.getSemiExpandableCategories();
    const { data, error } = await supabase
      .from('semi_expandable_categories')
      .select('id, name, code')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error fetching semi expendable categories:', error);
      return [];
    }

    return data || [];
  },

  // Create lookup
  async create(table: 'suppliers' | 'fund_sources' | 'departments' | 'custodians' | 'semi_expandable_categories', values: { name: string; code?: string; position?: string; department_id?: string; address?: string }) {
    const payload: Record<string, unknown> = { name: values.name };
    const trimmedCode = values.code?.trim();

    // Handle different table requirements
    if (table === 'suppliers') {
      if (values.address !== undefined) payload.address = (values.address && values.address.trim() !== '') ? values.address : null;
    } else if (table === 'fund_sources') {
      if (!trimmedCode) {
        throw new Error('Code is required for fund sources');
      }
      payload.code = trimmedCode;
    } else if (table === 'departments' || table === 'semi_expandable_categories') {
      if (trimmedCode) payload.code = trimmedCode;
    } else if (table === 'custodians') {
      let custodianNo = trimmedCode;
      if (!custodianNo) {
        const { data: rows, error: maxErr } = await supabase
          .from('custodians')
          .select('custodian_no')
          .order('custodian_no', { ascending: false })
          .limit(50);
        if (!maxErr && rows) {
          const nums = rows
            .map(r => String(r.custodian_no || '').trim())
            .map(s => (s.match(/\d+/) ? parseInt((s.match(/\d+/) as RegExpMatchArray)[0], 10) : NaN))
            .filter(n => Number.isFinite(n)) as number[];
          const next = (nums.length ? Math.max(...nums) + 1 : 1);
          custodianNo = String(next).padStart(4, '0');
        } else {
          custodianNo = '0001';
        }
      }
      const numeric = (custodianNo.match(/\d+/) ? (custodianNo.match(/\d+/) as RegExpMatchArray)[0] : custodianNo).padStart(4, '0');
      const normalized = `CUST-${numeric}`;
      const { data: existing, error: checkErr } = await supabase
        .from('custodians')
        .select('id')
        .in('custodian_no', [custodianNo, normalized])
        .limit(1);
      if (!checkErr && existing && existing.length > 0) {
        throw new Error('Custodian number already exists. Please use a different number.');
      }
      payload.custodian_no = normalized;
      if (values.position !== undefined) payload.position = (values.position && values.position.trim() !== '') ? values.position : null;
      if (values.department_id !== undefined) payload.department_id = (values.department_id && values.department_id.trim() !== '') ? values.department_id : null;
    }

    const selectCols = (table === 'fund_sources' || table === 'departments' || table === 'semi_expandable_categories') ? 'id, name, code' :
      table === 'custodians' ? 'id, name, custodian_no, position, department_id' : table === 'suppliers' ? 'id, name, address' : 'id, name';

    const { data, error } = await supabase.from(table).insert(payload).select(selectCols).single();
    if (error) {
      if (error.code === '23505') {
        if (table === 'custodians') {
          throw new Error('Custodian number already exists. Please use a different number.');
        } else {
          throw new Error('A record with this code already exists. Please use a different code.');
        }
      }
      if (error.code === '23502' && table === 'departments') {
        throw new Error('Department code is optional, but your database still requires it. Please run database/make-department-code-optional.sql in Supabase.');
      }
      throw error;
    }

    if (table === 'custodians') {
      return { id: data.id, name: data.name, code: data.custodian_no };
    }

    return data as LookupItem;
  },

  // Update lookup
  async update(table: 'suppliers' | 'fund_sources' | 'departments' | 'custodians' | 'semi_expandable_categories', id: string, values: { name?: string; code?: string; position?: string; department_id?: string; address?: string }) {
    const payload: Record<string, unknown> = {};
    if (values.name !== undefined) payload.name = values.name;

    const trimmedCode = values.code?.trim();
    if (table === 'suppliers') {
      if (values.address !== undefined) payload.address = (values.address && values.address.trim() !== '') ? values.address : null;
    } else if (table === 'fund_sources' || table === 'departments' || table === 'semi_expandable_categories') {
      if (values.code !== undefined) payload.code = trimmedCode ?? null;
    } else if (table === 'custodians') {
      if (values.code !== undefined) {
        if (trimmedCode) {
          const numeric = (trimmedCode.match(/\d+/) ? (trimmedCode.match(/\d+/) as RegExpMatchArray)[0] : trimmedCode).padStart(4, '0');
          payload.custodian_no = `CUST-${numeric}`;
        } else {
          payload.custodian_no = null;
        }
      }
      if (values.position !== undefined) payload.position = (values.position && values.position.trim() !== '') ? values.position : null;
      if (values.department_id !== undefined) payload.department_id = (values.department_id && values.department_id.trim() !== '') ? values.department_id : null;
    }

    const selectCols = (table === 'fund_sources' || table === 'departments' || table === 'semi_expandable_categories') ? 'id, name, code' :
      table === 'custodians' ? 'id, name, custodian_no, position, department_id' : table === 'suppliers' ? 'id, name, address' : 'id, name';

    const { data, error } = await supabase.from(table).update(payload).eq('id', id).select(selectCols).single();
    if (error) throw error;

    if (table === 'custodians') {
      return { id: data.id, name: data.name, code: data.custodian_no };
    }

    return data as LookupItem;
  },

  // Delete lookup
  async remove(table: 'suppliers' | 'fund_sources' | 'departments' | 'custodians' | 'semi_expandable_categories', id: string) {
    // For departments, check if it's referenced by custodians
    if (table === 'departments') {
      const { data: custodians, error: checkError } = await supabase
        .from('custodians')
        .select('id')
        .eq('department_id', id)
        .limit(1);

      if (checkError) throw checkError;

      if (custodians && custodians.length > 0) {
        throw new Error('Cannot delete department: It is currently assigned to custodians. Please reassign the custodians to a different department first.');
      }
    }

    // For custodians, check if they're referenced by inventory items (either by ID or by name)
    if (table === 'custodians') {
      // First, get the custodian's name
      const { data: custodianRow, error: custodianLookupError } = await supabase
        .from('custodians')
        .select('name')
        .eq('id', id)
        .maybeSingle();

      if (custodianLookupError) throw custodianLookupError;

      const custodianName = custodianRow?.name || null;

      // Check by custodian_id (preferred)
      const { data: inventoryById, error: byIdError } = await supabase
        .from('inventory_items')
        .select('id')
        .eq('custodian_id', id)
        .limit(1);

      if (byIdError) throw byIdError;

      // Check by custodian name (legacy/text column), if we have a name
      let inventoryByName: any[] | null = null;
      if (custodianName) {
        const result = await supabase
          .from('inventory_items')
          .select('id')
          .eq('custodian', custodianName)
          .limit(1);
        if (result.error) throw result.error;
        inventoryByName = result.data;
      }

      const hasAssignments =
        (inventoryById && inventoryById.length > 0) ||
        (inventoryByName && inventoryByName.length > 0);

      if (hasAssignments) {
        throw new Error('This Custodian still has items in custody. Suggest transferring items before deletion.');
      }
    }

    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw error;
    return true;
  },
};
