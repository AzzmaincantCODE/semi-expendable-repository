import { getDatabase } from '../config';

export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string;
  headOfficer?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export class DepartmentModel {
  private db = getDatabase();

  // Create a new department
  create(department: Omit<Department, 'id' | 'createdAt' | 'updatedAt'>): Department {
    const id = `DEPT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      INSERT INTO departments (
        id, name, code, description, head_officer, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      department.name,
      department.code,
      department.description || null,
      department.headOfficer || null,
      department.isActive ? 1 : 0,
      now,
      now
    );

    return this.findById(id)!;
  }

  // Find department by ID
  findById(id: string): Department | null {
    const stmt = this.db.prepare('SELECT * FROM departments WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return null;

    return this.mapRowToDepartment(row);
  }

  // Find department by code
  findByCode(code: string): Department | null {
    const stmt = this.db.prepare('SELECT * FROM departments WHERE code = ?');
    const row = stmt.get(code) as any;
    if (!row) return null;

    return this.mapRowToDepartment(row);
  }

  // Get all departments with pagination and filtering
  findAll(options: {
    limit?: number;
    offset?: number;
    isActive?: boolean;
    search?: string;
  } = {}): Department[] {
    const { limit = 100, offset = 0, isActive, search } = options;
    
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (isActive !== undefined) {
      whereClause += ' AND is_active = ?';
      params.push(isActive ? 1 : 0);
    }

    if (search) {
      whereClause += ' AND (name LIKE ? OR code LIKE ? OR description LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    const stmt = this.db.prepare(`
      SELECT * FROM departments 
      ${whereClause}
      ORDER BY name ASC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(...params, limit, offset) as any[];
    return rows.map(row => this.mapRowToDepartment(row));
  }

  // Update department
  update(id: string, updates: Partial<Department>): Department | null {
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
      UPDATE departments 
      SET ${fields.join(', ')}, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(...values);
    return this.findById(id);
  }

  // Delete department
  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM departments WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Activate department
  activate(id: string): Department | null {
    return this.update(id, { isActive: true });
  }

  // Deactivate department
  deactivate(id: string): Department | null {
    return this.update(id, { isActive: false });
  }

  // Helper method to map database row to Department
  private mapRowToDepartment(row: any): Department {
    return {
      id: row.id,
      name: row.name,
      code: row.code,
      description: row.description,
      headOfficer: row.head_officer,
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
