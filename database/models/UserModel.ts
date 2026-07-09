import { getDatabase } from '../config';

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  fullName: string;
  position?: string;
  department?: string;
  role: 'admin' | 'manager' | 'user';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export class UserModel {
  private db = getDatabase();

  // Create a new user
  create(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): User {
    const id = `USR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      INSERT INTO users (
        id, username, email, password_hash, full_name, position,
        department, role, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      user.username,
      user.email,
      user.passwordHash,
      user.fullName,
      user.position || null,
      user.department || null,
      user.role,
      user.isActive ? 1 : 0,
      now,
      now
    );

    return this.findById(id)!;
  }

  // Find user by ID
  findById(id: string): User | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return null;

    return this.mapRowToUser(row);
  }

  // Find user by username
  findByUsername(username: string): User | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
    const row = stmt.get(username) as any;
    if (!row) return null;

    return this.mapRowToUser(row);
  }

  // Find user by email
  findByEmail(email: string): User | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
    const row = stmt.get(email) as any;
    if (!row) return null;

    return this.mapRowToUser(row);
  }

  // Get all users with pagination and filtering
  findAll(options: {
    limit?: number;
    offset?: number;
    role?: string;
    department?: string;
    isActive?: boolean;
    search?: string;
  } = {}): User[] {
    const { limit = 100, offset = 0, role, department, isActive, search } = options;
    
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (role) {
      whereClause += ' AND role = ?';
      params.push(role);
    }

    if (department) {
      whereClause += ' AND department = ?';
      params.push(department);
    }

    if (isActive !== undefined) {
      whereClause += ' AND is_active = ?';
      params.push(isActive ? 1 : 0);
    }

    if (search) {
      whereClause += ' AND (username LIKE ? OR full_name LIKE ? OR email LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    const stmt = this.db.prepare(`
      SELECT * FROM users 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(...params, limit, offset) as any[];
    return rows.map(row => this.mapRowToUser(row));
  }

  // Update user
  update(id: string, updates: Partial<User>): User | null {
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
      UPDATE users 
      SET ${fields.join(', ')}, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(...values);
    return this.findById(id);
  }

  // Delete user
  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM users WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Activate user
  activate(id: string): User | null {
    return this.update(id, { isActive: true });
  }

  // Deactivate user
  deactivate(id: string): User | null {
    return this.update(id, { isActive: false });
  }

  // Change user password
  changePassword(id: string, newPasswordHash: string): User | null {
    return this.update(id, { passwordHash: newPasswordHash });
  }

  // Get user statistics
  getStatistics(): {
    totalUsers: number;
    activeUsers: number;
    byRole: Record<string, number>;
    byDepartment: Record<string, number>;
  } {
    const totalUsers = this.db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    const activeUsers = this.db.prepare('SELECT COUNT(*) as count FROM users WHERE is_active = 1').get() as { count: number };
    
    const byRole = this.db.prepare(`
      SELECT role, COUNT(*) as count 
      FROM users 
      GROUP BY role
    `).all() as { role: string; count: number }[];

    const byDepartment = this.db.prepare(`
      SELECT department, COUNT(*) as count 
      FROM users 
      WHERE department IS NOT NULL
      GROUP BY department
    `).all() as { department: string; count: number }[];

    return {
      totalUsers: totalUsers.count,
      activeUsers: activeUsers.count,
      byRole: byRole.reduce((acc, item) => ({ ...acc, [item.role]: item.count }), {}),
      byDepartment: byDepartment.reduce((acc, item) => ({ ...acc, [item.department]: item.count }), {}),
    };
  }

  // Helper method to map database row to User
  private mapRowToUser(row: any): User {
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      passwordHash: row.password_hash,
      fullName: row.full_name,
      position: row.position,
      department: row.department,
      role: row.role,
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
