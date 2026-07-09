import { getDatabase } from '../config';

export interface UnserviceableReport {
  id: string;
  reportNumber: string;
  reportDate: string;
  department: string;
  inspectedBy: string[];
  reviewPeriod: string;
  totalValue: number;
  createdAt: string;
  updatedAt: string;
}

export interface UnserviceableReportItem {
  id: string;
  reportId: string;
  propertyNumber: string;
  description: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  dateAcquired: string;
  condition: string;
  defects: string;
  recommendation: 'Repair' | 'Condemn' | 'Donate' | 'Sell';
  estimatedRepairCost?: number;
  createdAt: string;
}

export class UnserviceableReportModel {
  private db = getDatabase();

  // Create a new unserviceable report
  create(report: Omit<UnserviceableReport, 'id' | 'createdAt' | 'updatedAt'>): UnserviceableReport {
    const id = `UR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      INSERT INTO unserviceable_reports (
        id, report_number, report_date, department, inspected_by,
        review_period, total_value, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      report.reportNumber,
      report.reportDate,
      report.department,
      JSON.stringify(report.inspectedBy),
      report.reviewPeriod,
      report.totalValue,
      now,
      now
    );

    return this.findById(id)!;
  }

  // Find unserviceable report by ID
  findById(id: string): UnserviceableReport | null {
    const stmt = this.db.prepare('SELECT * FROM unserviceable_reports WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return null;

    return this.mapRowToUnserviceableReport(row);
  }

  // Find unserviceable report by report number
  findByReportNumber(reportNumber: string): UnserviceableReport | null {
    const stmt = this.db.prepare('SELECT * FROM unserviceable_reports WHERE report_number = ?');
    const row = stmt.get(reportNumber) as any;
    if (!row) return null;

    return this.mapRowToUnserviceableReport(row);
  }

  // Get all unserviceable reports with pagination and filtering
  findAll(options: {
    limit?: number;
    offset?: number;
    department?: string;
    search?: string;
  } = {}): UnserviceableReport[] {
    const { limit = 100, offset = 0, department, search } = options;
    
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (department) {
      whereClause += ' AND department = ?';
      params.push(department);
    }

    if (search) {
      whereClause += ' AND (report_number LIKE ? OR department LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    const stmt = this.db.prepare(`
      SELECT * FROM unserviceable_reports 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(...params, limit, offset) as any[];
    return rows.map(row => this.mapRowToUnserviceableReport(row));
  }

  // Update unserviceable report
  update(id: string, updates: Partial<UnserviceableReport>): UnserviceableReport | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const fields = [];
    const values = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'createdAt' && value !== undefined) {
        const dbKey = this.camelToSnakeCase(key);
        if (key === 'inspectedBy') {
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
      UPDATE unserviceable_reports 
      SET ${fields.join(', ')}, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(...values);
    return this.findById(id);
  }

  // Delete unserviceable report
  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM unserviceable_reports WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Add item to unserviceable report
  addItem(reportId: string, item: Omit<UnserviceableReportItem, 'id' | 'reportId' | 'createdAt'>): UnserviceableReportItem {
    const id = `URI-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      INSERT INTO unserviceable_report_items (
        id, report_id, property_number, description, quantity, unit_cost,
        total_cost, date_acquired, condition, defects, recommendation,
        estimated_repair_cost, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      reportId,
      item.propertyNumber,
      item.description,
      item.quantity,
      item.unitCost,
      item.totalCost,
      item.dateAcquired,
      item.condition,
      item.defects,
      item.recommendation,
      item.estimatedRepairCost || null,
      now
    );

    return this.findItemById(id)!;
  }

  // Get all items for an unserviceable report
  getItems(reportId: string): UnserviceableReportItem[] {
    const stmt = this.db.prepare(`
      SELECT * FROM unserviceable_report_items 
      WHERE report_id = ? 
      ORDER BY created_at ASC
    `);
    
    const rows = stmt.all(reportId) as any[];
    return rows.map(row => this.mapRowToUnserviceableReportItem(row));
  }

  // Update unserviceable report item
  updateItem(id: string, updates: Partial<UnserviceableReportItem>): UnserviceableReportItem | null {
    const existing = this.findItemById(id);
    if (!existing) return null;

    const fields = [];
    const values = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'reportId' && key !== 'createdAt' && value !== undefined) {
        const dbKey = this.camelToSnakeCase(key);
        fields.push(`${dbKey} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) return existing;

    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE unserviceable_report_items 
      SET ${fields.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);
    return this.findItemById(id);
  }

  // Delete unserviceable report item
  deleteItem(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM unserviceable_report_items WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Find unserviceable report item by ID
  findItemById(id: string): UnserviceableReportItem | null {
    const stmt = this.db.prepare('SELECT * FROM unserviceable_report_items WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return null;

    return this.mapRowToUnserviceableReportItem(row);
  }

  // Get unserviceable report with items
  getWithItems(id: string): (UnserviceableReport & { items: UnserviceableReportItem[] }) | null {
    const report = this.findById(id);
    if (!report) return null;

    const items = this.getItems(id);
    return { ...report, items };
  }

  // Calculate total value for a report
  calculateTotalValue(reportId: string): number {
    const stmt = this.db.prepare(`
      SELECT SUM(total_cost) as total 
      FROM unserviceable_report_items 
      WHERE report_id = ?
    `);

    const result = stmt.get(reportId) as any;
    return result.total || 0;
  }

  // Update total value for a report
  updateTotalValue(reportId: string): UnserviceableReport | null {
    const totalValue = this.calculateTotalValue(reportId);
    return this.update(reportId, { totalValue });
  }

  // Helper method to map database row to UnserviceableReport
  private mapRowToUnserviceableReport(row: any): UnserviceableReport {
    return {
      id: row.id,
      reportNumber: row.report_number,
      reportDate: row.report_date,
      department: row.department,
      inspectedBy: JSON.parse(row.inspected_by || '[]'),
      reviewPeriod: row.review_period,
      totalValue: row.total_value,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // Helper method to map database row to UnserviceableReportItem
  private mapRowToUnserviceableReportItem(row: any): UnserviceableReportItem {
    return {
      id: row.id,
      reportId: row.report_id,
      propertyNumber: row.property_number,
      description: row.description,
      quantity: row.quantity,
      unitCost: row.unit_cost,
      totalCost: row.total_cost,
      dateAcquired: row.date_acquired,
      condition: row.condition,
      defects: row.defects,
      recommendation: row.recommendation,
      estimatedRepairCost: row.estimated_repair_cost,
      createdAt: row.created_at,
    };
  }

  // Helper method to convert camelCase to snake_case
  private camelToSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}
