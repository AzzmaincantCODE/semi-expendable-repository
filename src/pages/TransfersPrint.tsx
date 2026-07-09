import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Download } from "lucide-react";
import headerLogo from "@/assets/HEADERLOGO.png";
import { DescriptionWithSN } from "@/components/reports/DescriptionWithSN";
import { PrintDocumentLayout } from "@/components/print/PrintDocumentLayout";
import { printDocument } from "@/lib/printDocument";
import { PRINT_LAYOUT } from "@/lib/printLayouts";
import { exportToExcel } from "@/lib/excelExport";

type TransferStatus = "Draft" | "Issued" | "Completed" | "Rejected";
type TransferType = "Donation" | "Reassignment" | "Relocate" | "Others";

interface TransferItem {
  propertyNumber: string;
  description: string;
  quantity: number;
  unit?: string;
  serialNumber?: string;
  condition: string;
  dateAcquired?: string;
  amount?: number;
  unitCost?: number;
  icsSlipId?: string;
  icsSlipNumber?: string;
  icsDate?: string;
  inventoryItemId?: string;
  custodianName?: string;
}

interface Transfer {
  id: string;
  entityName: string;
  fromAccountableOfficer: string;
  fromAccountableOfficerDepartment?: string;
  fromAccountableOfficerDesignation?: string;
  toAccountableOfficer: string;
  toAccountableOfficerDepartment?: string;
  toAccountableOfficerDesignation?: string;
  fundCluster: string;
  itrNumber: string;
  date: string;
  transferType: TransferType;
  otherTransferType?: string;
  reason: string;
  status: TransferStatus;
  dateCompleted?: string;
  items: TransferItem[];
  approvedBy?: string;
  approvedByDesignation?: string;
  issuedBy?: string;
  issuedByDesignation?: string;
  receivedBy?: string;
  receivedByDesignation?: string;
  createdAt: string;
}

const TRANSFER_TYPES: TransferType[] = ["Donation", "Reassignment", "Relocate", "Others"];

const DB_TO_UI_STATUS: Record<string, TransferStatus> = {
  Draft: "Draft",
  Issued: "Issued",
  Completed: "Completed",
  Rejected: "Rejected",
  Pending: "Draft",
  "In Transit": "Issued",
};

const formatDate = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
};

const getOfficerFontSize = (name: string) => {
  if (!name) return "text-sm";
  const words = name.trim().split(/\s+/);
  if (words.length > 3 || name.length > 20) {
    return "text-[11px] leading-tight";
  }
  return "text-sm";
};

const formatCurrency = (value?: number) => {
  if (value === undefined || value === null) return "";
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
};

const resolveTransferTypeFromRecord = (record: any): TransferType => {
  const choice = record.transfer_type_choice;
  if (choice && (TRANSFER_TYPES as string[]).includes(choice as TransferType)) {
    return choice as TransferType;
  }

  const reasonLower = (record.reason || "").toLowerCase();
  if (reasonLower.includes("donat")) return "Donation";
  if (reasonLower.includes("reassign")) return "Reassignment";
  if (reasonLower.includes("relocat")) return "Relocate";
  if (reasonLower.includes("loan") || reasonLower.includes("borrow")) return "Others";

  switch (record.transfer_type) {
    case "Temporary":
      return "Relocate";
    case "Loan":
      return "Others";
    case "Permanent":
    default:
      return "Reassignment";
  }
};

