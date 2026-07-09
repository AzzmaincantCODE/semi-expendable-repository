import { getDatabase } from '../config';

export interface AuditLog {
  id: string;
  tableName: string;
  recordId: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  oldValues?: any;
  newValues?: any;
  userId: string;
  timestamp: string;
}

export class AuditLogModel {
  private db = getDatabase();

  // Create a new audit log entry
  create(log: Omit<AuditLog, 'id' | 'timestamp'>): AuditLog {
    const id = `AUDIT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      INSERT INTO audit_logs (
        id, table_name, record_id, action, old_values, new_values, user_id, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      log.tableName,
      log.recordId,
      log.action,
      log.oldValues ? JSON.stringify(log.oldValues) : null,
      log.newValues ? JSON.stringify(log.newValues) : null,
      log.userId,
      now
    );

    return this.findById(id)!;
  }

  // Find audit log by ID
  findById(id: string): AuditLog | null {
    const stmt = this.db.prepare(`
      SELECT 
        a.*,
        u.full_name as user_name,
        u.username
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.id = ?
    `);

    const row = stmt.get(id) as any;
    if (!row) return null;

    return this.mapRowToAuditLog(row);
  }

  // Get all audit logs with pagination and filtering
  findAll(options: {
    limit?: number;
    offset?: number;
    tableName?: string;
    action?: string;
    userId?: string;
    recordId?: string;
    startDate?: string;
    endDate?: string;
  } = {}): AuditLog[] {
    const { 
      limit = 100, 
      offset = 0, 
      tableName, 
      action, 
      userId, 
      recordId, 
      startDate, 
      endDate 
    } = options;
    
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (tableName) {
      whereClause += ' AND a.table_name = ?';
      params.push(tableName);
    }

    if (action) {
      whereClause += ' AND a.action = ?';
      params.push(action);
    }

    if (userId) {
      whereClause += ' AND a.user_id = ?';
      params.push(userId);
    }

    if (recordId) {
      whereClause += ' AND a.record_id = ?';
      params.push(recordId);
    }

    if (startDate) {
      whereClause += ' AND a.timestamp >= ?';
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND a.timestamp <= ?';
      params.push(endDate);
    }

    const stmt = this.db.prepare(`
      SELECT 
        a.*,
        u.full_name as user_name,
        u.username
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ${whereClause}
      ORDER BY a.timestamp DESC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(...params, limit, offset) as any[];
    return rows.map(row => this.mapRowToAuditLog(row));
  }

  // Get audit logs for a specific record
  getRecordHistory(tableName: string, recordId: string): AuditLog[] {
    return this.findAll({ tableName, recordId });
  }

  // Get audit logs for a specific user
  getUserActivity(userId: string, limit = 50): AuditLog[] {
    return this.findAll({ userId, limit });
  }

  // Get audit logs for a specific table
  getTableHistory(tableName: string, limit = 100): AuditLog[] {
    return this.findAll({ tableName, limit });
  }

  // Clean up old audit logs (older than specified days)
  cleanup(daysOld: number): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const stmt = this.db.prepare(`
      DELETE FROM audit_logs 
      WHERE timestamp < ?
    `);

    const result = stmt.run(cutoffDate.toISOString());
    return result.changes;
  }

  // Get audit statistics
  getStatistics(): {
    totalLogs: number;
    byAction: Record<string, number>;
    byTable: Record<string, number>;
    byUser: Record<string, number>;
  } {
    const totalLogs = this.db.prepare('SELECT COUNT(*) as count FROM audit_logs').get() as { count: number };
    
    const byAction = this.db.prepare(`
      SELECT action, COUNT(*) as count 
      FROM audit_logs 
      GROUP BY action
    `).all() as { action: string; count: number }[];

    const byTable = this.db.prepare(`
      SELECT table_name, COUNT(*) as count 
      FROM audit_logs 
      GROUP BY table_name
    `).all() as { table_name: string; count: number }[];

    const byUser = this.db.prepare(`
      SELECT u.full_name as user_name, COUNT(*) as count 
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      GROUP BY a.user_id, u.full_name
    `).all() as { user_name: string; count: number }[];

    return {
      totalLogs: totalLogs.count,
      byAction: byAction.reduce((acc, item) => ({ ...acc, [item.action]: item.count }), {}),
      byTable: byTable.reduce((acc, item) => ({ ...acc, [item.table_name]: item.count }), {}),
      byUser: byUser.reduce((acc, item) => ({ ...acc, [item.user_name || 'Unknown']: item.count }), {}),
    };
  }

  // Helper method to map database row to AuditLog
  private mapRowToAuditLog(row: any): AuditLog {
    return {
      id: row.id,
      tableName: row.table_name,
      recordId: row.record_id,
      action: row.action,
      oldValues: row.old_values ? JSON.parse(row.old_values) : undefined,
      newValues: row.new_values ? JSON.parse(row.new_values) : undefined,
      userId: row.user_id,
      timestamp: row.timestamp,
    };
  }
}
