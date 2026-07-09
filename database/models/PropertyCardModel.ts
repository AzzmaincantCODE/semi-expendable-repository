import { getDatabase } from '../config';

export interface PropertyCard {
  id: string;
  entityName: string;
  fundCluster: string;
  semiExpendableProperty: string;
  propertyNumber: string;
  description: string;
  dateAcquired: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SPCEntry {
  id: string;
  propertyCardId: string;
  date: string;
  reference: string;
  receiptQty: number;
  unitCost: number;
  totalCost: number;
  issueItemNo: string;
  issueQty: number;
  officeOfficer: string;
  balanceQty: number;
  amount: number;
  createdAt: string;
  updatedAt: string;
}

export class PropertyCardModel {
  private db = getDatabase();

  // Create a new property card
  create(card: Omit<PropertyCard, 'id' | 'createdAt' | 'updatedAt'>): PropertyCard {
    const id = `PC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      INSERT INTO property_cards (
        id, entity_name, fund_cluster, semi_expendable_property,
        property_number, description, date_acquired, remarks, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      card.entityName,
      card.fundCluster,
      card.semiExpendableProperty,
      card.propertyNumber,
      card.description,
      card.dateAcquired,
      card.remarks || null,
      now,
      now
    );

    return this.findById(id)!;
  }

  // Find property card by ID
  findById(id: string): PropertyCard | null {
    const stmt = this.db.prepare('SELECT * FROM property_cards WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return null;

    return this.mapRowToPropertyCard(row);
  }

  // Find property card by property number
  findByPropertyNumber(propertyNumber: string): PropertyCard | null {
    const stmt = this.db.prepare('SELECT * FROM property_cards WHERE property_number = ?');
    const row = stmt.get(propertyNumber) as any;
    if (!row) return null;

    return this.mapRowToPropertyCard(row);
  }

  // Get all property cards with pagination and filtering
  findAll(options: {
    limit?: number;
    offset?: number;
    search?: string;
    fundCluster?: string;
  } = {}): PropertyCard[] {
    const { limit = 100, offset = 0, search, fundCluster } = options;
    
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (search) {
      whereClause += ' AND (property_number LIKE ? OR description LIKE ? OR entity_name LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (fundCluster) {
      whereClause += ' AND fund_cluster = ?';
      params.push(fundCluster);
    }

    const stmt = this.db.prepare(`
      SELECT * FROM property_cards 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(...params, limit, offset) as any[];
    return rows.map(row => this.mapRowToPropertyCard(row));
  }

  // Update property card
  update(id: string, updates: Partial<PropertyCard>): PropertyCard | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: any[] = [];

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
      UPDATE property_cards 
      SET ${fields.join(', ')}, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(...values);
    return this.findById(id);
  }

  // Delete property card
  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM property_cards WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Add entry to property card
  addEntry(propertyCardId: string, entry: Omit<SPCEntry, 'id' | 'propertyCardId' | 'createdAt' | 'updatedAt'>): SPCEntry {
    const id = `SPC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      INSERT INTO property_card_entries (
        id, property_card_id, date, reference, receipt_qty, unit_cost,
        total_cost, issue_item_no, issue_qty, office_officer, balance_qty,
        amount, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      propertyCardId,
      entry.date,
      entry.reference,
      entry.receiptQty,
      entry.unitCost,
      entry.totalCost,
      entry.issueItemNo,
      entry.issueQty,
      entry.officeOfficer,
      entry.balanceQty,
      entry.amount,
      now,
      now
    );

    return this.findEntryById(id)!;
  }

  // Get all entries for a property card
  getEntries(propertyCardId: string): SPCEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM property_card_entries 
      WHERE property_card_id = ? 
      ORDER BY date ASC
    `);
    
    const rows = stmt.all(propertyCardId) as any[];
    return rows.map(row => this.mapRowToSPCEntry(row));
  }

  // Update entry
  updateEntry(id: string, updates: Partial<SPCEntry>): SPCEntry | null {
    const existing = this.findEntryById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'propertyCardId' && key !== 'createdAt' && value !== undefined) {
        const dbKey = this.camelToSnakeCase(key);
        fields.push(`${dbKey} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) return existing;

    values.push(new Date().toISOString(), id);

    const stmt = this.db.prepare(`
      UPDATE property_card_entries 
      SET ${fields.join(', ')}, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(...values);
    return this.findEntryById(id);
  }

  // Delete entry
  deleteEntry(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM property_card_entries WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Find entry by ID
  findEntryById(id: string): SPCEntry | null {
    const stmt = this.db.prepare('SELECT * FROM property_card_entries WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return null;

    return this.mapRowToSPCEntry(row);
  }

  // Get property card with entries
  getWithEntries(id: string): (PropertyCard & { entries: SPCEntry[] }) | null {
    const card = this.findById(id);
    if (!card) return null;

    const entries = this.getEntries(id);
    return { ...card, entries };
  }

  // Helper method to map database row to PropertyCard
  private mapRowToPropertyCard(row: any): PropertyCard {
    return {
      id: row.id,
      entityName: row.entity_name,
      fundCluster: row.fund_cluster,
      semiExpendableProperty: row.semi_expendable_property,
      propertyNumber: row.property_number,
      description: row.description,
      dateAcquired: row.date_acquired,
      remarks: row.remarks,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // Helper method to map database row to SPCEntry
  private mapRowToSPCEntry(row: any): SPCEntry {
    return {
      id: row.id,
      propertyCardId: row.property_card_id,
      date: row.date,
      reference: row.reference,
      receiptQty: row.receipt_qty,
      unitCost: row.unit_cost,
      totalCost: row.total_cost,
      issueItemNo: row.issue_item_no,
      issueQty: row.issue_qty,
      officeOfficer: row.office_officer,
      balanceQty: row.balance_qty,
      amount: row.amount,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // Helper method to convert camelCase to snake_case
  private camelToSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}
