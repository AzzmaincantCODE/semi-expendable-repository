// Supabase Service Layer - Centralized data access using Supabase
import { supabase, handleSupabaseResponse, createPaginationParams } from '../lib/supabase';
import { InventoryItem } from '../types/inventory';

export interface SupabaseResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  success: boolean;
  error?: string;
}

// Inventory Service
export const inventoryService = {
  // Get all inventory items with pagination and filtering
  async getAll(filters: {
    page?: number;
    limit?: number;
    category?: string;
    status?: string;
    condition?: string;
    search?: string;
  } = {}): Promise<PaginatedResponse<InventoryItem>> {
    const { page = 1, limit = 50, category, status, condition, search } = filters;
    const { from, to } = createPaginationParams(page, limit);

    let query = supabase
      .from('inventory_items')
      .select(`
        *,
        suppliers:supplier_id(name),
        locations:location_id(name),
        fund_sources:fund_source_id(name)
      `, { count: 'exact' })
      .range(from, to);

    // Apply filters
    if (category) query = query.eq('category', category);
    if (status) query = query.eq('status', status);
    if (condition) query = query.eq('condition', condition);
    if (search) {
      query = query.or(`property_number.ilike.%${search}%,description.ilike.%${search}%,brand.ilike.%${search}%`);
    }

    const response = await query.order('created_at', { ascending: false });

    if (response.error) {
      return {
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
        success: false,
        error: response.error.message,
      };
    }

    const total = response.count || 0;
    const totalPages = Math.ceil(total / limit);

    return {
      data: response.data || [],
      pagination: { page, limit, total, totalPages },
      success: true,
    };
  },

  // Get inventory item by ID
  async getById(id: string): Promise<SupabaseResponse<InventoryItem>> {
    const response = await supabase
      .from('inventory_items')
      .select(`
        *,
        suppliers:supplier_id(name),
        locations:location_id(name),
        fund_sources:fund_source_id(name)
      `)
      .eq('id', id)
      .single();

    return {
      data: response.data,
      error: response.error?.message || null,
      success: !response.error,
    };
  },

  // Get inventory item by property number
  async getByPropertyNumber(propertyNumber: string): Promise<SupabaseResponse<InventoryItem>> {
    const response = await supabase
      .from('inventory_items')
      .select(`
        *,
        suppliers:supplier_id(name),
        locations:location_id(name),
        fund_sources:fund_source_id(name)
      `)
      .eq('property_number', propertyNumber)
      .single();

    return {
      data: response.data,
      error: response.error?.message || null,
      success: !response.error,
    };
  },

  // Create new inventory item
  async create(item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<SupabaseResponse<InventoryItem>> {
    const response = await supabase
      .from('inventory_items')
      .insert({
        property_number: item.propertyNumber,
        description: item.description,
        brand: item.brand,
        model: item.model,
        serial_number: item.serialNumber,
        unit_of_measure: item.unitOfMeasure,
        quantity: item.quantity,
        unit_cost: item.unitCost,
        total_cost: item.totalCost,
        date_acquired: item.dateAcquired,
        supplier_id: item.supplier || null,
        condition: item.condition,
        location_id: item.location || null,
        custodian_id: item.custodian || null,
        custodian_position: item.custodianPosition,
        accountable_officer: item.accountableOfficer,
        fund_source_id: item.fundSource || null,
        remarks: item.remarks,
        last_inventory_date: item.lastInventoryDate,
        category: item.category,
        status: item.status,
        entity_name: "PROVINCIAL GOVERNMENT OF APAYAO",
      })
      .select()
      .single();

    return {
      data: response.data,
      error: response.error?.message || null,
      success: !response.error,
    };
  },

  // Update inventory item
  async update(id: string, updates: Partial<InventoryItem>): Promise<SupabaseResponse<InventoryItem>> {
    const updateData: Record<string, unknown> = {};

    if (updates.propertyNumber) updateData.property_number = updates.propertyNumber;
    if (updates.description) updateData.description = updates.description;
    if (updates.brand) updateData.brand = updates.brand;
    if (updates.model) updateData.model = updates.model;
    if (updates.serialNumber) updateData.serial_number = updates.serialNumber;
    if (updates.unitOfMeasure) updateData.unit_of_measure = updates.unitOfMeasure;
    if (updates.quantity !== undefined) updateData.quantity = updates.quantity;
    if (updates.unitCost !== undefined) updateData.unit_cost = updates.unitCost;
    if (updates.totalCost !== undefined) updateData.total_cost = updates.totalCost;
    if (updates.dateAcquired) updateData.date_acquired = updates.dateAcquired;
    if (updates.supplier) updateData.supplier_id = updates.supplier;
    if (updates.condition) updateData.condition = updates.condition;
    if (updates.location) updateData.location_id = updates.location;
    if (updates.custodian) updateData.custodian_id = updates.custodian;
    if (updates.custodianPosition) updateData.custodian_position = updates.custodianPosition;
    if (updates.accountableOfficer) updateData.accountable_officer = updates.accountableOfficer;
    if (updates.fundSource) updateData.fund_source_id = updates.fundSource;
    if (updates.remarks) updateData.remarks = updates.remarks;
    if (updates.lastInventoryDate) updateData.last_inventory_date = updates.lastInventoryDate;
    if (updates.category) updateData.category = updates.category;
    if (updates.status) updateData.status = updates.status;
    updateData.entity_name = "PROVINCIAL GOVERNMENT OF APAYAO";

    const response = await supabase
      .from('inventory_items')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    return {
      data: response.data,
      error: response.error?.message || null,
      success: !response.error,
    };
  },

  // Delete inventory item
  async delete(id: string): Promise<SupabaseResponse<void>> {
    const response = await supabase
      .from('inventory_items')
      .delete()
      .eq('id', id);

    return {
      data: response.data,
      error: response.error?.message || null,
      success: !response.error,
    };
  },

  // Get inventory statistics
  async getStatistics(): Promise<SupabaseResponse<{
    totalItems: number;
    totalValue: number;
    byCategory: Record<string, number>;
    byStatus: Record<string, number>;
    byCondition: Record<string, number>;
  }>> {
    try {
      // Get total items
      const { count: totalItems } = await supabase
        .from('inventory_items')
        .select('*', { count: 'exact', head: true });

      // Get total value
      const { data: valueData } = await supabase
        .from('inventory_items')
        .select('total_cost');

      const totalValue = valueData?.reduce((sum, item) => sum + (item.total_cost || 0), 0) || 0;

      // Get by category
      const { data: categoryData } = await supabase
        .from('inventory_items')
        .select('category')
        .not('category', 'is', null);

      const byCategory = categoryData?.reduce((acc, item) => {
        acc[item.category] = (acc[item.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      // Get by status
      const { data: statusData } = await supabase
        .from('inventory_items')
        .select('status')
        .not('status', 'is', null);

      const byStatus = statusData?.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      // Get by condition
      const { data: conditionData } = await supabase
        .from('inventory_items')
        .select('condition')
        .not('condition', 'is', null);

      const byCondition = conditionData?.reduce((acc, item) => {
        acc[item.condition] = (acc[item.condition] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      return {
        data: {
          totalItems: totalItems || 0,
          totalValue,
          byCategory,
          byStatus,
          byCondition,
        },
        error: null,
        success: true,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      };
    }
  },

  // Search inventory items
  async search(query: string, filters: {
    page?: number;
    limit?: number;
    category?: string;
    status?: string;
    condition?: string;
  } = {}): Promise<PaginatedResponse<InventoryItem>> {
    return this.getAll({
      ...filters,
      search: query,
    });
  },
};

// Department Service
export const departmentService = {
  async getAll(filters: {
    page?: number;
    limit?: number;
    isActive?: boolean;
    search?: string;
  } = {}): Promise<PaginatedResponse<Record<string, unknown>>> {
    const { page = 1, limit = 50, isActive, search } = filters;
    const { from, to } = createPaginationParams(page, limit);

    let query = supabase
      .from('departments')
      .select('*', { count: 'exact' })
      .range(from, to);

    if (isActive !== undefined) query = query.eq('is_active', isActive);
    if (search) {
      query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const response = await query.order('name', { ascending: true });

    if (response.error) {
      return {
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
        success: false,
        error: response.error.message,
      };
    }

    const total = response.count || 0;
    const totalPages = Math.ceil(total / limit);

    return {
      data: (response.data || []) as Record<string, unknown>[],
      pagination: { page, limit, total, totalPages },
      success: true,
    };
  },

  async getById(id: string): Promise<SupabaseResponse<Record<string, unknown>>> {
    const response = await supabase
      .from('departments')
      .select('*')
      .eq('id', id)
      .single();

    return {
      data: (response.data || null) as Record<string, unknown> | null,
      error: response.error?.message || null,
      success: !response.error,
    };
  },

  async create(department: unknown): Promise<SupabaseResponse<Record<string, unknown>>> {
    const response = await supabase
      .from('departments')
      .insert(department)
      .select()
      .single();

    return {
      data: (response.data || null) as Record<string, unknown> | null,
      error: response.error?.message || null,
      success: !response.error,
    };
  },

  async update(id: string, updates: unknown): Promise<SupabaseResponse<Record<string, unknown>>> {
    const response = await supabase
      .from('departments')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    return {
      data: (response.data || null) as Record<string, unknown> | null,
      error: response.error?.message || null,
      success: !response.error,
    };
  },

  async delete(id: string): Promise<SupabaseResponse<void>> {
    const response = await supabase
      .from('departments')
      .delete()
      .eq('id', id);

    return {
      data: response.data,
      error: response.error?.message || null,
      success: !response.error,
    };
  },
};

// Import other services
import { propertyCardService } from './propertyCardService';
import { unserviceableReportService } from './unserviceableReportService';
import { physicalCountService } from './physicalCountService';
import { transferService } from './transferService';

// Export all services
export const supabaseService = {
  inventory: inventoryService,
  departments: departmentService,
  propertyCards: propertyCardService,
  unserviceableReports: unserviceableReportService,
  physicalCounts: physicalCountService,
  transfers: transferService,
};
