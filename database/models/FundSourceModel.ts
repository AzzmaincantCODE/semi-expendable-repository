import { getDatabase } from '../config';

export interface FundSource {
  id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export class FundSourceModel {
  private db = getDatabase();

  // Create a new fund source
  create(fundSource: Omit<FundSource, 'id' | 'createdAt' | 'updatedAt'>): FundSource {
    const id = `FS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      INSERT INTO fund_sources (
        id, name, code, description, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      fundSource.name,
      fundSource.code,
      fundSource.description || null,
      fundSource.isActive ? 1 : 0,
      now,
      now
    );

    return this.findById(id)!;
  }

  // Find fund source by ID
  findById(id: string): FundSource | null {
    const stmt = this.db.prepare('SELECT * FROM fund_sources WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return null;

    return this.mapRowToFundSource(row);
  }

  // Find fund source by code
  findByCode(code: string): FundSource | null {
    const stmt = this.db.prepare('SELECT * FROM fund_sources WHERE code = ?');
    const row = stmt.get(code) as any;
    if (!row) return null;

    return this.mapRowToFundSource(row);
  }

  // Get all fund sources with pagination and filtering
  findAll(options: {
    limit?: number;
    offset?: number;
    isActive?: boolean;
    search?: string;
  } = {}): FundSource[] {
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
      SELECT * FROM fund_sources 
      ${whereClause}
      ORDER BY name ASC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(...params, limit, offset) as any[];
    return rows.map(row => this.mapRowToFundSource(row));
  }

  // Update fund source
  update(id: string, updates: Partial<FundSource>): FundSource | null {
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
      UPDATE fund_sources 
      SET ${fields.join(', ')}, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(...values);
    return this.findById(id);
  }

  // Delete fund source
  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM fund_sources WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Activate fund source
  activate(id: string): FundSource | null {
    return this.update(id, { isActive: true });
  }

  // Deactivate fund source
  deactivate(id: string): FundSource | null {
    return this.update(id, { isActive: false });
  }

  // Helper method to map database row to FundSource
  private mapRowToFundSource(row: any): FundSource {
    return {
      id: row.id,
      name: row.name,
      code: row.code,
      description: row.description,
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
