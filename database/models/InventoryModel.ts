import { getDatabase } from '../config';
import { InventoryItem } from '../../src/types/inventory';

export class InventoryModel {
  private db = getDatabase();

  // Create a new inventory item
  create(item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>): InventoryItem {
    const id = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      INSERT INTO inventory_items (
        id, property_number, description, brand, model, serial_number,
        unit_of_measure, quantity, unit_cost, total_cost, date_acquired,
        supplier_id, condition, location_id, custodian_id, custodian_position,
        accountable_officer, fund_source_id, remarks, last_inventory_date,
        category, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      item.propertyNumber,
      item.description,
      item.brand,
      item.model,
      item.serialNumber,
      item.unitOfMeasure,
      item.quantity,
      item.unitCost,
      item.totalCost,
      item.dateAcquired,
      item.supplier || null,
      item.condition,
      item.location || null,
      item.custodian || null,
      item.custodianPosition,
      item.accountableOfficer,
      item.fundSource || null,
      item.remarks || null,
      item.lastInventoryDate || null,
      item.category,
      item.status,
      now,
      now
    );

    return this.findById(id)!;
  }

  // Find inventory item by ID
  findById(id: string): InventoryItem | null {
    const stmt = this.db.prepare(`
      SELECT 
        i.*,
        s.name as supplier_name,
        l.name as location_name,
        u.full_name as custodian_name,
        f.name as fund_source_name
      FROM inventory_items i
      LEFT JOIN suppliers s ON i.supplier_id = s.id
      LEFT JOIN locations l ON i.location_id = l.id
      LEFT JOIN users u ON i.custodian_id = u.id
      LEFT JOIN fund_sources f ON i.fund_source_id = f.id
      WHERE i.id = ?
    `);

    const row = stmt.get(id) as any;
    if (!row) return null;

    return this.mapRowToInventoryItem(row);
  }

  // Find inventory item by property number
  findByPropertyNumber(propertyNumber: string): InventoryItem | null {
    const stmt = this.db.prepare(`
      SELECT 
        i.*,
        s.name as supplier_name,
        l.name as location_name,
        u.full_name as custodian_name,
        f.name as fund_source_name
      FROM inventory_items i
      LEFT JOIN suppliers s ON i.supplier_id = s.id
      LEFT JOIN locations l ON i.location_id = l.id
      LEFT JOIN users u ON i.custodian_id = u.id
      LEFT JOIN fund_sources f ON i.fund_source_id = f.id
      WHERE i.property_number = ?
    `);

    const row = stmt.get(propertyNumber) as any;
    if (!row) return null;

    return this.mapRowToInventoryItem(row);
  }

  // Get all inventory items with pagination and filtering
  findAll(options: {
    limit?: number;
    offset?: number;
    category?: string;
    status?: string;
    condition?: string;
    search?: string;
  } = {}): InventoryItem[] {
    const { limit = 100, offset = 0, category, status, condition, search } = options;
    
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (category) {
      whereClause += ' AND i.category = ?';
      params.push(category);
    }

    if (status) {
      whereClause += ' AND i.status = ?';
      params.push(status);
    }

    if (condition) {
      whereClause += ' AND i.condition = ?';
      params.push(condition);
    }

    if (search) {
      whereClause += ' AND (i.property_number LIKE ? OR i.description LIKE ? OR i.brand LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    const stmt = this.db.prepare(`
      SELECT 
        i.*,
        s.name as supplier_name,
        l.name as location_name,
        u.full_name as custodian_name,
        f.name as fund_source_name
      FROM inventory_items i
      LEFT JOIN suppliers s ON i.supplier_id = s.id
      LEFT JOIN locations l ON i.location_id = l.id
      LEFT JOIN users u ON i.custodian_id = u.id
      LEFT JOIN fund_sources f ON i.fund_source_id = f.id
      ${whereClause}
      ORDER BY i.created_at DESC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(...params, limit, offset) as any[];
    return rows.map(row => this.mapRowToInventoryItem(row));
  }

  // Update inventory item
  update(id: string, updates: Partial<InventoryItem>): InventoryItem | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const fields = [];
    const values = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'createdAt' && value !== undefined) {
        const dbKey = this.camelToSnakeCase(key);
        fields.push(`${dbKey} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) return existing;

    values.push(new Date().toISOString(), id);

    const stmt = this.db.prepare(`
      UPDATE inventory_items 
      SET ${fields.join(', ')}, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(...values);
    return this.findById(id);
  }

  // Delete inventory item
  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM inventory_items WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Get inventory statistics
  getStatistics(): {
    totalItems: number;
    totalValue: number;
    byCategory: Record<string, number>;
    byStatus: Record<string, number>;
    byCondition: Record<string, number>;
  } {
    const totalItems = this.db.prepare('SELECT COUNT(*) as count FROM inventory_items').get() as { count: number };
    const totalValue = this.db.prepare('SELECT SUM(total_cost) as total FROM inventory_items').get() as { total: number };
    
    const byCategory = this.db.prepare(`
      SELECT category, COUNT(*) as count 
      FROM inventory_items 
      GROUP BY category
    `).all() as { category: string; count: number }[];

    const byStatus = this.db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM inventory_items 
      GROUP BY status
    `).all() as { status: string; count: number }[];

    const byCondition = this.db.prepare(`
      SELECT condition, COUNT(*) as count 
      FROM inventory_items 
      GROUP BY condition
    `).all() as { condition: string; count: number }[];

    return {
      totalItems: totalItems.count,
      totalValue: totalValue.total || 0,
      byCategory: byCategory.reduce((acc, item) => ({ ...acc, [item.category]: item.count }), {}),
      byStatus: byStatus.reduce((acc, item) => ({ ...acc, [item.status]: item.count }), {}),
      byCondition: byCondition.reduce((acc, item) => ({ ...acc, [item.condition]: item.count }), {}),
    };
  }

  // Helper method to map database row to InventoryItem
  private mapRowToInventoryItem(row: any): InventoryItem {
    return {
      id: row.id,
      propertyNumber: row.property_number,
      description: row.description,
      brand: row.brand,
      model: row.model,
      serialNumber: row.serial_number,
      unitOfMeasure: row.unit_of_measure,
      quantity: row.quantity,
      unitCost: row.unit_cost,
      totalCost: row.total_cost,
      dateAcquired: row.date_acquired,
      supplier: row.supplier_name || row.supplier_id,
      condition: row.condition,
      location: row.location_name || row.location_id,
      custodian: row.custodian_name || row.custodian_id,
      custodianPosition: row.custodian_position,
      accountableOfficer: row.accountable_officer,
      fundSource: row.fund_source_name || row.fund_source_id,
      remarks: row.remarks,
      lastInventoryDate: row.last_inventory_date,
      category: row.category,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // Helper method to convert camelCase to snake_case
  private camelToSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}
