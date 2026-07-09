// Auto-Backup Excel Export Utility
// Uses the xlsx library to generate Excel workbooks from all Supabase tables
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (v: any) => (v == null ? '' : v);
const fmtCurrency = (v: any) => (v == null ? '' : Number(v).toFixed(2));
const fmtDate = (v: any) => {
  if (!v) return '';
  try { return new Date(v).toLocaleDateString('en-PH'); } catch { return v; }
};
const dateTag = () => new Date().toISOString().slice(0, 10);

function saveWorkbook(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}

function addSheet(wb: XLSX.WorkBook, name: string, rows: any[][]) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  // Auto-fit column widths (rough heuristic)
  const colWidths = rows[0]?.map((_: any, ci: number) =>
    Math.min(50, Math.max(10, ...rows.map(r => String(r[ci] ?? '').length)))
  ) ?? [];
  ws['!cols'] = colWidths.map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
}

// ─── 1. Inventory ────────────────────────────────────────────────────────────

export async function exportInventoryToExcel(standalone = true): Promise<XLSX.WorkBook> {
  const { data: items } = await supabase
    .from('inventory_items')
    .select('*')
    .order('created_at', { ascending: false });

  const header = [
    'Property #', 'Description', 'Brand', 'Model', 'Serial No.',
    'Unit', 'Qty', 'Unit Cost (₱)', 'Total Cost (₱)',
    'Condition', 'Status', 'Assignment', 'Custodian', 'Custodian Position',
    'Sub-Category', 'Category', 'Fund Source ID', 'Supplier ID',
    'Date Acquired', 'Warranty End', 'Lifespan End',
    'Remarks', 'Entity Name', 'Created At'
  ];

  const all = (items || []).map(i => [
    fmt(i.property_number), fmt(i.description), fmt(i.brand), fmt(i.model), fmt(i.serial_number),
    fmt(i.unit_of_measure), fmt(i.quantity), fmtCurrency(i.unit_cost), fmtCurrency(i.total_cost),
    fmt(i.condition), fmt(i.status), fmt(i.assignment_status), fmt(i.custodian), fmt(i.custodian_position),
    fmt(i.sub_category), fmt(i.semi_expandable_category), fmt(i.fund_source_id), fmt(i.supplier_id),
    fmtDate(i.date_acquired), fmtDate(i.warranty_end_date), fmtDate(i.lifespan_end_date),
    fmt(i.remarks), fmt(i.entity_name), fmtDate(i.created_at)
  ]);

  const highValue = all.filter((_, idx) => (items || [])[idx]?.sub_category === 'High Value Expendable');
  const lowValue = all.filter((_, idx) => (items || [])[idx]?.sub_category !== 'High Value Expendable');

  const wb = XLSX.utils.book_new();
  addSheet(wb, 'All Inventory', [header, ...all]);
  addSheet(wb, 'High Value Items', [header, ...highValue]);
  addSheet(wb, 'Low Value Items', [header, ...lowValue]);

  if (standalone) saveWorkbook(wb, `Inventory-Backup-${dateTag()}.xlsx`);
  return wb;
}

// ─── 2. ICS / Custodian Slips ─────────────────────────────────────────────

export async function exportICSToExcel(standalone = true): Promise<XLSX.WorkBook> {
  const { data: slips } = await supabase
    .from('custodian_slips')
    .select('*, custodian_slip_items(*)')
    .order('created_at', { ascending: false });

  const slipHeader = [
    'ICS #', 'Date Issued', 'Custodian Name', 'Designation', 'Office',
    'Issued By', 'Issued By Position', 'Received By', 'Status', 'Created At'
  ];

  const itemHeader = [
    'ICS #', 'Date Issued', 'Custodian', 'Office',
    'Property #', 'Description', 'Qty', 'Unit', 'Unit Cost (₱)', 'Total Cost (₱)',
    'Estimated Useful Life', 'Amount (₱)'
  ];

  const slipRows = (slips || []).map(s => [
    fmt(s.slip_number), fmtDate(s.date_issued), fmt(s.custodian_name),
    fmt(s.designation), fmt(s.office), fmt(s.issued_by), fmt(s.issued_by_position),
    fmt(s.received_by), fmt(s.slip_status), fmtDate(s.created_at)
  ]);

  const itemRows: any[][] = [];
  (slips || []).forEach(s => {
    (s.custodian_slip_items || []).forEach((i: any) => {
      itemRows.push([
        fmt(s.slip_number), fmtDate(s.date_issued), fmt(s.custodian_name), fmt(s.office),
        fmt(i.property_number), fmt(i.description),
        fmt(i.quantity), fmt(i.unit), fmtCurrency(i.unit_cost), fmtCurrency(i.total_cost),
        fmt(i.estimated_useful_life), fmtCurrency(i.amount)
      ]);
    });
  });

  const wb = XLSX.utils.book_new();
  addSheet(wb, 'ICS Slips', [slipHeader, ...slipRows]);
  addSheet(wb, 'ICS Items', [itemHeader, ...itemRows]);

  if (standalone) saveWorkbook(wb, `ICS-Backup-${dateTag()}.xlsx`);
  return wb;
}

