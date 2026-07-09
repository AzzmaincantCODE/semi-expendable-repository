import { getDatabase } from '../config';

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export class SupplierModel {
  private db = getDatabase();

  // Create a new supplier
  create(supplier: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>): Supplier {
    const id = `SUP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      INSERT INTO suppliers (
        id, name, contact_person, email, phone, address, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      supplier.name,
      supplier.contactPerson || null,
      supplier.email || null,
      supplier.phone || null,
      supplier.address || null,
      supplier.isActive ? 1 : 0,
      now,
      now
    );

    return this.findById(id)!;
  }

  // Find supplier by ID
  findById(id: string): Supplier | null {
    const stmt = this.db.prepare('SELECT * FROM suppliers WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return null;

    return this.mapRowToSupplier(row);
  }

  // Find supplier by name
  findByName(name: string): Supplier | null {
    const stmt = this.db.prepare('SELECT * FROM suppliers WHERE name = ?');
    const row = stmt.get(name) as any;
    if (!row) return null;

    return this.mapRowToSupplier(row);
  }

  // Get all suppliers with pagination and filtering
  findAll(options: {
    limit?: number;
    offset?: number;
    isActive?: boolean;
    search?: string;
  } = {}): Supplier[] {
    const { limit = 100, offset = 0, isActive, search } = options;
    
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (isActive !== undefined) {
      whereClause += ' AND is_active = ?';
      params.push(isActive ? 1 : 0);
    }

    if (search) {
      whereClause += ' AND (name LIKE ? OR contact_person LIKE ? OR email LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    const stmt = this.db.prepare(`
      SELECT * FROM suppliers 
      ${whereClause}
      ORDER BY name ASC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(...params, limit, offset) as any[];
    return rows.map(row => this.mapRowToSupplier(row));
  }

  // Update supplier
  update(id: string, updates: Partial<Supplier>): Supplier | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const fields = [];
    const values = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'createdAt' && value !== undefined) {
        const dbKey = this.camelToSnakeCase(key);
        if (key === 'isActive') {
          fields.push(`${dbKey} = ?`);
          values.push(value ? 1 : 0);
        } else {
          fields.push(`${dbKey} = ?`);
          values.push(value);
        }
      }
    });

    if (fields.length === 0) return existing;

    values.push(new Date().toISOString(), id);

    const stmt = this.db.prepare(`
      UPDATE suppliers 
      SET ${fields.join(', ')}, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(...values);
    return this.findById(id);
  }

  // Delete supplier
  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM suppliers WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Activate supplier
  activate(id: string): Supplier | null {
    return this.update(id, { isActive: true });
  }

  // Deactivate supplier
  deactivate(id: string): Supplier | null {
    return this.update(id, { isActive: false });
  }

  // Helper method to map database row to Supplier
  private mapRowToSupplier(row: any): Supplier {
    return {
      id: row.id,
      name: row.name,
      contactPerson: row.contact_person,
      email: row.email,
      phone: row.phone,
      address: row.address,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // Helper method to convert camelCase to snake_case
  private camelToSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}
