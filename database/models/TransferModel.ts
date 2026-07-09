import { getDatabase } from '../config';

export interface Transfer {
  id: string;
  transferNumber: string;
  fromDepartment: string;
  toDepartment: string;
  transferType: 'Permanent' | 'Temporary' | 'Loan';
  status: 'Pending' | 'In Transit' | 'Completed' | 'Rejected';
  requestedBy: string;
  approvedBy?: string;
  dateRequested: string;
  dateApproved?: string;
  dateCompleted?: string;
  reason: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransferItem {
  id: string;
  transferId: string;
  propertyNumber: string;
  description: string;
  quantity: number;
  condition: string;
  createdAt: string;
}

export class TransferModel {
  private db = getDatabase();

  // Create a new transfer
  create(transfer: Omit<Transfer, 'id' | 'createdAt' | 'updatedAt'>): Transfer {
    const id = `TR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      INSERT INTO property_transfers (
        id, transfer_number, from_department, to_department, transfer_type,
        status, requested_by, approved_by, date_requested, date_approved,
        date_completed, reason, remarks, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      transfer.transferNumber,
      transfer.fromDepartment,
      transfer.toDepartment,
      transfer.transferType,
      transfer.status,
      transfer.requestedBy,
      transfer.approvedBy || null,
      transfer.dateRequested,
      transfer.dateApproved || null,
      transfer.dateCompleted || null,
      transfer.reason,
      transfer.remarks || null,
      now,
      now
    );

    return this.findById(id)!;
  }

  // Find transfer by ID
  findById(id: string): Transfer | null {
    const stmt = this.db.prepare(`
      SELECT 
        t.*,
        u1.full_name as requested_by_name,
        u2.full_name as approved_by_name
      FROM property_transfers t
      LEFT JOIN users u1 ON t.requested_by = u1.id
      LEFT JOIN users u2 ON t.approved_by = u2.id
      WHERE t.id = ?
    `);

    const row = stmt.get(id) as any;
    if (!row) return null;

    return this.mapRowToTransfer(row);
  }

  // Find transfer by transfer number
  findByTransferNumber(transferNumber: string): Transfer | null {
    const stmt = this.db.prepare(`
      SELECT 
        t.*,
        u1.full_name as requested_by_name,
        u2.full_name as approved_by_name
      FROM property_transfers t
      LEFT JOIN users u1 ON t.requested_by = u1.id
      LEFT JOIN users u2 ON t.approved_by = u2.id
      WHERE t.transfer_number = ?
    `);

    const row = stmt.get(transferNumber) as any;
    if (!row) return null;

    return this.mapRowToTransfer(row);
  }

  // Get all transfers with pagination and filtering
  findAll(options: {
    limit?: number;
    offset?: number;
    status?: string;
    transferType?: string;
    fromDepartment?: string;
    toDepartment?: string;
    search?: string;
  } = {}): Transfer[] {
    const { limit = 100, offset = 0, status, transferType, fromDepartment, toDepartment, search } = options;
    
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (status) {
      whereClause += ' AND t.status = ?';
      params.push(status);
    }

    if (transferType) {
      whereClause += ' AND t.transfer_type = ?';
      params.push(transferType);
    }

    if (fromDepartment) {
      whereClause += ' AND t.from_department = ?';
      params.push(fromDepartment);
    }

    if (toDepartment) {
      whereClause += ' AND t.to_department = ?';
      params.push(toDepartment);
    }

    if (search) {
      whereClause += ' AND (t.transfer_number LIKE ? OR t.reason LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    const stmt = this.db.prepare(`
      SELECT 
        t.*,
        u1.full_name as requested_by_name,
        u2.full_name as approved_by_name
      FROM property_transfers t
      LEFT JOIN users u1 ON t.requested_by = u1.id
      LEFT JOIN users u2 ON t.approved_by = u2.id
      ${whereClause}
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(...params, limit, offset) as any[];
    return rows.map(row => this.mapRowToTransfer(row));
  }

  // Update transfer
  update(id: string, updates: Partial<Transfer>): Transfer | null {
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
      UPDATE property_transfers 
      SET ${fields.join(', ')}, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(...values);
    return this.findById(id);
  }

