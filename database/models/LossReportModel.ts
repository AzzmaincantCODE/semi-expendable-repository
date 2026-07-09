import { getDatabase } from '../config';

export interface LossReport {
  id: string;
  reportNumber: string;
  department: string;
  reportDate: string;
  incidentDate: string;
  reportType: 'Lost' | 'Stolen' | 'Damaged' | 'Destroyed';
  status: 'Draft' | 'Submitted' | 'Under Investigation' | 'Approved' | 'Rejected';
  reportedBy: string;
  investigatedBy?: string;
  approvedBy?: string;
  totalLossAmount: number;
  incidentDescription: string;
  actionsTaken?: string;
  recommendations?: string;
  attachments: string[];
  createdAt: string;
  updatedAt: string;
}

export interface LossReportItem {
  id: string;
  reportId: string;
  propertyNumber: string;
  description: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  dateAcquired: string;
  condition: 'Lost' | 'Stolen' | 'Damaged' | 'Destroyed';
  circumstances: string;
  createdAt: string;
}

export class LossReportModel {
  private db = getDatabase();

  // Create a new loss report
  create(report: Omit<LossReport, 'id' | 'createdAt' | 'updatedAt'>): LossReport {
    const id = `LR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      INSERT INTO loss_reports (
        id, report_number, department, report_date, incident_date, report_type,
        status, reported_by, investigated_by, approved_by, total_loss_amount,
        incident_description, actions_taken, recommendations, attachments, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      report.reportNumber,
      report.department,
      report.reportDate,
      report.incidentDate,
      report.reportType,
      report.status,
      report.reportedBy,
      report.investigatedBy || null,
      report.approvedBy || null,
      report.totalLossAmount,
      report.incidentDescription,
      report.actionsTaken || null,
      report.recommendations || null,
      JSON.stringify(report.attachments),
      now,
      now
    );

    return this.findById(id)!;
  }

  // Find loss report by ID
  findById(id: string): LossReport | null {
    const stmt = this.db.prepare(`
      SELECT 
        l.*,
        u1.full_name as reported_by_name,
        u2.full_name as investigated_by_name,
        u3.full_name as approved_by_name
      FROM loss_reports l
      LEFT JOIN users u1 ON l.reported_by = u1.id
      LEFT JOIN users u2 ON l.investigated_by = u2.id
      LEFT JOIN users u3 ON l.approved_by = u3.id
      WHERE l.id = ?
    `);

    const row = stmt.get(id) as any;
    if (!row) return null;

    return this.mapRowToLossReport(row);
  }

  // Find loss report by report number
  findByReportNumber(reportNumber: string): LossReport | null {
    const stmt = this.db.prepare(`
      SELECT 
        l.*,
        u1.full_name as reported_by_name,
        u2.full_name as investigated_by_name,
        u3.full_name as approved_by_name
      FROM loss_reports l
      LEFT JOIN users u1 ON l.reported_by = u1.id
      LEFT JOIN users u2 ON l.investigated_by = u2.id
      LEFT JOIN users u3 ON l.approved_by = u3.id
      WHERE l.report_number = ?
    `);

    const row = stmt.get(reportNumber) as any;
    if (!row) return null;

    return this.mapRowToLossReport(row);
  }

  // Get all loss reports with pagination and filtering
  findAll(options: {
    limit?: number;
    offset?: number;
    status?: string;
    reportType?: string;
    department?: string;
    search?: string;
  } = {}): LossReport[] {
    const { limit = 100, offset = 0, status, reportType, department, search } = options;
    
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (status) {
      whereClause += ' AND l.status = ?';
      params.push(status);
    }

    if (reportType) {
      whereClause += ' AND l.report_type = ?';
      params.push(reportType);
    }

    if (department) {
      whereClause += ' AND l.department = ?';
      params.push(department);
    }

    if (search) {
      whereClause += ' AND (l.report_number LIKE ? OR l.incident_description LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    const stmt = this.db.prepare(`
      SELECT 
        l.*,
        u1.full_name as reported_by_name,
        u2.full_name as investigated_by_name,
        u3.full_name as approved_by_name
      FROM loss_reports l
      LEFT JOIN users u1 ON l.reported_by = u1.id
      LEFT JOIN users u2 ON l.investigated_by = u2.id
      LEFT JOIN users u3 ON l.approved_by = u3.id
      ${whereClause}
      ORDER BY l.created_at DESC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(...params, limit, offset) as any[];
    return rows.map(row => this.mapRowToLossReport(row));
  }

