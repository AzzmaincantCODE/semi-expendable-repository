import { getDatabase } from '../config';

export interface PhysicalCount {
  id: string;
  countNumber: string;
  department: string;
  countDate: string;
  countType: 'Annual' | 'Quarterly' | 'Special' | 'Spot Check';
  status: 'Planned' | 'In Progress' | 'Completed' | 'Under Review';
  conductedBy: string[];
  witnessedBy: string;
  approvedBy: string;
  totalExpected: number;
  totalActual: number;
  totalVariance: number;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PhysicalCountItem {
  id: string;
  countId: string;
  propertyNumber: string;
  description: string;
  expectedQuantity: number;
  actualQuantity: number;
  condition: 'Serviceable' | 'For Repair' | 'Unserviceable' | 'Missing';
  location: string;
  remarks?: string;
  variance: number;
  createdAt: string;
}

export class PhysicalCountModel {
  private db = getDatabase();

  // Create a new physical count
  create(count: Omit<PhysicalCount, 'id' | 'createdAt' | 'updatedAt'>): PhysicalCount {
    const id = `PC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      INSERT INTO physical_counts (
        id, count_number, department, count_date, count_type, status,
        conducted_by, witnessed_by, approved_by, total_expected, total_actual,
        total_variance, remarks, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      count.countNumber,
      count.department,
      count.countDate,
      count.countType,
      count.status,
      JSON.stringify(count.conductedBy),
      count.witnessedBy,
      count.approvedBy,
      count.totalExpected,
      count.totalActual,
      count.totalVariance,
      count.remarks || null,
      now,
      now
    );

    return this.findById(id)!;
  }

  // Find physical count by ID
  findById(id: string): PhysicalCount | null {
    const stmt = this.db.prepare(`
      SELECT 
        p.*,
        u1.full_name as witnessed_by_name,
        u2.full_name as approved_by_name
      FROM physical_counts p
      LEFT JOIN users u1 ON p.witnessed_by = u1.id
      LEFT JOIN users u2 ON p.approved_by = u2.id
      WHERE p.id = ?
    `);

    const row = stmt.get(id) as any;
    if (!row) return null;

    return this.mapRowToPhysicalCount(row);
  }

  // Find physical count by count number
  findByCountNumber(countNumber: string): PhysicalCount | null {
    const stmt = this.db.prepare(`
      SELECT 
        p.*,
        u1.full_name as witnessed_by_name,
        u2.full_name as approved_by_name
      FROM physical_counts p
      LEFT JOIN users u1 ON p.witnessed_by = u1.id
      LEFT JOIN users u2 ON p.approved_by = u2.id
      WHERE p.count_number = ?
    `);

    const row = stmt.get(countNumber) as any;
    if (!row) return null;

    return this.mapRowToPhysicalCount(row);
  }

  // Get all physical counts with pagination and filtering
  findAll(options: {
    limit?: number;
    offset?: number;
    status?: string;
    countType?: string;
    department?: string;
    search?: string;
  } = {}): PhysicalCount[] {
    const { limit = 100, offset = 0, status, countType, department, search } = options;
    
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (status) {
      whereClause += ' AND p.status = ?';
      params.push(status);
    }

    if (countType) {
      whereClause += ' AND p.count_type = ?';
      params.push(countType);
    }

    if (department) {
      whereClause += ' AND p.department = ?';
      params.push(department);
    }

    if (search) {
      whereClause += ' AND (p.count_number LIKE ? OR p.department LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    const stmt = this.db.prepare(`
      SELECT 
        p.*,
        u1.full_name as witnessed_by_name,
        u2.full_name as approved_by_name
      FROM physical_counts p
      LEFT JOIN users u1 ON p.witnessed_by = u1.id
      LEFT JOIN users u2 ON p.approved_by = u2.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(...params, limit, offset) as any[];
    return rows.map(row => this.mapRowToPhysicalCount(row));
  }

