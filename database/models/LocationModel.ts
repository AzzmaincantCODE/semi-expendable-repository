import { getDatabase } from '../config';

export interface Location {
  id: string;
  name: string;
  building?: string;
  room?: string;
  floor?: string;
  departmentId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export class LocationModel {
  private db = getDatabase();

  // Create a new location
  create(location: Omit<Location, 'id' | 'createdAt' | 'updatedAt'>): Location {
    const id = `LOC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      INSERT INTO locations (
        id, name, building, room, floor, department_id, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      location.name,
      location.building || null,
      location.room || null,
      location.floor || null,
      location.departmentId || null,
      location.isActive ? 1 : 0,
      now,
      now
    );

    return this.findById(id)!;
  }

  // Find location by ID
  findById(id: string): Location | null {
    const stmt = this.db.prepare(`
      SELECT 
        l.*,
        d.name as department_name
      FROM locations l
      LEFT JOIN departments d ON l.department_id = d.id
      WHERE l.id = ?
    `);

    const row = stmt.get(id) as any;
    if (!row) return null;

    return this.mapRowToLocation(row);
  }

  // Find location by name
  findByName(name: string): Location | null {
    const stmt = this.db.prepare(`
      SELECT 
        l.*,
        d.name as department_name
      FROM locations l
      LEFT JOIN departments d ON l.department_id = d.id
      WHERE l.name = ?
    `);

    const row = stmt.get(name) as any;
    if (!row) return null;

    return this.mapRowToLocation(row);
  }

  // Get all locations with pagination and filtering
  findAll(options: {
    limit?: number;
    offset?: number;
    departmentId?: string;
    isActive?: boolean;
    search?: string;
  } = {}): Location[] {
    const { limit = 100, offset = 0, departmentId, isActive, search } = options;
    
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (departmentId) {
      whereClause += ' AND l.department_id = ?';
      params.push(departmentId);
    }

    if (isActive !== undefined) {
      whereClause += ' AND l.is_active = ?';
      params.push(isActive ? 1 : 0);
    }

    if (search) {
      whereClause += ' AND (l.name LIKE ? OR l.building LIKE ? OR l.room LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    const stmt = this.db.prepare(`
      SELECT 
        l.*,
        d.name as department_name
      FROM locations l
      LEFT JOIN departments d ON l.department_id = d.id
      ${whereClause}
      ORDER BY l.name ASC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(...params, limit, offset) as any[];
    return rows.map(row => this.mapRowToLocation(row));
  }

  // Update location
  update(id: string, updates: Partial<Location>): Location | null {
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
      UPDATE locations 
      SET ${fields.join(', ')}, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(...values);
    return this.findById(id);
  }

  // Delete location
  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM locations WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Activate location
  activate(id: string): Location | null {
    return this.update(id, { isActive: true });
  }

  // Deactivate location
  deactivate(id: string): Location | null {
    return this.update(id, { isActive: false });
  }

  // Helper method to map database row to Location
  private mapRowToLocation(row: any): Location {
    return {
      id: row.id,
      name: row.name,
      building: row.building,
      room: row.room,
      floor: row.floor,
      departmentId: row.department_id,
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