  // Update loss report
  update(id: string, updates: Partial<LossReport>): LossReport | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const fields = [];
    const values = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'createdAt' && value !== undefined) {
        const dbKey = this.camelToSnakeCase(key);
        if (key === 'attachments') {
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
      UPDATE loss_reports 
      SET ${fields.join(', ')}, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(...values);
    return this.findById(id);
  }

  // Delete loss report
  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM loss_reports WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Add item to loss report
  addItem(reportId: string, item: Omit<LossReportItem, 'id' | 'reportId' | 'createdAt'>): LossReportItem {
    const id = `LRI-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      INSERT INTO loss_report_items (
        id, report_id, property_number, description, quantity, unit_cost,
        total_cost, date_acquired, condition, circumstances, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      item.circumstances,
      now
    );

    return this.findItemById(id)!;
  }

  // Get all items for a loss report
  getItems(reportId: string): LossReportItem[] {
    const stmt = this.db.prepare(`
      SELECT * FROM loss_report_items 
      WHERE report_id = ? 
      ORDER BY created_at ASC
    `);
    
    const rows = stmt.all(reportId) as any[];
    return rows.map(row => this.mapRowToLossReportItem(row));
  }

  // Update loss report item
  updateItem(id: string, updates: Partial<LossReportItem>): LossReportItem | null {
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
      UPDATE loss_report_items 
      SET ${fields.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);
    return this.findItemById(id);
  }

  // Delete loss report item
  deleteItem(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM loss_report_items WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Find loss report item by ID
  findItemById(id: string): LossReportItem | null {
    const stmt = this.db.prepare('SELECT * FROM loss_report_items WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return null;

    return this.mapRowToLossReportItem(row);
  }

  // Get loss report with items
  getWithItems(id: string): (LossReport & { items: LossReportItem[] }) | null {
    const report = this.findById(id);
    if (!report) return null;

    const items = this.getItems(id);
    return { ...report, items };
  }

  // Calculate total loss amount for a report
  calculateTotalLoss(reportId: string): number {
    const stmt = this.db.prepare(`
      SELECT SUM(total_cost) as total 
      FROM loss_report_items 
      WHERE report_id = ?
    `);

    const result = stmt.get(reportId) as any;
    return result.total || 0;
  }

  // Update total loss amount for a report
  updateTotalLoss(reportId: string): LossReport | null {
    const totalLoss = this.calculateTotalLoss(reportId);
    return this.update(reportId, { totalLossAmount: totalLoss });
  }

  // Submit report for investigation
  submit(reportId: string): LossReport | null {
    return this.update(reportId, { status: 'Submitted' });
  }

  // Approve report
  approve(reportId: string, approvedBy: string): LossReport | null {
    return this.update(reportId, { 
      status: 'Approved',
      approvedBy 
    });
  }

  // Reject report
  reject(reportId: string): LossReport | null {
    return this.update(reportId, { status: 'Rejected' });
  }

  // Helper method to map database row to LossReport
  private mapRowToLossReport(row: any): LossReport {
    return {
      id: row.id,
      reportNumber: row.report_number,
      department: row.department,
      reportDate: row.report_date,
      incidentDate: row.incident_date,
      reportType: row.report_type,
      status: row.status,
      reportedBy: row.reported_by,
      investigatedBy: row.investigated_by,
      approvedBy: row.approved_by,
      totalLossAmount: row.total_loss_amount,
      incidentDescription: row.incident_description,
      actionsTaken: row.actions_taken,
      recommendations: row.recommendations,
      attachments: JSON.parse(row.attachments || '[]'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // Helper method to map database row to LossReportItem
  private mapRowToLossReportItem(row: any): LossReportItem {
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
      circumstances: row.circumstances,
      createdAt: row.created_at,
    };
  }

  // Helper method to convert camelCase to snake_case
  private camelToSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}