// ─── 3. Property Cards ───────────────────────────────────────────────────────

export async function exportPropertyCardsToExcel(standalone = true): Promise<XLSX.WorkBook> {
  const { data: cards } = await supabase
    .from('property_cards')
    .select('*, property_card_entries(*)')
    .order('created_at', { ascending: false });

  const cardHeader = [
    'Property #', 'Description', 'Entity Name', 'Fund Cluster',
    'Semi-Expendable Property', 'Date Acquired', 'Remarks', 'Created At'
  ];

  const entryHeader = [
    'Property #', 'Entry Date', 'Reference', 'Receipt Qty', 'Unit Cost (₱)',
    'Total Cost (₱)', 'Issue Item No', 'Issue Qty', 'Office/Officer',
    'Balance Qty', 'Amount (₱)', 'Remarks'
  ];

  const cardRows = (cards || []).map(c => [
    fmt(c.property_number), fmt(c.description), fmt(c.entity_name),
    fmt(c.fund_cluster), fmt(c.semi_expendable_property),
    fmtDate(c.date_acquired), fmt(c.remarks), fmtDate(c.created_at)
  ]);

  const entryRows: any[][] = [];
  (cards || []).forEach(c => {
    (c.property_card_entries || []).forEach((e: any) => {
      entryRows.push([
        fmt(c.property_number), fmtDate(e.date), fmt(e.reference),
        fmt(e.receipt_qty), fmtCurrency(e.unit_cost), fmtCurrency(e.total_cost),
        fmt(e.issue_item_no), fmt(e.issue_qty), fmt(e.office_officer),
        fmt(e.balance_qty), fmtCurrency(e.amount), fmt(e.remarks)
      ]);
    });
  });

  const wb = XLSX.utils.book_new();
  addSheet(wb, 'Property Cards', [cardHeader, ...cardRows]);
  addSheet(wb, 'Card Entries', [entryHeader, ...entryRows]);

  if (standalone) saveWorkbook(wb, `PropertyCards-Backup-${dateTag()}.xlsx`);
  return wb;
}

// ─── 4. Transfers (ITR) ──────────────────────────────────────────────────────

export async function exportTransfersToExcel(standalone = true): Promise<XLSX.WorkBook> {
  const { data: transfers } = await supabase
    .from('property_transfers')
    .select('*, transfer_items(*)')
    .order('created_at', { ascending: false });

  const tHeader = [
    'Transfer #', 'Transfer Type', 'Date', 'From Office', 'To Office',
    'From Custodian', 'To Custodian', 'Purpose/Reason', 'Status', 'Created At'
  ];

  const itemHeader = [
    'Transfer #', 'Transfer Type', 'Date',
    'Property #', 'Description', 'Qty', 'Unit Cost (₱)', 'Total Cost (₱)', 'Remarks'
  ];

  const tRows = (transfers || []).map(t => [
    fmt(t.transfer_number || t.itr_number), fmt(t.transfer_type), fmtDate(t.transfer_date || t.date),
    fmt(t.from_office), fmt(t.to_office), fmt(t.from_custodian), fmt(t.to_custodian),
    fmt(t.purpose || t.reason), fmt(t.status), fmtDate(t.created_at)
  ]);

  const itemRows: any[][] = [];
  (transfers || []).forEach(t => {
    (t.transfer_items || []).forEach((i: any) => {
      itemRows.push([
        fmt(t.transfer_number || t.itr_number), fmt(t.transfer_type), fmtDate(t.transfer_date || t.date),
        fmt(i.property_number), fmt(i.description),
        fmt(i.quantity), fmtCurrency(i.unit_cost), fmtCurrency(i.total_cost), fmt(i.remarks)
      ]);
    });
  });

  const wb = XLSX.utils.book_new();
  addSheet(wb, 'Transfers', [tHeader, ...tRows]);
  addSheet(wb, 'Transfer Items', [itemHeader, ...itemRows]);

  if (standalone) saveWorkbook(wb, `Transfers-Backup-${dateTag()}.xlsx`);
  return wb;
}

