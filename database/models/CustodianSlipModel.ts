import { getDatabase } from '../config';

export interface CustodianSlip {
  id: string;
  slipNumber: string;
  custodianName: string;
  designation: string;
  office: string;
  dateIssued: string;
  issuedBy: string;
  receivedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustodianSlipItem {
  id: string;
  slipId: string;
  propertyNumber: string;
  description: string;
  quantity: number;
  unit: string;
  dateIssued: string;
  createdAt: string;
}

export class CustodianSlipModel {
  private db = getDatabase();

  // Create a new custodian slip
  create(slip: Omit<CustodianSlip, 'id' | 'createdAt' | 'updatedAt'>): CustodianSlip {
    const id = `CS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      INSERT INTO custodian_slips (
        id, slip_number, custodian_name, designation, office,
        date_issued, issued_by, received_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      slip.slipNumber,
      slip.custodianName,
      slip.designation,
      slip.office,
      slip.dateIssued,
      slip.issuedBy,
      slip.receivedBy,
      now,
      now
    );

    return this.findById(id)!;
  }

  // Find custodian slip by ID
  findById(id: string): CustodianSlip | null {
    const stmt = this.db.prepare(`
      SELECT 
        c.*,
        u.full_name as issued_by_name
      FROM custodian_slips c
      LEFT JOIN users u ON c.issued_by = u.id
      WHERE c.id = ?
    `);

    const row = stmt.get(id) as any;
    if (!row) return null;

    return this.mapRowToCustodianSlip(row);
  }

  // Find custodian slip by slip number
  findBySlipNumber(slipNumber: string): CustodianSlip | null {
    const stmt = this.db.prepare(`
      SELECT 
        c.*,
        u.full_name as issued_by_name
      FROM custodian_slips c
      LEFT JOIN users u ON c.issued_by = u.id
      WHERE c.slip_number = ?
    `);

    const row = stmt.get(slipNumber) as any;
    if (!row) return null;

    return this.mapRowToCustodianSlip(row);
  }

  // Get all custodian slips with pagination and filtering
  findAll(options: {
    limit?: number;
    offset?: number;
    search?: string;
    office?: string;
  } = {}): CustodianSlip[] {
    const { limit = 100, offset = 0, search, office } = options;
    
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (search) {
      whereClause += ' AND (c.slip_number LIKE ? OR c.custodian_name LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (office) {
      whereClause += ' AND c.office = ?';
      params.push(office);
    }

    const stmt = this.db.prepare(`
      SELECT 
        c.*,
        u.full_name as issued_by_name
      FROM custodian_slips c
      LEFT JOIN users u ON c.issued_by = u.id
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(...params, limit, offset) as any[];
    return rows.map(row => this.mapRowToCustodianSlip(row));
  }

  // Update custodian slip
  update(id: string, updates: Partial<CustodianSlip>): CustodianSlip | null {
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
      UPDATE custodian_slips 
      SET ${fields.join(', ')}, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(...values);
    return this.findById(id);
  }

  // Delete custodian slip
  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM custodian_slips WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Add item to custodian slip
  addItem(slipId: string, item: Omit<CustodianSlipItem, 'id' | 'slipId' | 'createdAt'>): CustodianSlipItem {
    const id = `CSI-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      INSERT INTO custodian_slip_items (
        id, slip_id, property_number, description, quantity, unit, date_issued, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      slipId,
      item.propertyNumber,
      item.description,
      item.quantity,
      item.unit,
      item.dateIssued,
      now
    );

    return this.findItemById(id)!;
  }

  // Get all items for a custodian slip
  getItems(slipId: string): CustodianSlipItem[] {
    const stmt = this.db.prepare(`
      SELECT * FROM custodian_slip_items 
      WHERE slip_id = ? 
      ORDER BY created_at ASC
    `);
    
    const rows = stmt.all(slipId) as any[];
    return rows.map(row => this.mapRowToCustodianSlipItem(row));
  }

  // Update custodian slip item
  updateItem(id: string, updates: Partial<CustodianSlipItem>): CustodianSlipItem | null {
    const existing = this.findItemById(id);
    if (!existing) return null;

    const fields = [];
    const values = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'slipId' && key !== 'createdAt' && value !== undefined) {
        const dbKey = this.camelToSnakeCase(key);
        fields.push(`${dbKey} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) return existing;

    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE custodian_slip_items 
      SET ${fields.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);
    return this.findItemById(id);
  }

  // Delete custodian slip item
  deleteItem(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM custodian_slip_items WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Find custodian slip item by ID
  findItemById(id: string): CustodianSlipItem | null {
    const stmt = this.db.prepare('SELECT * FROM custodian_slip_items WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return null;

    return this.mapRowToCustodianSlipItem(row);
  }

  // Get custodian slip with items
  getWithItems(id: string): (CustodianSlip & { items: CustodianSlipItem[] }) | null {
    const slip = this.findById(id);
    if (!slip) return null;

    const items = this.getItems(id);
    return { ...slip, items };
  }

  // Helper method to map database row to CustodianSlip
  private mapRowToCustodianSlip(row: any): CustodianSlip {
    return {
      id: row.id,
      slipNumber: row.slip_number,
      custodianName: row.custodian_name,
      designation: row.designation,
      office: row.office,
      dateIssued: row.date_issued,
      issuedBy: row.issued_by,
      receivedBy: row.received_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // Helper method to map database row to CustodianSlipItem
  private mapRowToCustodianSlipItem(row: any): CustodianSlipItem {
    return {
      id: row.id,
      slipId: row.slip_id,
      propertyNumber: row.property_number,
      description: row.description,
      quantity: row.quantity,
      unit: row.unit,
      dateIssued: row.date_issued,
      createdAt: row.created_at,
    };
  }

  // Helper method to convert camelCase to snake_case
  private camelToSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}