export const TransfersPrint = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: transfer, isLoading, error } = useQuery({
    queryKey: ["transfer-print", id],
    queryFn: async (): Promise<Transfer> => {
      const richSelection = `
        id,
        transfer_number,
        from_department,
        to_department,
        transfer_type,
        transfer_type_choice,
        status,
        requested_by,
        approved_by,
        date_requested,
        date_approved,
        date_completed,
        reason,
        remarks,
        created_at,
        entity_name,
        fund_cluster,
        transfer_items (
          id,
          property_number,
          description,
          quantity,
          condition,
          inventory_item_id,
          from_custodian,
          to_custodian
        )
      `;

      const { data: record, error: fetchError } = await supabase
        .from("property_transfers")
        .select(richSelection)
        .eq("id", id!)
        .single();

      if (fetchError || !record) {
        throw new Error(fetchError?.message || "Transfer not found");
      }

      // Gather custodian metadata
      const officerNames = [record.from_department, record.to_department].filter(Boolean) as string[];
      const custodianMeta = new Map<string, { department?: string; designation?: string }>();

      if (officerNames.length) {
        const { data: custodianRows } = await supabase
          .from("custodians")
          .select(`
            name,
            position,
            departments!custodians_department_id_fkey (
              name
            )
          `)
          .in("name", officerNames);

        if (custodianRows) {
          custodianRows.forEach((row: any) => {
            custodianMeta.set(row.name.toLowerCase(), {
              department: row.departments?.name,
              designation: row.position,
            });
          });
        }
      }

      // Gather all inventory item lookups
      const allInvIds = (record.transfer_items || [])
        .map((item: any) => item.inventory_item_id)
        .filter(Boolean);
      const allPropNumbers = (record.transfer_items || [])
        .map((item: any) => item.property_number)
        .filter(Boolean);
      const allCustodians = (record.transfer_items || [])
        .map((item: any) => item.from_custodian)
        .filter(Boolean);

      const [invByIdRows, slipItemsByInvIdRows, invByPropRows, slipItemsByPropRows, slipByCustodianRows] = await Promise.all([
        allInvIds.length
          ? supabase.from("inventory_items")
            .select("id, date_acquired, unit_cost, total_cost, serial_number, description")
            .in("id", allInvIds)
            .then(r => r.data || [])
          : Promise.resolve([]),

        allInvIds.length
          ? supabase.from("custodian_slip_items")
            .select("inventory_item_id, custodian_slips!inner(slip_number, date_issued)")
            .in("inventory_item_id", allInvIds)
            .order("created_at", { ascending: false })
            .then(r => r.data || [])
          : Promise.resolve([]),

        allPropNumbers.length
          ? supabase.from("inventory_items")
            .select("property_number, date_acquired, unit_cost, total_cost, serial_number, description")
            .in("property_number", allPropNumbers)
            .then(r => r.data || [])
          : Promise.resolve([]),

        allPropNumbers.length
          ? supabase.from("custodian_slip_items")
            .select("property_number, date_issued, custodian_slips!inner(slip_number, date_issued)")
            .in("property_number", allPropNumbers)
            .order("date_issued", { ascending: false })
            .then(r => r.data || [])
          : Promise.resolve([]),

        allCustodians.length
          ? supabase.from("custodian_slips")
            .select("custodian_name, slip_number, date_issued")
            .in("custodian_name", allCustodians)
            .order("date_issued", { ascending: false })
            .then(r => r.data || [])
          : Promise.resolve([]),
      ]);

      const invById = new Map<string, any>();
      const invByProp = new Map<string, any>();
      const slipByInvId = new Map<string, any>();
      const slipByProp = new Map<string, any>();
      const slipByCust = new Map<string, any>();

      for (const row of invByIdRows) if (row.id && !invById.has(row.id)) invById.set(row.id, row);
      for (const row of invByPropRows) if (row.property_number && !invByProp.has(row.property_number)) invByProp.set(row.property_number, row);
      for (const row of slipItemsByInvIdRows) {
        if (row.inventory_item_id && !slipByInvId.has(row.inventory_item_id)) {
          const slip = Array.isArray(row.custodian_slips) ? row.custodian_slips[0] : row.custodian_slips;
          if (slip?.slip_number) slipByInvId.set(row.inventory_item_id, slip);
        }
      }
      for (const row of slipItemsByPropRows) {
        if (row.property_number && !slipByProp.has(row.property_number)) {
          const slip = Array.isArray(row.custodian_slips) ? row.custodian_slips[0] : row.custodian_slips;
          if (slip?.slip_number) slipByProp.set(row.property_number, { slip_number: slip.slip_number, date_issued: row.date_issued || slip.date_issued });
        }
      }
      for (const row of slipByCustodianRows) {
        if (row.custodian_name && !slipByCust.has(row.custodian_name)) slipByCust.set(row.custodian_name, row);
      }

      const fromMeta = record.from_department ? custodianMeta.get(record.from_department.toLowerCase()) : undefined;
      const toMeta = record.to_department ? custodianMeta.get(record.to_department.toLowerCase()) : undefined;

      const enrichedItems = (record.transfer_items || []).map((item: any) => {
        const fromCustodian = item.from_custodian;
        const invRowById = item.inventory_item_id ? invById.get(item.inventory_item_id) : undefined;
        const invRowByProp = invByProp.get(item.property_number);
        const invRow = invRowById ?? invRowByProp;

        const dateAcquired = invRow?.date_acquired ?? null;
        const amount = invRow ? (invRow.total_cost || invRow.unit_cost || null) : null;
        const unitCost = invRow?.unit_cost ?? null;
        const serialNumber = invRow?.serial_number ?? null;

        const slipById = item.inventory_item_id ? slipByInvId.get(item.inventory_item_id) : undefined;
        const slipByPropRow = slipByProp.get(item.property_number);
        const slipByCustRow = fromCustodian ? slipByCust.get(fromCustodian) : undefined;
        const icsEntry = slipById ?? slipByPropRow ?? slipByCustRow;

        const icsSlipNumber = icsEntry?.slip_number ?? null;
        const icsDate = icsEntry?.date_issued ?? null;

        return {
          propertyNumber: item.property_number,
          description: invRow?.description || item.description,
          quantity: item.quantity,
          condition: item.condition,
          inventoryItemId: item.inventory_item_id,
          icsSlipNumber,
          icsDate,
          amount,
          unitCost,
          dateAcquired,
          serialNumber: serialNumber || undefined,
        };
      });

      return {
        id: record.id,
        entityName: record.entity_name || "PROVINCIAL GOVERNMENT OF APAYAO",
        fromAccountableOfficer: record.from_department,
        fromAccountableOfficerDepartment: fromMeta?.department,
        fromAccountableOfficerDesignation: fromMeta?.designation,
        toAccountableOfficer: record.to_department,
        toAccountableOfficerDepartment: toMeta?.department,
        toAccountableOfficerDesignation: toMeta?.designation,
        fundCluster: record.fund_cluster || "",
        itrNumber: record.transfer_number,
        date: record.date_requested,
        transferType: resolveTransferTypeFromRecord(record),
        reason: record.reason,
        status: DB_TO_UI_STATUS[record.status] || "Draft",
        dateCompleted: record.date_completed,
        items: enrichedItems,
        approvedBy: (() => {
          const r = record.remarks || '';
          if (r.startsWith('APPROVER::')) {
            const parts = r.replace('APPROVER::', '').split('||');
            return parts[0] || '';
          }
          return '';
        })(),
        approvedByDesignation: (() => {
          const r = record.remarks || '';
          if (r.startsWith('APPROVER::')) {
            const parts = r.replace('APPROVER::', '').split('||');
            return parts[1] || '';
          }
          return '';
        })(),
        issuedBy: (() => {
          const r = record.remarks || '';
          if (r.startsWith('APPROVER::')) {
            const parts = r.replace('APPROVER::', '').split('||');
            return parts[2] || record.requested_by || '';
          }
          return record.requested_by || '';
        })(),
        issuedByDesignation: (() => {
          const r = record.remarks || '';
          if (r.startsWith('APPROVER::')) {
            const parts = r.replace('APPROVER::', '').split('||');
            return parts[3] || '';
          }
          return '';
        })(),
        receivedBy: record.received_by || record.to_department || (() => {
          const r = record.remarks || '';
          if (r.startsWith('APPROVER::')) {
            const parts = r.replace('APPROVER::', '').split('||');
            return parts[4] || '';
          }
          return '';
        })(),
        receivedByDesignation: (() => {
          const r = record.remarks || '';
          if (r.startsWith('APPROVER::')) {
            const parts = r.replace('APPROVER::', '').split('||');
            return parts[5] || '';
          }
          return '';
        })(),
        createdAt: record.created_at,
      };
    },
    enabled: !!id,
  });

  const handlePrint = () => printDocument(PRINT_LAYOUT.A4_PORTRAIT);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8 text-muted-foreground animate-pulse">
          Loading transfer details...
        </div>
      </div>
    );
  }

  if (error || !transfer) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8 text-red-600 bg-white shadow rounded-lg border">
          Transfer report not found.
        </div>
      </div>
    );
  }

  const blankRows = Math.max(9 - items.length, 0);
  const getDynamicFontSize = (text: string, baseSize: number = 13) => {
    if (!text) return `${baseSize}px`;
    if (text.length > 30) return `${baseSize - 3}px`;
    if (text.length > 20) return `${baseSize - 1.5}px`;
    return `${baseSize}px`;
  };

  const renderIcsCell = (item: TransferItem) => {
    let slipNum = item.icsSlipNumber;
    if (slipNum) {
      if (!slipNum.toUpperCase().startsWith("ICS")) {
        slipNum = `ICS ${slipNum}`;
      }
      slipNum = slipNum.replace(/^ICS-/i, 'ICS ');
    }
    if (slipNum && item.icsDate) return `${slipNum} / ${item.icsDate}`;
    if (slipNum) return slipNum;
    if (item.icsDate) return item.icsDate;
    return "\u00A0";
  };

  return (
    <PrintDocumentLayout
      layout={PRINT_LAYOUT.A4_PORTRAIT}
      className="min-h-screen bg-gray-100 py-8 print:p-0 print:bg-white text-black"
    >
      {/* Floating Action Controls */}
      <div className="no-print fixed top-4 right-4 z-50 flex gap-2 pr-12">
        <Button onClick={() => {
            if (transfer && transfer.items) {
                const data = transfer.items.map((item: any, idx: number) => ({
                    "ITR No.": transfer.itrNumber?.replace(/-(SPHV|SPLV)-/i, '-'),
                    "Transfer Date": transfer.date ? formatDate(transfer.date) : "",
                    "From Officer": transfer.fromAccountableOfficer,
                    "To Officer": transfer.toAccountableOfficer,
                    "Item No.": idx + 1,
                    "Property No.": item.propertyNumber || "",
                    "Description": item.description || "",
                    "Quantity": item.quantity,
                    "Unit Cost": item.unitCost || 0,
                    "Total Cost": item.amount || 0,
                    "Condition": item.condition || ""
                }));
                exportToExcel(data, `ITR_${transfer.itrNumber}.xlsx`, 'Transfer Report');
            }
        }} className="gap-2 shadow-lg bg-emerald-600 hover:bg-emerald-700 text-white">
          <Download className="h-4 w-4" /> Export to Excel
        </Button>
        <Button onClick={handlePrint} className="gap-2 shadow-lg bg-orange-600 hover:bg-orange-700 text-white">
          <Printer className="h-4 w-4" /> Print ITR
        </Button>
        <Button variant="outline" onClick={() => navigate(-1)} className="gap-2 shadow-lg bg-white">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>

      {/* Official A4 Document Container */}
      <div
        className="mx-auto bg-white shadow-2xl print:shadow-none p-[12mm] w-[210mm] min-h-[297mm] border border-gray-200 print:border-none print:w-full print:p-0 print:m-0 flex flex-col gap-4"
        style={{ fontFamily: "'Times New Roman', serif" }}
      >
        <div className="bg-white text-black mx-auto overflow-hidden print:w-full print:p-0 print:m-0 print:border-none print:shadow-none print-page-a4 flex flex-col gap-4">
          {/* Top Header Section */}
          <div className="w-full">
            <div className="w-full mb-2 flex flex-col items-center">
              <img src={headerLogo} alt="Official Header" className="w-full h-auto object-contain" />
            </div>
            
            <div className="w-full text-right text-sm italic font-semibold pr-2">
              Annex A.5
            </div>
            
            <div className="text-center mb-2 mt-1">
              <h1 className="text-lg font-bold tracking-wide">INVENTORY TRANSFER REPORT</h1>
            </div>

            <div className="flex justify-between items-center text-sm mb-1 px-2">
              <div className="flex items-center whitespace-nowrap overflow-hidden flex-1 mr-8">
                <span className="mr-2 text-xs font-semibold shrink-0">Entity Name:</span>
                <span className="text-sm font-bold underline tracking-wide uppercase truncate">
                  {transfer.entityName || "PROVINCIAL GOVERNMENT OF APAYAO"}
                </span>
              </div>
              <div className="flex items-center whitespace-nowrap shrink-0">
                <span className="mr-2 text-xs font-semibold shrink-0">Fund Cluster:</span>
                <span className="text-sm font-bold underline tracking-wide uppercase">
                  {transfer.fundCluster || "GENERAL FUND"}
                </span>
              </div>
            </div>
          </div>

          <div className="border-2 border-black p-0 mb-0 bg-white shrink">
            <div className="grid grid-cols-[minmax(0,1fr)_220px] border-b border-black">
              <div className="border-r border-black flex flex-col pt-1 pb-1 min-w-0">
                <div className="px-2 flex flex-wrap items-baseline mb-1">
                  <span className="mr-2 text-sm font-normal shrink-0">From Accountable Officer/Agency/Fund Cluster:</span>
                  <span className={`font-bold underline uppercase tracking-wide break-words whitespace-normal ${getOfficerFontSize(transfer.fromAccountableOfficer || '')}`}>
                    {transfer.fromAccountableOfficer}
                  </span>
                </div>
                <div className="px-2 flex flex-wrap items-baseline">
                  <span className="mr-2 text-sm font-normal shrink-0">To Accountable Officer/Agency/Fund Cluster:</span>
                  <span className={`font-bold underline uppercase tracking-wide break-words whitespace-normal ${getOfficerFontSize(transfer.toAccountableOfficer || '')}`}>
                    {transfer.toAccountableOfficer}
                  </span>
                </div>
              </div>
              <div className="flex flex-col pt-1 pb-1">
                <div className="px-2 flex items-center mb-1 whitespace-nowrap overflow-hidden">
                  <span className="mr-2 shrink-0 text-sm font-normal w-[65px]">ITR No.:</span>
                  <span className="text-sm font-bold underline uppercase tracking-wide flex-1 text-center truncate">
                    {transfer.itrNumber ? transfer.itrNumber.replace(/-(SPHV|SPLV)-/i, '-') : ''}
                  </span>
                </div>
                <div className="px-2 flex items-center whitespace-nowrap overflow-hidden">
                  <span className="mr-2 shrink-0 text-sm font-normal w-[65px]">Date:</span>
                  <span className="text-sm font-bold underline uppercase tracking-wide flex-1 text-center truncate">
                    {formatDate(transfer.date)}
                  </span>
                </div>
              </div>
            </div>

            <div className="py-0.5 px-2 border-b border-black shrink">
              <div className="text-sm mb-0.5">Transfer Type: (check only one)</div>
              <div className="grid grid-cols-2 gap-y-0.5 gap-x-12 text-sm ml-[10%] max-w-[80%] pb-0.5">
                <label className="flex items-center space-x-2">
                  <input type="checkbox" checked={transfer.transferType === 'Donation'} readOnly className="h-3 w-3 bg-white border-black" />
                  <span>Donation</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" checked={transfer.transferType === 'Relocate'} readOnly className="h-3 w-3 bg-white border-black" />
                  <span>Relocate</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" checked={transfer.transferType === 'Reassignment'} readOnly className="h-3 w-3 bg-white border-black" />
                  <span>Reassignment</span>
                </label>
                <div className="flex items-center space-x-2 w-full">
                  <label className="flex items-center space-x-2 shrink-0">
                    <input type="checkbox" checked={transfer.transferType === 'Others'} readOnly className="h-3 w-3 bg-white border-black" />
                    <span className="whitespace-nowrap">Others (Specify)</span>
                  </label>
                  <div className="flex-1 border-b border-black min-w-[150px] h-4 leading-none">{transfer.otherTransferType}</div>
                </div>
              </div>
            </div>

            <table className="w-full border-collapse bg-white shrink text-sm">
              <thead>
                <tr className="print:bg-white font-serif">
                  <th className="border border-black p-1 text-center align-middle font-bold w-[10%] leading-tight">Date<br/>Acquired</th>
                  <th className="border border-black p-1 text-center align-middle font-bold w-[9%] leading-tight">Item No.</th>
                  <th className="border border-black p-1 text-center align-middle font-bold w-[11%] leading-tight">ICS No.<br/>/Date</th>
                  <th className="border border-black p-1 text-center align-middle font-bold w-[28%]">Description</th>
                  <th className="border border-black p-1 text-center align-middle font-bold w-[6%]">Qty</th>
                  <th className="border border-black p-1 text-center align-middle font-bold w-[11%]">Unit Cost</th>
                  <th className="border border-black p-1 text-center align-middle font-bold w-[11%]">Amount</th>
                  <th className="border border-black p-1 text-center align-middle font-bold w-[14%] leading-tight">Condition of<br/>Inventory</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index} className="align-top text-xs font-serif">
                    <td className="border border-black p-1 text-center align-middle">{item.dateAcquired || '-'}</td>
                    <td className="border border-black p-1 text-center font-bold align-middle">
                      {item.propertyNumber || (index + 1)}
                    </td>
                    <td className="border border-black p-1 text-center align-middle font-bold">{renderIcsCell(item)}</td>
                    <td className="border border-black p-1 font-bold">
                      <DescriptionWithSN
                        description={item.description}
                        serialNumber={item.serialNumber}
                      />
                    </td>
                    <td className="border border-black p-1 text-center align-middle font-bold">{item.quantity}</td>
                    <td className="border border-black p-1 text-right align-middle">{(item.amount ? formatCurrency(item.amount / (item.quantity || 1)) : '-')}</td>
                    <td className="border border-black p-1 text-right align-middle font-bold">{item.amount !== undefined ? formatCurrency(item.amount) : '-'}</td>
                    <td className="border border-black p-1 text-center align-middle font-bold italic">{item.condition}</td>
                  </tr>
                ))}
                {Array.from({ length: blankRows }).map((_, i) => (
                  <tr key={`blank-${i}`} className="h-[24px]">
                    <td className="border border-black p-0">&nbsp;</td>
                    <td className="border border-black p-0">&nbsp;</td>
                    <td className="border border-black p-0">&nbsp;</td>
                    <td className="border border-black p-0">&nbsp;</td>
                    <td className="border border-black p-0">&nbsp;</td>
                    <td className="border border-black p-0">&nbsp;</td>
                    <td className="border border-black p-0">&nbsp;</td>
                    <td className="border border-black p-0">&nbsp;</td>
                  </tr>
                ))}
                <tr>
                  <td className="border border-black p-1 font-serif" colSpan={6} align="right"><span className="font-bold mr-2">TOTAL</span></td>
                  <td className="border border-black p-1 text-right font-bold font-serif font-mono">
                    {formatCurrency(items.reduce((sum, item) => sum + (item.amount || 0), 0))}
                  </td>
                  <td className="border border-black p-1"></td>
                </tr>
              </tbody>
            </table>

            <div className="border-b border-black px-2 py-1">
              <span className="text-sm">Reason for Transfer:</span>
              <div className="text-sm font-bold uppercase pl-1">{transfer.reason}</div>
            </div>

            <div className="flex text-[13px] pt-1 font-serif">
              <div className="w-[14%]"></div>
              <div className="w-[28.6%] text-center">Approved by:</div>
              <div className="w-[28.6%] text-center">Released/Issued by:</div>
              <div className="w-[28.8%] text-center">Received by:</div>
            </div>

            <div className="text-[13px] px-1 pb-1 font-serif">
              <div className="flex mt-1">
                <div className="w-[14%] pl-1">Signature:</div>
                <div className="w-[28.6%] mx-2 border-b border-black h-5"></div>
                <div className="w-[28.6%] mx-2 border-b border-black h-5"></div>
                <div className="w-[28.8%] mx-2 border-b border-black h-5"></div>
              </div>

              <div className="flex">
                <div className="w-[14%] pl-1">Name:</div>
                <div className="w-[28.6%] mx-2 text-center font-bold border-b border-black">{transfer.approvedBy || "\u00A0"}</div>
                <div className="w-[28.6%] mx-2 text-center font-bold border-b border-black">{transfer.issuedBy || transfer.fromAccountableOfficer}</div>
                <div className="w-[28.8%] mx-2 text-center font-bold border-b border-black">{transfer.receivedBy || transfer.toAccountableOfficer}</div>
              </div>

              <div className="flex mt-2">
                <div className="w-[14%] pl-1">Designation:</div>
                <div className="w-[28.6%] mx-2 text-center text-xs italic border-b border-black">{transfer.approvedByDesignation || "\u00A0"}</div>
                <div className="w-[28.6%] mx-2 text-center text-xs italic border-b border-black">{transfer.issuedByDesignation || transfer.issuedBy || "\u00A0"}</div>
                <div className="w-[28.8%] mx-2 text-center text-xs italic border-b border-black">{transfer.receivedByDesignation || transfer.receivedBy || "\u00A0"}</div>
              </div>

              <div className="flex mt-2">
                <div className="w-[14%] pl-1">Date:</div>
                <div className="w-[28.6%] mx-2 text-center border-b border-black">{transfer.date ? formatDate(transfer.date) : "\u00A0"}</div>
                <div className="w-[28.6%] mx-2 text-center border-b border-black">{transfer.date ? formatDate(transfer.date) : "\u00A0"}</div>
                <div className="w-[28.8%] mx-2 text-center border-b border-black">{transfer.date ? formatDate(transfer.date) : "\u00A0"}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          html, body {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
          }
        }
      `}</style>
    </PrintDocumentLayout>
  );
};