// ─── 5. Purchase Orders ──────────────────────────────────────────────────────

export async function exportPurchaseOrdersToExcel(standalone = true): Promise<XLSX.WorkBook> {
  const { data: pos } = await supabase
    .from('purchase_orders')
    .select('*, purchase_order_items(*)')
    .order('created_at', { ascending: false });

  const poHeader = [
    'PO #', 'Supplier', 'Fund Source', 'Date', 'Status',
    'Total Amount (₱)', 'Remarks', 'Created At'
  ];

  const itemHeader = [
    'PO #', 'Item No', 'Description', 'Unit', 'Qty',
    'Unit Cost (₱)', 'Total Cost (₱)', 'Estimated Useful Life'
  ];

  const poRows = (pos || []).map(p => [
    fmt(p.po_number), fmt(p.supplier_name || p.supplier_id), fmt(p.fund_source),
    fmtDate(p.date || p.po_date), fmt(p.status),
    fmtCurrency(p.total_amount), fmt(p.remarks), fmtDate(p.created_at)
  ]);

  const itemRows: any[][] = [];
  (pos || []).forEach(p => {
    (p.purchase_order_items || []).forEach((i: any) => {
      itemRows.push([
        fmt(p.po_number), fmt(i.item_number || i.item_no),
        fmt(i.description), fmt(i.unit), fmt(i.quantity),
        fmtCurrency(i.unit_cost), fmtCurrency(i.total_cost),
        fmt(i.estimated_useful_life)
      ]);
    });
  });

  const wb = XLSX.utils.book_new();
  addSheet(wb, 'Purchase Orders', [poHeader, ...poRows]);
  addSheet(wb, 'PO Items', [itemHeader, ...itemRows]);

  if (standalone) saveWorkbook(wb, `PurchaseOrders-Backup-${dateTag()}.xlsx`);
  return wb;
}

// ─── 6. Physical Count ───────────────────────────────────────────────────────

export async function exportPhysicalCountToExcel(standalone = true): Promise<XLSX.WorkBook> {
  const { data: reports } = await supabase
    .from('physical_count_reports')
    .select('*, physical_count_items(*)')
    .order('created_at', { ascending: false });

  const rHeader = [
    'Report #', 'Date', 'Entity Name', 'Fund Cluster', 'As Of Date',
    'Prepared By', 'Approved By', 'Status', 'Created At'
  ];

  const itemHeader = [
    'Report #', 'Property #', 'Description', 'Unit',
    'On Hand Qty', 'Short/Over', 'Unit Value (₱)', 'Total Value (₱)', 'Remarks'
  ];

  const rRows = (reports || []).map(r => [
    fmt(r.report_number), fmtDate(r.date), fmt(r.entity_name), fmt(r.fund_cluster),
    fmtDate(r.as_of_date), fmt(r.prepared_by), fmt(r.approved_by),
    fmt(r.status), fmtDate(r.created_at)
  ]);

  const itemRows: any[][] = [];
  (reports || []).forEach(r => {
    (r.physical_count_items || []).forEach((i: any) => {
      itemRows.push([
        fmt(r.report_number), fmt(i.property_number), fmt(i.description),
        fmt(i.unit), fmt(i.on_hand_qty), fmt(i.short_over),
        fmtCurrency(i.unit_value), fmtCurrency(i.total_value), fmt(i.remarks)
      ]);
    });
  });

  const wb = XLSX.utils.book_new();
  addSheet(wb, 'Physical Count Reports', [rHeader, ...rRows]);
  addSheet(wb, 'Physical Count Items', [itemHeader, ...itemRows]);

  if (standalone) saveWorkbook(wb, `PhysicalCount-Backup-${dateTag()}.xlsx`);
  return wb;
}

// ─── 7. Loss Reports ─────────────────────────────────────────────────────────