  // Update physical count
  update(id: string, updates: Partial<PhysicalCount>): PhysicalCount | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const fields = [];
    const values = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'createdAt' && value !== undefined) {
        const dbKey = this.camelToSnakeCase(key);
        if (key === 'conductedBy') {
          fields.push(`${dbKey} = ?`);
          values.push(JSON.stringify(value));
        } else {
          fields.push(`${dbKey} = ?`);
          values.push(value);
        }
      }
    });

    if (fields.length === 0) return existing;

    values.push(new Date().toISOString(), id);

    const stmt = this.db.prepare(`
      UPDATE physical_counts 
      SET ${fields.join(', ')}, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(...values);
    return this.findById(id);
  }

  // Delete physical count
  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM physical_counts WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Add item to physical count
  addItem(countId: string, item: Omit<PhysicalCountItem, 'id' | 'countId' | 'createdAt'>): PhysicalCountItem {
    const id = `PCI-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      INSERT INTO physical_count_items (
        id, count_id, property_number, description, expected_quantity,
        actual_quantity, condition, location, remarks, variance, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      countId,
      item.propertyNumber,
      item.description,
      item.expectedQuantity,
      item.actualQuantity,
      item.condition,
      item.location,
      item.remarks || null,
      item.variance,
      now
    );

    return this.findItemById(id)!;
  }

  // Get all items for a physical count
  getItems(countId: string): PhysicalCountItem[] {
    const stmt = this.db.prepare(`
      SELECT * FROM physical_count_items 
      WHERE count_id = ? 
      ORDER BY created_at ASC
    `);
    
    const rows = stmt.all(countId) as any[];
    return rows.map(row => this.mapRowToPhysicalCountItem(row));
  }

  // Update physical count item
  updateItem(id: string, updates: Partial<PhysicalCountItem>): PhysicalCountItem | null {
    const existing = this.findItemById(id);
    if (!existing) return null;

    const fields = [];
    const values = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'countId' && key !== 'createdAt' && value !== undefined) {
        const dbKey = this.camelToSnakeCase(key);
        fields.push(`${dbKey} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) return existing;

    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE physical_count_items 
      SET ${fields.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);
    return this.findItemById(id);
  }

  // Delete physical count item
  deleteItem(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM physical_count_items WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Find physical count item by ID
  findItemById(id: string): PhysicalCountItem | null {
    const stmt = this.db.prepare('SELECT * FROM physical_count_items WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return null;

    return this.mapRowToPhysicalCountItem(row);
  }

  // Get physical count with items
  getWithItems(id: string): (PhysicalCount & { items: PhysicalCountItem[] }) | null {
    const count = this.findById(id);
    if (!count) return null;

    const items = this.getItems(id);
    return { ...count, items };
  }

  // Calculate totals for a physical count
  calculateTotals(countId: string): { totalExpected: number; totalActual: number; totalVariance: number } {
    const stmt = this.db.prepare(`
      SELECT 
        SUM(expected_quantity) as total_expected,
        SUM(actual_quantity) as total_actual,
        SUM(variance) as total_variance
      FROM physical_count_items 
      WHERE count_id = ?
    `);

    const result = stmt.get(countId) as any;
    return {
      totalExpected: result.total_expected || 0,
      totalActual: result.total_actual || 0,
      totalVariance: result.total_variance || 0,
    };
  }

  // Update totals for a physical count
  updateTotals(countId: string): PhysicalCount | null {
    const totals = this.calculateTotals(countId);
    return this.update(countId, {
      totalExpected: totals.totalExpected,
      totalActual: totals.totalActual,
      totalVariance: totals.totalVariance,
    });
  }

  // Helper method to map database row to PhysicalCount
  private mapRowToPhysicalCount(row: any): PhysicalCount {
    return {
      id: row.id,
      countNumber: row.count_number,
      department: row.department,
      countDate: row.count_date,
      countType: row.count_type,
      status: row.status,
      conductedBy: JSON.parse(row.conducted_by || '[]'),
      witnessedBy: row.witnessed_by,
      approvedBy: row.approved_by,
      totalExpected: row.total_expected,
      totalActual: row.total_actual,
      totalVariance: row.total_variance,
      remarks: row.remarks,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // Helper method to map database row to PhysicalCountItem
  private mapRowToPhysicalCountItem(row: any): PhysicalCountItem {
    return {
      id: row.id,
      countId: row.count_id,
      propertyNumber: row.property_number,
      description: row.description,
      expectedQuantity: row.expected_quantity,
      actualQuantity: row.actual_quantity,
      condition: row.condition,
      location: row.location,
      remarks: row.remarks,
      variance: row.variance,
      createdAt: row.created_at,
    };
  }

  // Helper method to convert camelCase to snake_case
  private camelToSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}