  // Delete transfer
  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM property_transfers WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Add item to transfer
  addItem(transferId: string, item: Omit<TransferItem, 'id' | 'transferId' | 'createdAt'>): TransferItem {
    const id = `TI-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      INSERT INTO transfer_items (
        id, transfer_id, property_number, description, quantity, condition, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      transferId,
      item.propertyNumber,
      item.description,
      item.quantity,
      item.condition,
      now
    );

    return this.findItemById(id)!;
  }

  // Get all items for a transfer
  getItems(transferId: string): TransferItem[] {
    const stmt = this.db.prepare(`
      SELECT * FROM transfer_items 
      WHERE transfer_id = ? 
      ORDER BY created_at ASC
    `);
    
    const rows = stmt.all(transferId) as any[];
    return rows.map(row => this.mapRowToTransferItem(row));
  }

  // Update transfer item
  updateItem(id: string, updates: Partial<TransferItem>): TransferItem | null {
    const existing = this.findItemById(id);
    if (!existing) return null;

    const fields = [];
    const values = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'transferId' && key !== 'createdAt' && value !== undefined) {
        const dbKey = this.camelToSnakeCase(key);
        fields.push(`${dbKey} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) return existing;

    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE transfer_items 
      SET ${fields.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);
    return this.findItemById(id);
  }

  // Delete transfer item
  deleteItem(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM transfer_items WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Find transfer item by ID
  findItemById(id: string): TransferItem | null {
    const stmt = this.db.prepare('SELECT * FROM transfer_items WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return null;

    return this.mapRowToTransferItem(row);
  }

  // Get transfer with items
  getWithItems(id: string): (Transfer & { items: TransferItem[] }) | null {
    const transfer = this.findById(id);
    if (!transfer) return null;

    const items = this.getItems(id);
    return { ...transfer, items };
  }

  // Approve transfer
  approve(id: string, approvedBy: string): Transfer | null {
    return this.update(id, {
      status: 'In Transit',
      approvedBy,
      dateApproved: new Date().toISOString().split('T')[0]
    });
  }

  // Complete transfer
  complete(id: string): Transfer | null {
    return this.update(id, {
      status: 'Completed',
      dateCompleted: new Date().toISOString().split('T')[0]
    });
  }

  // Reject transfer
  reject(id: string): Transfer | null {
    return this.update(id, {
      status: 'Rejected'
    });
  }

  // Get transfer statistics
  getStatistics(): {
    totalTransfers: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
  } {
    const totalTransfers = this.db.prepare('SELECT COUNT(*) as count FROM property_transfers').get() as { count: number };
    
    const byStatus = this.db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM property_transfers 
      GROUP BY status
    `).all() as { status: string; count: number }[];

    const byType = this.db.prepare(`
      SELECT transfer_type, COUNT(*) as count 
      FROM property_transfers 
      GROUP BY transfer_type
    `).all() as { transfer_type: string; count: number }[];

    return {
      totalTransfers: totalTransfers.count,
      byStatus: byStatus.reduce((acc, item) => ({ ...acc, [item.status]: item.count }), {}),
      byType: byType.reduce((acc, item) => ({ ...acc, [item.transfer_type]: item.count }), {}),
    };
  }

  // Helper method to map database row to Transfer
  private mapRowToTransfer(row: any): Transfer {
    return {
      id: row.id,
      transferNumber: row.transfer_number,
      fromDepartment: row.from_department,
      toDepartment: row.to_department,
      transferType: row.transfer_type,
      status: row.status,
      requestedBy: row.requested_by,
      approvedBy: row.approved_by,
      dateRequested: row.date_requested,
      dateApproved: row.date_approved,
      dateCompleted: row.date_completed,
      reason: row.reason,
      remarks: row.remarks,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // Helper method to map database row to TransferItem
  private mapRowToTransferItem(row: any): TransferItem {
    return {
      id: row.id,
      transferId: row.transfer_id,
      propertyNumber: row.property_number,
      description: row.description,
      quantity: row.quantity,
      condition: row.condition,
      createdAt: row.created_at,
    };
  }

  // Helper method to convert camelCase to snake_case
  private camelToSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}