export async function exportLossReportsToExcel(standalone = true): Promise<XLSX.WorkBook> {
  const { data: reports } = await supabase
    .from('loss_reports')
    .select('*')
    .order('created_at', { ascending: false });

  const header = [
    'Report #', 'Property #', 'Description', 'Date of Loss',
    'Custodian', 'Designation', 'Office',
    'Circumstances', 'Status', 'Amount (₱)', 'Remarks', 'Created At'
  ];

  const rows = (reports || []).map(r => [
    fmt(r.report_number), fmt(r.property_number), fmt(r.description),
    fmtDate(r.date_of_loss), fmt(r.custodian_name), fmt(r.designation), fmt(r.office),
    fmt(r.circumstances), fmt(r.status), fmtCurrency(r.amount),
    fmt(r.remarks), fmtDate(r.created_at)
  ]);

  const wb = XLSX.utils.book_new();
  addSheet(wb, 'Loss Reports', [header, ...rows]);

  if (standalone) saveWorkbook(wb, `LossReports-Backup-${dateTag()}.xlsx`);
  return wb;
}

// ─── 8. Registry (ICS Registry) ─────────────────────────────────────────────

export async function exportRegistryToExcel(standalone = true): Promise<XLSX.WorkBook> {
  const { data: registry } = await supabase
    .from('ics_registry')
    .select('*, ics_registry_rows(*)')
    .order('created_at', { ascending: false });

  const regHeader = [
    'Registry #', 'Entity Name', 'Fund Cluster', 'Accountable Officer',
    'Designation', 'Station', 'Period', 'Created At'
  ];

  const rowHeader = [
    'Registry #', 'Date', 'ICS No', 'Property #',
    'Description', 'Qty', 'Amount (₱)', 'Remarks'
  ];

  const regRows = (registry || []).map(r => [
    fmt(r.registry_number || r.id), fmt(r.entity_name), fmt(r.fund_cluster),
    fmt(r.accountable_officer), fmt(r.designation), fmt(r.station),
    fmt(r.period), fmtDate(r.created_at)
  ]);

  const rowData: any[][] = [];
  (registry || []).forEach(r => {
    (r.ics_registry_rows || []).forEach((row: any) => {
      rowData.push([
        fmt(r.registry_number || r.id), fmtDate(row.date),
        fmt(row.ics_no), fmt(row.property_number),
        fmt(row.description), fmt(row.quantity),
        fmtCurrency(row.amount), fmt(row.remarks)
      ]);
    });
  });

  const wb = XLSX.utils.book_new();
  addSheet(wb, 'Registry', [regHeader, ...regRows]);
  addSheet(wb, 'Registry Rows', [rowHeader, ...rowData]);

  if (standalone) saveWorkbook(wb, `Registry-Backup-${dateTag()}.xlsx`);
  return wb;
}

// ─── 9. Returns (RRSP) ───────────────────────────────────────────────────────

export async function exportReturnsToExcel(standalone = true): Promise<XLSX.WorkBook> {
  const { data: returns } = await supabase
    .from('return_receipts')
    .select('*, return_receipt_items(*)')
    .order('created_at', { ascending: false });

  const rHeader = [
    'Return #', 'Date Returned', 'Custodian', 'Designation', 'Office',
    'Received By', 'Remarks', 'Status', 'Created At'
  ];

  const itemHeader = [
    'Return #', 'Date Returned', 'Property #', 'Description',
    'Qty', 'Unit', 'Unit Cost (₱)', 'Total Cost (₱)', 'Condition', 'Remarks'
  ];

  const rRows = (returns || []).map(r => [
    fmt(r.return_number || r.rrsp_number), fmtDate(r.date_returned || r.return_date),
    fmt(r.custodian_name), fmt(r.designation), fmt(r.office),
    fmt(r.received_by), fmt(r.remarks), fmt(r.status), fmtDate(r.created_at)
  ]);

  const itemRows: any[][] = [];
  (returns || []).forEach(r => {
    (r.return_receipt_items || []).forEach((i: any) => {
      itemRows.push([
        fmt(r.return_number || r.rrsp_number), fmtDate(r.date_returned || r.return_date),
        fmt(i.property_number), fmt(i.description),
        fmt(i.quantity), fmt(i.unit), fmtCurrency(i.unit_cost), fmtCurrency(i.total_cost),
        fmt(i.condition), fmt(i.remarks)
      ]);
    });
  });

  const wb = XLSX.utils.book_new();
  addSheet(wb, 'Returns (RRSP)', [rHeader, ...rRows]);
  addSheet(wb, 'Return Items', [itemHeader, ...itemRows]);

  if (standalone) saveWorkbook(wb, `Returns-Backup-${dateTag()}.xlsx`);
  return wb;
}

// ─── 10. RSPI (Weekly Reports) ───────────────────────────────────────────────

export async function exportRSPIToExcel(standalone = true): Promise<XLSX.WorkBook> {
  const { data: reports } = await supabase
    .from('weekly_property_reports')
    .select('*, weekly_property_report_items(*)')
    .order('created_at', { ascending: false });

  const rHeader = [
    'Report #', 'Week Ending', 'Entity Name', 'Fund Cluster',
    'Prepared By', 'Status', 'Created At'
  ];

  const itemHeader = [
    'Report #', 'Week Ending', 'Property #', 'Description',
    'Qty Received', 'Qty Issued', 'Balance', 'Unit Cost (₱)', 'Total Value (₱)'
  ];

  const rRows = (reports || []).map(r => [
    fmt(r.report_number), fmtDate(r.week_ending || r.date),
    fmt(r.entity_name), fmt(r.fund_cluster),
    fmt(r.prepared_by), fmt(r.status), fmtDate(r.created_at)
  ]);

  const itemRows: any[][] = [];
  (reports || []).forEach(r => {
    (r.weekly_property_report_items || []).forEach((i: any) => {
      itemRows.push([
        fmt(r.report_number), fmtDate(r.week_ending || r.date),
        fmt(i.property_number), fmt(i.description),
        fmt(i.qty_received), fmt(i.qty_issued), fmt(i.balance),
        fmtCurrency(i.unit_cost), fmtCurrency(i.total_value)
      ]);
    });
  });

  const wb = XLSX.utils.book_new();
  addSheet(wb, 'RSPI Reports', [rHeader, ...rRows]);
  addSheet(wb, 'RSPI Items', [itemHeader, ...itemRows]);

  if (standalone) saveWorkbook(wb, `RSPI-Backup-${dateTag()}.xlsx`);
  return wb;
}

// ─── Full Backup (All in One) ────────────────────────────────────────────────

export async function exportFullBackupToExcel(): Promise<void> {
  // Fetch all workbooks in parallel (standalone=false so they don't each save individually)
  const [invWb, icsWb, pcWb, trWb, poWb, physWb, lossWb, regWb, retWb, rspiWb] = await Promise.all([
    exportInventoryToExcel(false),
    exportICSToExcel(false),
    exportPropertyCardsToExcel(false),
    exportTransfersToExcel(false),
    exportPurchaseOrdersToExcel(false),
    exportPhysicalCountToExcel(false),
    exportLossReportsToExcel(false),
    exportRegistryToExcel(false),
    exportReturnsToExcel(false),
    exportRSPIToExcel(false),
  ]);

  const master = XLSX.utils.book_new();

  // Merge all sheets from each workbook into the master
  const mergeSheets = (source: XLSX.WorkBook) => {
    source.SheetNames.forEach(name => {
      const sheetName = name.slice(0, 31);
      // Avoid duplicate sheet names
      let finalName = sheetName;
      let suffix = 2;
      while (master.SheetNames.includes(finalName)) {
        finalName = `${sheetName.slice(0, 28)} ${suffix++}`;
      }
      XLSX.utils.book_append_sheet(master, source.Sheets[name], finalName);
    });
  };

  [invWb, icsWb, pcWb, trWb, poWb, physWb, lossWb, regWb, retWb, rspiWb].forEach(mergeSheets);

  saveWorkbook(master, `SemiProperty-FullBackup-${dateTag()}.xlsx`);
}

// ─── Last Exported Timestamps (localStorage) ─────────────────────────────────

const LS_KEY = 'semi_property_last_exported';

export interface LastExported {
  inventory?: string;
  ics?: string;
  propertyCards?: string;
  transfers?: string;
  purchaseOrders?: string;
  physicalCount?: string;
  lossReports?: string;
  registry?: string;
  returns?: string;
  rspi?: string;
  fullBackup?: string;
}

export function getLastExported(): LastExported {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  } catch {
    return {};
  }
}

export function setLastExported(key: keyof LastExported) {
  const current = getLastExported();
  current[key] = new Date().toLocaleString('en-PH');
  localStorage.setItem(LS_KEY, JSON.stringify(current));
}
