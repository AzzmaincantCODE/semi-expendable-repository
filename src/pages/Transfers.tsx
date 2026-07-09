import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CustodianSelector } from "@/components/ui/custodian-selector";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { getNewestRecordId, isWithinRecentThreshold } from "@/lib/utils";
import { DescriptionWithSN } from "@/components/reports/DescriptionWithSN";
import type { Custodian } from "@/services/custodianService";
import { Printer, Search, Plus, CheckCircle, Clock, AlertCircle, Loader2, Download, History, ChevronDown, ChevronUp } from "lucide-react";
import logo from "@/assets/Logo-Bagong-Pilipinas.png";
import gsoLogo from "@/assets/gso lgo.jpg";
import headerLogo from "@/assets/HEADERLOGO.png";
import { PrintDocumentLayout } from "@/components/print/PrintDocumentLayout";
import { printDocument } from "@/lib/printDocument";
import { PRINT_LAYOUT } from "@/lib/printLayouts";
import { PageHeader } from "@/components/ui/page-header";

type TransferStatus = "Draft" | "Issued" | "Completed" | "Rejected";
type TransferType = "Donation" | "Reassignment" | "Relocate" | "Others";

interface TransferItem {
  propertyNumber: string;
  description: string;
  quantity: number;
  unit?: string; // Add unit just in case, though I removed it from layout
  serialNumber?: string; // Add serialNumber just in case
  condition: string;
  dateAcquired?: string;
  amount?: number;
  unitCost?: number;
  icsSlipId?: string;
  icsSlipNumber?: string;
  icsDate?: string;
  inventoryItemId?: string;
  custodianName?: string;
  subCategory?: string;
}

interface TransferHistoryEntry {
  timestamp: string;
  status: TransferStatus;
  action: string;
  details?: string;
}

interface Transfer {
  id: string;
  entityName: string;
  fromAccountableOfficer: string;
  fromAccountableOfficerDepartment?: string;
  fromAccountableOfficerDesignation?: string;
  fromAccountableOfficerId?: string;
  toAccountableOfficer: string;
  toAccountableOfficerDepartment?: string;
  toAccountableOfficerDesignation?: string;
  toAccountableOfficerId?: string;
  fundCluster: string;
  itrNumber: string;
  date: string;
  transferType: TransferType;
  otherTransferType?: string;
  reason: string;
  status: TransferStatus;
  dateCompleted?: string;
  items: TransferItem[];
  history: TransferHistoryEntry[];
  approvedBy?: string;
  approvedByDesignation?: string;
  issuedBy?: string;
  issuedByDesignation?: string;
  receivedBy?: string;
  receivedByDesignation?: string;
  createdAt?: string;
}

interface TransferFormState {
  entityName: string;
  fromAccountableOfficer: string;
  fromAccountableOfficerDepartment?: string;
  fromAccountableOfficerDesignation?: string;
  fromAccountableOfficerId?: string;
  toAccountableOfficer: string;
  toAccountableOfficerDepartment?: string;
  toAccountableOfficerDesignation?: string;
  toAccountableOfficerId?: string;
  fundCluster: string;
  itrNumber: string;
  date: string;
  transferType: TransferType;
  otherTransferType?: string;
  reason: string;
  approvedBy?: string;
  approvedByDesignation?: string;
  issuedBy?: string;
  issuedByDesignation?: string;
  receivedBy?: string;
  receivedByDesignation?: string;
  status: TransferStatus;
  items: TransferItem[];
}

interface CustodianItemOption {
  id: string;
  propertyNumber: string;
  description: string;
  quantity: number;
  condition: string;
  amount?: number;
  unitCost?: number;
  dateAcquired?: string;
  custodianName?: string;
  assignmentStatus?: string;
  currentCustodian?: string;
  icsSlipId: string;
  icsSlipNumber: string;
  icsDate?: string;
  inventoryItemId?: string;
  serialNumber?: string;
}



interface DbTransferItemRow {
  id: string;
  property_number: string;
  description: string;
  quantity: number;
  condition: string;
  inventory_item_id?: string;
  from_custodian?: string;
  to_custodian?: string;
}

interface DbTransferRecordRow {
  id: string;
  transfer_number: string;
  from_department: string;
  to_department: string;
  transfer_type: string;
  transfer_type_choice?: string;
  status: string;
  requested_by: string;
  approved_by?: string;
  date_requested: string;
  date_approved?: string;
  date_completed?: string;
  reason: string;
  remarks?: string;
  created_at: string;
  entity_name?: string;
  fund_cluster?: string;
  received_by?: string;
  transfer_items?: DbTransferItemRow[];
}

interface DbInventoryItemRow {
  id: string;
  property_number: string;
  description: string;
  quantity: number;
  condition: string;
  total_cost?: number;
  date_acquired?: string;
  assignment_status?: string;
  custodian?: string | null;
  custodian_position?: string | null;
  ics_number?: string | null;
  ics_date?: string | null;
  status?: string;
  assigned_date?: string | null;
}

interface TransferInsertPayload {
  id: string;
  transfer_number: string;
  from_department: string;
  to_department: string;
  transfer_type: string;
  transfer_type_choice?: string;
  status: string;
  date_requested: string;
  reason: string;
  requested_by: string;
}

interface InventorySnapshot {
  id: string;
  custodian: string | null;
  custodian_position: string | null;
  assignment_status: string | null;
  assigned_date: string | null;
  ics_number: string | null;
  ics_date: string | null;
}

interface TransferCompletionRollbackState {
  slipIds: string[];
  slipItemIds: string[];
  propertyCardEntryIds: string[];
  inventorySnapshots: InventorySnapshot[];
}
const TRANSFER_TYPES: TransferType[] = ["Donation", "Reassignment", "Relocate", "Others"];
const UI_TO_DB_STATUS: Record<TransferStatus, string> = {
  Draft: "Draft",
  Issued: "Issued",
  Completed: "Completed",
  Rejected: "Rejected",
};

const DB_TO_UI_STATUS: Record<string, TransferStatus> = {
  Draft: "Draft",
  Issued: "Issued",
  Completed: "Completed",
  Rejected: "Rejected",
  // Backward compatibility for legacy values
  Pending: "Draft",
  "In Transit": "Issued",
};

const EMPTY_TRANSFERS: Transfer[] = [];
const EMPTY_ICS_OPTIONS: CustodianItemOption[] = [];

const INITIAL_FORM_STATE: TransferFormState = {
  entityName: "PROVINCIAL GOVERNMENT OF APAYAO",
  fromAccountableOfficer: "",
  fromAccountableOfficerDesignation: "",
  toAccountableOfficer: "",
  toAccountableOfficerDesignation: "",
  fundCluster: "",
  itrNumber: "",
  date: "",
  transferType: "Donation",
  otherTransferType: "",
  reason: "",
  approvedBy: "",
  approvedByDesignation: "",
  issuedBy: "",
  issuedByDesignation: "",
  receivedBy: "",
  receivedByDesignation: "",
  status: "Draft",
  items: [],
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

const formatDateTime = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatCurrency = (value?: number) => {
  if (value === undefined || value === null) return "";
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
};

const formatCustodianLine = (name?: string, department?: string) => {
  if (!name) return "";
  if (department) return `${name} / ${department}`;
  return name;
};

const generateNextItrNumber = async (
  existingTransfers: Transfer[] = [],
  items: TransferItem[] = []
): Promise<string> => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  const isHighValue = items.some((it) => {
    const amt = Number(it.amount || 0);
    return amt > 5000 || it.subCategory === 'High Value Expendable';
  });
  const category = isHighValue ? 'SPHV' : 'SPLV';

  const pattern = new RegExp(`^${year}-${month}-${category}-(\\d{4})$`);
  let maxSequence = 0;

  for (const transfer of existingTransfers) {
    const match = pattern.exec(transfer.itrNumber);
    if (match) {
      const seq = parseInt(match[1], 10);
      if (!Number.isNaN(seq)) maxSequence = Math.max(maxSequence, seq);
    }
  }

  try {
    const { data: dbTransfers } = await supabase
      .from("property_transfers")
      .select("transfer_number")
      .like("transfer_number", `${year}-${month}-${category}-%`)
      .order("transfer_number", { ascending: false })
      .limit(100);
    if (dbTransfers) {
      for (const transfer of dbTransfers) {
        const match = pattern.exec(transfer.transfer_number);
        if (match) {
          const seq = parseInt(match[1], 10);
          if (!Number.isNaN(seq)) maxSequence = Math.max(maxSequence, seq);
        }
      }
    }
  } catch (err) {
    console.warn("Could not check database for existing ITR numbers:", err);
  }

  const nextSequence = String(maxSequence + 1).padStart(4, "0");
  return `${year}-${month}-${category}-${nextSequence}`;
};

const rollbackTransferCompletion = async (state: TransferCompletionRollbackState) => {
  if (!state) return;
  const { slipIds, slipItemIds, propertyCardEntryIds, inventorySnapshots } = state;

  if (propertyCardEntryIds.length) {
    try {
      await supabase
        .from("property_card_entries")
        .delete()
        .in("id", propertyCardEntryIds);
    } catch (err) {
      console.error("Rollback: Failed to delete property card entries", err);
    }
  }

  if (slipItemIds.length) {
    try {
      await supabase.from("custodian_slip_items").delete().in("id", slipItemIds);
    } catch (err) {
      console.error("Rollback: Failed to delete custodian slip items", err);
    }
  }

  if (slipIds.length) {
    try {
      await supabase.from("custodian_slips").delete().in("id", slipIds);
    } catch (err) {
      console.error("Rollback: Failed to delete custodian slips", err);
    }
  }

  for (const snapshot of inventorySnapshots) {
    try {
      await supabase
        .from("inventory_items")
        .update({
          custodian: snapshot.custodian,
          custodian_position: snapshot.custodian_position,
          assignment_status: snapshot.assignment_status,
          assigned_date: snapshot.assigned_date,
          ics_number: snapshot.ics_number,
          ics_date: snapshot.ics_date,
          updated_at: new Date().toISOString(),
        })
        .eq("id", snapshot.id);
    } catch (err) {
      console.error(`Rollback: Failed to restore inventory item ${snapshot.id}`, err);
    }
  }
};

const resolveTransferTypeFromRecord = (record: DbTransferRecordRow): TransferType => {
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


const downloadCsv = (filename: string, rows: string[][]) => {
  const csvContent = rows
    .map((row) =>
      row
        .map((field) => {
          const safeField = field.replace(/"/g, '""');
          return `"${safeField}"`;
        })
        .join(",")
    )
    .join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const mapOptionToTransferItem = (option: CustodianItemOption): TransferItem => ({
  propertyNumber: option.propertyNumber,
  description: option.description,
  quantity: option.quantity,
  condition: option.condition,
  dateAcquired: option.dateAcquired,
  amount: option.amount,
  unitCost: option.unitCost,
  icsSlipId: option.icsSlipId,
  icsSlipNumber: option.icsSlipNumber,
  icsDate: option.icsDate,
  inventoryItemId: option.inventoryItemId,
  custodianName: option.custodianName,
  serialNumber: option.serialNumber,
});

const renderPrintLayout = (transfer: Transfer, preview = false) => {
  const items = transfer.items || [];
  const blankRows = Math.max(9 - items.length, 0);
  const getDynamicFontSize = (text: string, baseSize: number = 13) => {
    if (!text) return `${baseSize}px`;
    if (text.length > 30) return `${baseSize - 3}px`;
    if (text.length > 20) return `${baseSize - 1.5}px`;
    return `${baseSize}px`;
  };
  const containerClass = preview
    ? "bg-white border border-border rounded-lg shadow-sm text-foreground mx-auto"
    : "bg-white text-black mx-auto overflow-hidden";
  const paddingClass = preview ? "p-4" : "p-4";

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
    <>
      <style type="text/css" media="print">
        {`
          html, body {
            background-color: #FFFFFF !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }
        `}
      </style>
      <div 
        className={preview 
          ? `${containerClass} ${paddingClass} w-[210mm] min-h-[297mm] p-[12mm] flex flex-col gap-4` 
          : "print-page-a4 flex flex-col gap-4 min-h-[297mm]"
        }
        style={{ fontFamily: "'Times New Roman', serif" }}
      >

        {/* Top Header Section */}
        <div className="w-full">
          <div className="w-full mb-2 flex flex-col items-center">
            <img src={headerLogo} alt="Official Header" className="w-full h-auto object-contain" />
          </div>
          
          <div className="w-full text-right text-sm italic font-semibold pr-2">
            Annex A.5
          </div>
          
          {/* REPORT TITLE */}
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

        {/* BORDERED CONTAINER FOR THE WHOLE FORM */}
        <div className="border-2 border-black p-0 mb-0 bg-white shrink">
          {/* Top Info section */}
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

          {/* Transfer Type */}
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

          {/* Items Table */}
          <table className="w-full border-collapse bg-white shrink text-sm">
            <thead>
              <tr className="print:bg-white">
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
                <tr key={index} className="align-top text-xs">
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
              {/* Total Row */}
              <tr>
                <td className="border border-black p-1" colSpan={6} align="right"><span className="font-bold mr-2">TOTAL</span></td>
                <td className="border border-black p-1 text-right font-bold">
                  {formatCurrency(items.reduce((sum, item) => sum + (item.amount || 0), 0))}
                </td>
                <td className="border border-black p-1"></td>
              </tr>
            </tbody>
          </table>

          {/* Reason for Transfer */}
          <div className="border-b border-black px-2 py-1">
            <span className="text-sm">Reason for Transfer:</span>
            <div className="text-sm font-bold uppercase pl-1">{transfer.reason}</div>
          </div>

          {/* Signature Block — no table borders, just labels and underlined values */}
          {/* Header row: no bottom border, just centered text labels */}
          <div className="flex text-[13px] pt-1">
            <div className="w-[14%]"></div>
            <div className="w-[28.6%] text-center">Approved by:</div>
            <div className="w-[28.6%] text-center">Released/Issued by:</div>
            <div className="w-[28.8%] text-center">Received by:</div>
          </div>

          {/* Each row is its own flex row with spacing between rows */}
          <div className="text-[13px] px-1 pb-1">
            {/* Signature row */}
            <div className="flex mt-1">
              <div className="w-[14%] pl-1">Signature:</div>
              <div className="w-[28.6%] mx-2 border-b border-black h-5"></div>
              <div className="w-[28.6%] mx-2 border-b border-black h-5"></div>
              <div className="w-[28.8%] mx-2 border-b border-black h-5"></div>
            </div>

            {/* Name row */}
            <div className="flex">
              <div className="w-[14%] pl-1">Name:</div>
              <div className="w-[28.6%] mx-2 text-center font-bold border-b border-black">{transfer.approvedBy || "\u00A0"}</div>
              <div className="w-[28.6%] mx-2 text-center font-bold border-b border-black">{transfer.issuedBy || transfer.fromAccountableOfficer}</div>
              <div className="w-[28.8%] mx-2 text-center font-bold border-b border-black">{transfer.receivedBy || transfer.toAccountableOfficer}</div>
            </div>

            {/* Designation row */}
            <div className="flex mt-2">
              <div className="w-[14%] pl-1">Designation:</div>
              <div className="w-[28.6%] mx-2 text-center text-xs italic border-b border-black">{transfer.approvedByDesignation || "\u00A0"}</div>
              <div className="w-[28.6%] mx-2 text-center text-xs italic border-b border-black">{transfer.issuedByDesignation || transfer.fromAccountableOfficerDesignation || transfer.fromAccountableOfficerDepartment || "\u00A0"}</div>
              <div className="w-[28.8%] mx-2 text-center text-xs italic border-b border-black">{transfer.receivedByDesignation || transfer.toAccountableOfficerDesignation || transfer.toAccountableOfficerDepartment || "\u00A0"}</div>
            </div>

            {/* Date row */}
            <div className="flex mt-2">
              <div className="w-[14%] pl-1">Date:</div>
              <div className="w-[28.6%] mx-2 text-center border-b border-black">{transfer.date ? formatDate(transfer.date) : "\u00A0"}</div>
              <div className="w-[28.6%] mx-2 text-center border-b border-black">{transfer.date ? formatDate(transfer.date) : "\u00A0"}</div>
              <div className="w-[28.8%] mx-2 text-center border-b border-black">{transfer.date ? formatDate(transfer.date) : "\u00A0"}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export const Transfers = () => {

  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingTransferId, setEditingTransferId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [transferTypeFilter, setTransferTypeFilter] = useState<string>("All");
  const [fromDateFilter, setFromDateFilter] = useState("");
  const [toDateFilter, setToDateFilter] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isItemSelectorOpen, setItemSelectorOpen] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [itemSearchTerm, setItemSearchTerm] = useState("");
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<TransferFormState>(INITIAL_FORM_STATE);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load persisted form data on mount
  useEffect(() => {
    const savedForm = localStorage.getItem('itr_form_data');
    if (savedForm) {
      try {
        const parsed = JSON.parse(savedForm);
        setFormData(parsed);
        // If there were items saved, sync the selected item IDs for the picker
        if (parsed.items && Array.isArray(parsed.items)) {
          setSelectedItemIds(parsed.items.map((it: any) => it.inventoryItemId || it.propertyNumber));
        }
      } catch (e) {
        console.error("Failed to parse saved ITR form:", e);
      }
    }
  }, []);

  // Persist form data on change
  useEffect(() => {
    if (formData && formData !== INITIAL_FORM_STATE) {
      localStorage.setItem('itr_form_data', JSON.stringify(formData));
    }
  }, [formData]);

  // ── React Query: load + cache transfers ─────────────────────────────────
  const { data: transfers = EMPTY_TRANSFERS, isLoading: isLoadingTransfers, refetch: refetchTransfers } = useQuery<Transfer[]>({
    queryKey: ['property-transfers'],
    staleTime: 30_000, // keep cache fresh for 30 s; re-fetches in background after that
    queryFn: async () => {
      // Prefer loading with the richer set of columns, gracefully fallback if the schema is older
      let data, error;
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

      const legacySelection = `
          id,
          transfer_number,
          from_department,
          to_department,
          transfer_type,
          status,
          requested_by,
          approved_by,
          date_requested,
          date_approved,
          date_completed,
          reason,
          remarks,
          created_at,
          transfer_items (
            id,
            property_number,
            description,
            quantity,
            condition,
            inventory_item_id
          )
        `;

      const richResult = await supabase
        .from("property_transfers")
        .select(richSelection)
        .order("date_requested", { ascending: false });
      data = richResult.data;
      error = richResult.error;

      if (
        error &&
        (
          error.message?.includes("inventory_item_id") ||
          error.message?.includes("entity_name") ||
          error.message?.includes("fund_cluster") ||
          error.message?.includes("from_custodian") ||
          error.message?.includes("to_custodian") ||
          error.message?.includes("transfer_type_choice") ||
          error.message?.includes("column")
        )
      ) {
        console.warn("Optional transfer columns missing, falling back to legacy select:", error.message);
        const fallbackResult = await supabase
          .from("property_transfers")
          .select(legacySelection)
          .order("date_requested", { ascending: false });
        data = fallbackResult.data;
        error = fallbackResult.error;
      }

      if (error) {
        console.error("Failed to load transfers", error);
        throw error;
      }

      // Gather custodian metadata (department & designation) for the officers referenced in transfers
      const officerNames = Array.from(
        new Set(
          (data || [])
            .flatMap((record: DbTransferRecordRow) => [record.from_department, record.to_department])
            .filter((value): value is string => Boolean(value))
        )
      );

      const custodianMeta = new Map<string, { department?: string; designation?: string }>();
      if (officerNames.length) {
        const { data: custodianRows, error: custodianError } = await supabase
          .from("custodians")
          .select(`
              name,
              position,
              departments!custodians_department_id_fkey (
                name
              )
            `)
          .in("name", officerNames);

        if (custodianError) {
          console.warn("Failed to load custodian metadata for transfers:", custodianError.message);
        } else {
          (custodianRows || []).forEach((row: any) => {
            const key = row?.name?.toLowerCase();
            if (!key) return;
            const departmentName = row?.departments?.name || row?.department_name || "";
            custodianMeta.set(key, {
              department: departmentName || undefined,
              designation: row?.position || undefined,
            });
          });
        }
      }

      // ── Batch-fetch all enrichment data upfront ──────────────────────────
      // Collect all unique ids/property-numbers across every transfer's items
      const allItems = (data || []).flatMap((r: DbTransferRecordRow) => r.transfer_items || []);

      const allInvIds = [...new Set(allItems.map((i: DbTransferItemRow) => i.inventory_item_id).filter(Boolean))] as string[];
      const allPropNumbers = [...new Set(allItems.map((i: DbTransferItemRow) => i.property_number).filter(Boolean))] as string[];
      const allCustodians = [...new Set(allItems.map((i: DbTransferItemRow) => (i as any).from_custodian).filter(Boolean))] as string[];

      // Fire all four lookups in parallel
      const [invByIdRows, slipItemsByInvIdRows, invByPropRows, slipItemsByPropRows, slipByCustodianRows] = await Promise.all([
        // 1. inventory_items by id
        allInvIds.length
          ? supabase.from("inventory_items")
            .select("id, date_acquired, unit_cost, total_cost, serial_number, description")
            .in("id", allInvIds)
            .then(r => r.data || [])
          : Promise.resolve([]),

        // 2. custodian_slip_items by inventory_item_id (newest slip per item)
        allInvIds.length
          ? supabase.from("custodian_slip_items")
            .select("inventory_item_id, custodian_slips!inner(slip_number, date_issued)")
            .in("inventory_item_id", allInvIds)
            .order("created_at", { ascending: false })
            .then(r => r.data || [])
          : Promise.resolve([]),

        // 3. inventory_items by property_number (fallback)
        allPropNumbers.length
          ? supabase.from("inventory_items")
            .select("property_number, date_acquired, unit_cost, total_cost, serial_number, description")
            .in("property_number", allPropNumbers)
            .then(r => r.data || [])
          : Promise.resolve([]),

        // 4. custodian_slip_items by property_number (fallback ICS)
        allPropNumbers.length
          ? supabase.from("custodian_slip_items")
            .select("property_number, date_issued, custodian_slips!inner(slip_number, date_issued)")
            .in("property_number", allPropNumbers)
            .order("date_issued", { ascending: false })
            .then(r => r.data || [])
          : Promise.resolve([]),

        // 5. custodian_slips by custodian_name (from_custodian fallback)
        allCustodians.length
          ? supabase.from("custodian_slips")
            .select("custodian_name, slip_number, date_issued")
            .in("custodian_name", allCustodians)
            .order("date_issued", { ascending: false })
            .then(r => r.data || [])
          : Promise.resolve([]),
      ]);

      // Build lookup maps (keep first/newest match per key)
      type InvRow = { id?: string; property_number?: string; date_acquired?: string | null; unit_cost?: number | null; total_cost?: number | null; serial_number?: string | null; description?: string | null };
      type SlipRow = { slip_number?: string; date_issued?: string };
      type SlipItemRow = { inventory_item_id?: string; property_number?: string; date_issued?: string | null; custodian_slips?: SlipRow | SlipRow[] };
      type CustodianSlipRow = { custodian_name?: string; slip_number?: string; date_issued?: string };

      const invById = new Map<string, InvRow>();
      const invByProp = new Map<string, InvRow>();
      const slipByInvId = new Map<string, SlipRow>();
      const slipByProp = new Map<string, SlipRow>();
      const slipByCust = new Map<string, CustodianSlipRow>();

      for (const row of invByIdRows as InvRow[]) if (row.id && !invById.has(row.id)) invById.set(row.id, row);
      for (const row of invByPropRows as InvRow[]) if (row.property_number && !invByProp.has(row.property_number)) invByProp.set(row.property_number, row);
      for (const row of slipItemsByInvIdRows as SlipItemRow[]) {
        if (row.inventory_item_id && !slipByInvId.has(row.inventory_item_id)) {
          const slip = Array.isArray(row.custodian_slips) ? row.custodian_slips[0] : row.custodian_slips;
          if (slip?.slip_number) slipByInvId.set(row.inventory_item_id, slip);
        }
      }
      for (const row of slipItemsByPropRows as SlipItemRow[]) {
        if (row.property_number && !slipByProp.has(row.property_number)) {
          const slip = Array.isArray(row.custodian_slips) ? row.custodian_slips[0] : row.custodian_slips;
          if (slip?.slip_number) slipByProp.set(row.property_number, { slip_number: slip.slip_number, date_issued: row.date_issued || slip.date_issued });
        }
      }
      for (const row of slipByCustodianRows as CustodianSlipRow[]) {
        if (row.custodian_name && !slipByCust.has(row.custodian_name)) slipByCust.set(row.custodian_name, row);
      }
      // ─────────────────────────────────────────────────────────────────────

      // Transform database records to Transfer interface (now synchronous enrichment)
      const loadedTransfers: Transfer[] = (data || []).map((record: DbTransferRecordRow) => {
        const fromMeta = record.from_department ? custodianMeta.get(record.from_department.toLowerCase()) : undefined;
        const toMeta = record.to_department ? custodianMeta.get(record.to_department.toLowerCase()) : undefined;

        const enrichedItems = (record.transfer_items || []).map((item: DbTransferItemRow) => {
          const fromCustodian = (item as any).from_custodian as string | undefined;

          // --- Inventory data (by id first, then property_number fallback) ---
          const invRowById = item.inventory_item_id ? invById.get(item.inventory_item_id) : undefined;
          const invRowByProp = invByProp.get(item.property_number);
          const invRow = invRowById ?? invRowByProp;

          const dateAcquired = invRow?.date_acquired ?? null;
          const amount = invRow ? (invRow.total_cost || invRow.unit_cost || null) : null;
          const unitCost = invRow?.unit_cost ?? null;
          const serialNumber = invRow?.serial_number ?? null;

          // --- ICS data (by inv id → by property_number → by custodian) ---
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
          history: [
            {
              timestamp: record.created_at,
              status: DB_TO_UI_STATUS[record.status] || "Draft",
              action: "Transfer created",
              details: `Created ${record.transfer_number}`,
            },
          ],
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
      });

      return loadedTransfers;
    },
  });
  // ────────────────────────────────────────────────────────────────────────

  const entitySuggestions = useMemo(
    () => [
      "PROVINCIAL GOVERNMENT OF APAYAO",
      "CITY OF LUNA",
      "MUNICIPALITY OF FLORA",
      "PROVINCIAL ACCOUNTING OFFICE",
    ],
    []
  );

  const { data: icsOptions = EMPTY_ICS_OPTIONS, isLoading: isLoadingIcs } = useQuery({
    queryKey: ["transfer-ics-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custodian_slip_items")
        .select(`
          id,
          property_number,
          description,
          quantity,
          unit,
          date_issued,
          inventory_item_id,
          inventory_items (
            id,
            description,
            date_acquired,
            property_number,
            total_cost,
            condition,
            custodian,
            custodian_position,
            ics_number,
            ics_date,
            status,
            assignment_status,
            serial_number
          ),
          custodian_slips!inner (
            id,
            slip_number,
            date_issued,
            custodian_name
          )
        `)
        .order("date_issued", { ascending: false })
        .limit(500);

      if (error) {
        console.error("Failed to load custodian slip items for transfers", error);
        throw error;
      }

      const items: CustodianItemOption[] = [];
      for (const row of data || []) {
        const inventoryItem = Array.isArray(row.inventory_items)
          ? row.inventory_items[0]
          : row.inventory_items;
        const slip = Array.isArray(row.custodian_slips)
          ? row.custodian_slips[0]
          : row.custodian_slips;

        if (!inventoryItem || !slip) continue;

        const normalizedSlipCustodian = (slip.custodian_name || "").toLowerCase().trim();
        const normalizedInventoryCustodian = (inventoryItem.custodian || "").toLowerCase().trim();
        const assignmentStatus = inventoryItem.assignment_status || "";

        if (
          !normalizedSlipCustodian ||
          normalizedSlipCustodian !== normalizedInventoryCustodian ||
          (assignmentStatus && assignmentStatus !== "Assigned")
        ) {
          continue;
        }

        items.push({
          id: row.id,
          propertyNumber: row.property_number || "",
          description: row.description || inventoryItem?.description || "",
          quantity: row.quantity || 0,
          condition: inventoryItem?.condition || "",
          amount: Number(inventoryItem?.total_cost ?? 0),
          dateAcquired: inventoryItem?.date_acquired || "",
          custodianName: slip?.custodian_name || "",
          currentCustodian: inventoryItem?.custodian || "",
          assignmentStatus: assignmentStatus || "",
          icsSlipId: slip?.id || "",
          icsSlipNumber: slip?.slip_number || "",
          icsDate: row.date_issued || slip?.date_issued || "",
          inventoryItemId: row.inventory_item_id || inventoryItem?.id || "",
          serialNumber: (inventoryItem as any)?.serial_number || undefined,
        });
      }

      console.log('Loaded ICS options for transfer (items join):', {
        totalItems: items.length,
        custodians: [...new Set(items.map(i => i.custodianName))],
        sampleItems: items.slice(0, 3)
      });

      return items;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: currentAssigned = EMPTY_ICS_OPTIONS } = useQuery({
    queryKey: ["current-assigned-items", formData.fromAccountableOfficer],
    enabled: !!formData.fromAccountableOfficer,
    queryFn: async () => {
      if (!formData.fromAccountableOfficer) return [] as CustodianItemOption[];
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, property_number, description, quantity, condition, total_cost, date_acquired, assignment_status, custodian, serial_number")
        .eq("custodian", formData.fromAccountableOfficer)
        .eq("assignment_status", "Assigned")
        .eq("status", "Active")
        .limit(500);
      if (error) throw error;
      return (data || []).map((inv: DbInventoryItemRow) => ({
        id: inv.id,
        propertyNumber: inv.property_number,
        description: inv.description || "",
        quantity: inv.quantity || 1,
        condition: inv.condition || "",
        amount: Number(inv.total_cost ?? 0),
        dateAcquired: inv.date_acquired || "",
        custodianName: formData.fromAccountableOfficer,
        currentCustodian: inv.custodian || formData.fromAccountableOfficer,
        assignmentStatus: inv.assignment_status || "Assigned",
        icsSlipId: "",
        icsSlipNumber: "",
        icsDate: "",
        inventoryItemId: inv.id,
        serialNumber: (inv as any).serial_number || undefined,
      }));
    },
    staleTime: 60 * 1000,
  });

  // Collect inventory item IDs already in existing draft/pending transfers
  // so they don't appear in the "choose items" list for new transfers
  const idsInExistingTransfers = useMemo(() => {
    const ids = new Set<string>();
    // Exclude items from all non-completed transfers (Draft, Issued)
    // but allow items from the transfer being edited
    transfers.forEach(transfer => {
      if (editingTransferId && transfer.id === editingTransferId) return; // skip the one being edited
      transfer.items.forEach(item => {
        if (item.inventoryItemId) ids.add(item.inventoryItemId);
      });
    });
    return ids;
  }, [transfers, editingTransferId]);

  const availableIcsItems = useMemo(() => {
    const normalizedFromOfficer = formData.fromAccountableOfficer
      ? formData.fromAccountableOfficer.toLowerCase().trim()
      : "";
    const alreadyAdded = new Set(formData.items.map((item) => item.propertyNumber));
    if (!normalizedFromOfficer) {
      return [];
    }

    const fromIcs = icsOptions.filter((item) => {
      if (alreadyAdded.has(item.propertyNumber)) return false;
      if (!normalizedFromOfficer) return false;
      if (item.assignmentStatus && item.assignmentStatus !== "Assigned") return false;
      if (item.inventoryItemId && idsInExistingTransfers.has(item.inventoryItemId)) return false;
      const normalizedItemCustodian = (item.currentCustodian || item.custodianName || "").toLowerCase().trim();
      return normalizedItemCustodian === normalizedFromOfficer;
    });

    const fromCurrent = (currentAssigned || []).filter(
      (item) =>
        !alreadyAdded.has(item.propertyNumber) &&
        item.assignmentStatus === "Assigned" &&
        normalizedFromOfficer &&
        (item.currentCustodian || "").toLowerCase().trim() === normalizedFromOfficer &&
        !(item.inventoryItemId && idsInExistingTransfers.has(item.inventoryItemId))
    );

    // Merge and dedupe by property number
    const mergedMap = new Map<string, CustodianItemOption>();
    [...fromIcs, ...fromCurrent].forEach((item) => {
      if (!mergedMap.has(item.propertyNumber)) mergedMap.set(item.propertyNumber, item);
    });
    let merged = Array.from(mergedMap.values());

    if (itemSearchTerm) {
      merged = merged.filter((item) => {
        const haystack = `${item.propertyNumber} ${item.description} ${item.icsSlipNumber} ${item.custodianName || ""}`.toLowerCase();
        return haystack.includes(itemSearchTerm.toLowerCase());
      });
    }

    console.log('Filtered ICS items:', {
      fromOfficer: formData.fromAccountableOfficer,
      totalOptions: (icsOptions.length + (currentAssigned?.length || 0)),
      filteredCount: merged.length,
      items: merged.map(i => ({ custodian: i.custodianName, propertyNumber: i.propertyNumber }))
    });

    return merged;
  }, [icsOptions, currentAssigned, formData.fromAccountableOfficer, formData.items, itemSearchTerm, idsInExistingTransfers]);

  const filteredTransfers = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase();

    return transfers.filter((transfer) => {
      const haystack = [
        transfer.itrNumber,
        transfer.entityName,
        transfer.fromAccountableOfficer,
        transfer.toAccountableOfficer,
        transfer.reason,
        transfer.items.map((item) => `${item.propertyNumber} ${item.description}`).join(" "),
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = haystack.includes(lowerSearch);
      const matchesStatus = statusFilter === "All" || transfer.status === statusFilter;
      const matchesType = transferTypeFilter === "All" || transfer.transferType === transferTypeFilter;
      const matchesFromDate = !fromDateFilter || transfer.date >= fromDateFilter;
      const matchesToDate = !toDateFilter || transfer.date <= toDateFilter;

      return matchesSearch && matchesStatus && matchesType && matchesFromDate && matchesToDate;
    });
  }, [transfers, searchTerm, statusFilter, transferTypeFilter, fromDateFilter, toDateFilter]);

  const newestTransferId = useMemo(() => getNewestRecordId(transfers), [transfers]);
  const isRecentlyAddedTransfer = (transfer: Transfer) =>
    newestTransferId === transfer.id && isWithinRecentThreshold(transfer.createdAt);

  useEffect(() => {
    if (isCreating || editingTransferId) {
      if (!editingTransferId) {
        // Generate initial ITR number for NEW transfers only
        generateNextItrNumber(transfers, formData.items).then((nextNumber) => {
          setFormData((prev) => ({
            ...prev,
            itrNumber: prev.itrNumber || nextNumber,
            status: "Draft",
          }));
        });
      }
      setErrors({});
    } else {
      setFormData(INITIAL_FORM_STATE);
      setSelectedItemIds([]);
      setItemSelectorOpen(false);
    }
  }, [isCreating, editingTransferId, transfers]);

  // Automatically update ITR category (SPHV vs SPLV) based on items
  useEffect(() => {
    if (isCreating && formData.items.length > 0) {
      const isHighValue = formData.items.some((it) => {
        const amt = Number(it.amount || 0);
        return amt > 5000 || it.subCategory === 'High Value Expendable';
      });
      const currentCategory = isHighValue ? 'SPHV' : 'SPLV';
      
      // Only update if the category in the current ITR number doesn't match
      if (formData.itrNumber && !formData.itrNumber.includes(currentCategory)) {
        generateNextItrNumber(transfers, formData.items).then((nextNumber) => {
          setFormData((prev) => ({ ...prev, itrNumber: nextNumber }));
        });
      }
    }
  }, [formData.items, isCreating, transfers, formData.itrNumber]);

  const validateForm = (form: TransferFormState) => {
    const validationErrors: Record<string, string> = {};

    if (!form.entityName.trim()) validationErrors.entityName = "Entity name is required.";
    if (!form.fundCluster.trim()) validationErrors.fundCluster = "Fund cluster is required.";
    if (!form.itrNumber.trim()) validationErrors.itrNumber = "ITR number is required.";
    if (!form.date.trim()) validationErrors.date = "Date is required.";
    if (!form.fromAccountableOfficer.trim()) validationErrors.fromOfficer = "Select the releasing accountable officer.";
    if (!form.toAccountableOfficer.trim()) validationErrors.toOfficer = "Select the receiving accountable officer.";
    if (!form.reason.trim()) validationErrors.reason = "Please provide the reason for transfer.";
    if (!form.items.length) validationErrors.items = "Select at least one item from the ICS list.";

    return validationErrors;
  };

  const handleGenerateItrNumber = async () => {
    const nextNumber = await generateNextItrNumber(transfers, formData.items || []);
    setFormData((prev) => ({ ...prev, itrNumber: nextNumber }));
  };

  const handleEditTransfer = (transfer: Transfer) => {
    setFormData({
      entityName: transfer.entityName,
      fromAccountableOfficer: transfer.fromAccountableOfficer,
      fromAccountableOfficerDepartment: transfer.fromAccountableOfficerDepartment,
      fromAccountableOfficerDesignation: transfer.fromAccountableOfficerDesignation,
      fromAccountableOfficerId: transfer.fromAccountableOfficerId,
      toAccountableOfficer: transfer.toAccountableOfficer,
      toAccountableOfficerDepartment: transfer.toAccountableOfficerDepartment,
      toAccountableOfficerDesignation: transfer.toAccountableOfficerDesignation,
      toAccountableOfficerId: transfer.toAccountableOfficerId,
      fundCluster: transfer.fundCluster,
      itrNumber: transfer.itrNumber,
      date: transfer.date,
      transferType: transfer.transferType,
      otherTransferType: transfer.otherTransferType,
      reason: transfer.reason,
      approvedBy: transfer.approvedBy,
      approvedByDesignation: transfer.approvedByDesignation,
      issuedBy: transfer.issuedBy,
      issuedByDesignation: transfer.issuedByDesignation,
      receivedBy: transfer.receivedBy,
      receivedByDesignation: transfer.receivedByDesignation,
      status: transfer.status,
      items: [...transfer.items],
    });
    setEditingTransferId(transfer.id);
    setIsCreating(true);
  };

  const handleCreateTransfer = async () => {
    const validationErrors = validateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast({
        title: "Missing information",
        description: "Please fill in the required fields before saving the transfer.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsProcessing(true);
      const now = new Date().toISOString();
      // Generate ITR number if not provided, ensuring it's unique
      let itrNumber = formData.itrNumber;
      if (!itrNumber) {
        itrNumber = await generateNextItrNumber(transfers, formData.items || []);
      }

      // Double-check uniqueness before inserting
      const { data: existing, error: existingError } = await supabase
        .from("property_transfers")
        .select("id")
        .eq("transfer_number", itrNumber)
        .maybeSingle();

      if (existingError) {
        console.error("Error checking existing transfer number:", existingError);
        throw existingError;
      }

      if (existing && !editingTransferId) {
        // If duplicate exists and not editing, generate a new one
        itrNumber = await generateNextItrNumber(transfers, formData.items);
      }
      const transferId = editingTransferId || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`);

      // Map frontend transfer types to DB allowed values (adjust mapping as needed)
      const transferTypeMap: Record<string, string> = {
        Donation: "Permanent",
        Reassignment: "Permanent",
        Relocate: "Temporary",
        Others: "Temporary",
      };

      const dbTransferType = transferTypeMap[formData.transferType] ?? "Permanent";

      // Ensure we have an authenticated user for requested_by (DB requires requested_by)
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id;
      if (!currentUserId) {
        toast({
          title: "Authentication required",
          description: "You must be signed in to create transfers.",
          variant: "destructive",
        });
        return;
      }

      // Save transfer to database
      let transferError;
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        transferError = null;
        const basePayload: TransferInsertPayload = {
          id: transferId,
          transfer_number: itrNumber,
          from_department: formData.fromAccountableOfficer,
          to_department: formData.toAccountableOfficer,
          transfer_type: dbTransferType,
          transfer_type_choice: formData.transferType,
          status: UI_TO_DB_STATUS[formData.status] || "Pending",
          date_requested: formData.date,
          reason: formData.reason,
          requested_by: currentUserId,
        };
        // Encode approver info into remarks field (approved_by DB column is a UUID FK, not a text field)
        const approverMeta = [
          formData.approvedBy?.trim() || '', 
          formData.approvedByDesignation?.trim() || '',
          formData.issuedBy?.trim() || '',
          formData.issuedByDesignation?.trim() || '',
          formData.receivedBy?.trim() || '',
          formData.receivedByDesignation?.trim() || ''
        ].join('||');
        const remarksValue = approverMeta ? `APPROVER::${approverMeta}` : null;
        const withOptional = {
          ...basePayload,
          entity_name: formData.entityName.trim(),
          fund_cluster: formData.fundCluster.trim(),
          ...(remarksValue ? { remarks: remarksValue } : {}),
        };
        
        let insertResult;
        if (editingTransferId) {
          insertResult = await supabase
            .from("property_transfers")
            .update(withOptional)
            .eq("id", editingTransferId);
        } else {
          insertResult = await supabase.from("property_transfers").insert(withOptional);
        }
        
        let error = insertResult.error;
        if (
          error &&
          (
            error.message?.includes("entity_name") ||
            error.message?.includes("fund_cluster") ||
            error.message?.includes("transfer_type_choice")
          )
        ) {
          insertResult = await supabase.from("property_transfers").insert(basePayload);
          error = insertResult.error;
        }

        if (error) {
          // If it's a duplicate key error, generate a new number and retry
          if (error.code === '23505' && error.message?.includes('transfer_number')) {
            console.warn(`Duplicate ITR number ${itrNumber} detected, generating new number...`);
            itrNumber = await generateNextItrNumber(transfers, formData.items || []);
            retryCount++;
            continue;
          }
          transferError = error;
          break;
        } else {
          // Success, break out of retry loop
          break;
        }
      }

      if (transferError) throw transferError;

      // Ensure all items have inventoryItemId looked up before inserting transfer_items
      for (const item of formData.items) {
        if (!item.inventoryItemId && item.propertyNumber) {
          try {
            const { data: invLookup } = await supabase
              .from("inventory_items")
              .select("id")
              .eq("property_number", item.propertyNumber)
              .single();
            if (invLookup) {
              item.inventoryItemId = invLookup.id;
            }
          } catch (err) {
            console.error("Failed to lookup inventory item for property number:", item.propertyNumber, err);
          }
        }
      }

      if (editingTransferId) {
        // Clear existing items before re-inserting to handle updates to the item list
        await supabase.from("transfer_items").delete().eq("transfer_id", editingTransferId);
      }

      // Save transfer items with graceful fallback for missing optional columns
      const transferItemsFull = formData.items.map((item) => ({
        id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        transfer_id: transferId,
        property_number: item.propertyNumber,
        description: item.description,
        quantity: item.quantity,
        condition: item.condition,
        inventory_item_id: item.inventoryItemId || null,
        ics_slip_id: item.icsSlipId || null,
        custodian_slip_item_id: item.icsSlipId || null,
        from_custodian: formData.fromAccountableOfficer,
        to_custodian: formData.toAccountableOfficer,
      }));

      const transferItemsBase = formData.items.map((item) => ({
        id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        transfer_id: transferId,
        property_number: item.propertyNumber,
        description: item.description,
        quantity: item.quantity,
        condition: item.condition,
      }));

      if (transferItemsFull.length > 0) {
        const itemsResult = await supabase.from("transfer_items").insert(transferItemsFull);
        let itemsError = itemsResult.error;
        if (
          itemsError && (
            itemsError.code === 'PGRST204' ||
            (itemsError.message?.includes('inventory_item_id')) ||
            (itemsError.message?.includes('ics_slip_id')) ||
            (itemsError.message?.includes('custodian_slip_item_id')) ||
            (itemsError.message?.includes('from_custodian')) ||
            (itemsError.message?.includes('to_custodian'))
          )
        ) {
          const fallback = await supabase.from("transfer_items").insert(transferItemsBase);
          itemsError = fallback.error;
        }
        if (itemsError) throw itemsError;
      }

      let toCustodianPosition = formData.toAccountableOfficerDesignation || "";
      if (!toCustodianPosition && formData.toAccountableOfficer) {
        const { data: custodianData } = formData.toAccountableOfficerId
          ? await supabase.from("custodians").select("position").eq("id", formData.toAccountableOfficerId).single()
          : await supabase.from("custodians").select("position").eq("name", formData.toAccountableOfficer).single();
        toCustodianPosition = custodianData?.position || "";
      }
      for (const item of formData.items) {
        let inventoryItemId = item.inventoryItemId;
        if (!inventoryItemId && item.propertyNumber) {
          const { data: invLookup } = await supabase
            .from("inventory_items")
            .select("id")
            .eq("property_number", item.propertyNumber)
            .single();
          if (invLookup) inventoryItemId = invLookup.id;
        }
        if (inventoryItemId) {
          const upd = await supabase
            .from("inventory_items")
            .update({
              custodian: formData.toAccountableOfficer,
              custodian_position: toCustodianPosition,
              assignment_status: "Assigned",
              assigned_date: new Date().toISOString().split("T")[0],
              updated_at: new Date().toISOString(),
            })
            .eq("id", inventoryItemId);
          if (upd.error) {
            await supabase
              .from("inventory_items")
              .update({ custodian: formData.toAccountableOfficer })
              .eq("id", inventoryItemId);
          }
        }
        const { data: propertyCard } = await supabase
          .from("property_cards")
          .select("id")
          .eq("property_number", item.propertyNumber)
          .single();
        if (propertyCard) {
          let lastBalance = 0;
          const { data: lastEntry } = await supabase
            .from("property_card_entries")
            .select("balance_qty")
            .eq("property_card_id", propertyCard.id)
            .order("date", { ascending: false })
            .limit(1)
            .single();
          if (lastEntry && typeof lastEntry.balance_qty === "number") {
            lastBalance = lastEntry.balance_qty;
          }
          const issueQty = item.quantity || 1;
          const newBalance = Math.max(0, (lastBalance || 0) - issueQty);

          await supabase
            .from("property_card_entries")
            .insert({
              property_card_id: propertyCard.id,
              date: new Date().toISOString().split("T")[0],
              reference: itrNumber,
              receipt_qty: 0,
              unit_cost: 0,
              total_cost: 0,
              issue_item_no: item.propertyNumber || "",
              issue_qty: issueQty,
              office_officer: `${formData.toAccountableOfficerDepartment ? `${formData.toAccountableOfficerDepartment}-` : ""}${formData.toAccountableOfficer}`,
              balance_qty: newBalance,
              amount: 0,
              remarks: `Transferred from ${formData.fromAccountableOfficer} to ${formData.toAccountableOfficer}`,
              related_transfer_id: transferId,
            });
        }
      }
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['custodian-summaries'] });
      queryClient.invalidateQueries({ queryKey: ['custodian-summary'] });
      queryClient.invalidateQueries({ queryKey: ['custodian-current-items'] });
      queryClient.invalidateQueries({ queryKey: ['custodian-item-history'] });
      // Reload transfers to show the new one
      let reloadedData, reloadError;
      const reloadQuery = await supabase
        .from("property_transfers")
        .select(`
          id,
          transfer_number,
          entity_name,
          fund_cluster,
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
          transfer_items (
            id,
            property_number,
            description,
            quantity,
            condition,
            inventory_item_id
          )
        `)
        .order("date_requested", { ascending: false });

      reloadedData = reloadQuery.data;
      reloadError = reloadQuery.error;

      // If error is about missing column, retry without inventory_item_id
      if (reloadError && (reloadError.message?.includes('column') || reloadError.message?.includes('inventory_item_id'))) {
        console.warn("inventory_item_id column not found in reload, loading without it");
        const fallbackReload = await supabase
          .from("property_transfers")
          .select(`
            id,
            transfer_number,
            from_department,
            to_department,
            transfer_type,
            status,
            requested_by,
            approved_by,
            date_requested,
            date_approved,
            date_completed,
            reason,
            remarks,
            created_at,
            transfer_items (
              id,
              property_number,
              description,
              quantity,
              condition
            )
          `)
          .order("date_requested", { ascending: false });
        reloadedData = fallbackReload.data;
        reloadError = fallbackReload.error;
      }

      if (reloadError) {
        console.error("Failed to reload transfers after creation:", reloadError);
        // Continue anyway - the transfer was created successfully
      }

      // Add the new transfer to the list using formData (which has all enriched data)
      const newTransfer: Transfer = {
        id: transferId,
        entityName: formData.entityName.trim(),
        fromAccountableOfficer: formData.fromAccountableOfficer.trim(),
        fromAccountableOfficerDepartment: formData.fromAccountableOfficerDepartment,
        fromAccountableOfficerDesignation: formData.fromAccountableOfficerDesignation,
        fromAccountableOfficerId: formData.fromAccountableOfficerId,
        toAccountableOfficer: formData.toAccountableOfficer.trim(),
        toAccountableOfficerDepartment: formData.toAccountableOfficerDepartment,
        toAccountableOfficerDesignation: formData.toAccountableOfficerDesignation,
        toAccountableOfficerId: formData.toAccountableOfficerId,
        fundCluster: formData.fundCluster.trim(),
        itrNumber,
        date: formData.date,
        transferType: formData.transferType,
        otherTransferType: formData.otherTransferType,
        reason: formData.reason.trim(),
        status: formData.status,
        items: formData.items,
        history: [
          {
            timestamp: new Date().toISOString(),
            status: formData.status,
            action: "Transfer created",
            details: `Created ITR ${itrNumber}`,
          },
        ],
        createdAt: new Date().toISOString(),
      };
      queryClient.invalidateQueries({ queryKey: ['property-transfers'] });

      setFormData(INITIAL_FORM_STATE);
      setIsCreating(false);
      // Clear persistence on success
      localStorage.removeItem('itr_form_data');
      setErrors({});
      setSelectedItemIds([]);
      toast({
        title: "Transfer saved",
        description: `Transfer ${itrNumber} has been saved and related records updated.`,
      });
      setIsProcessing(false);
    } catch (err) {
      console.error("Error creating transfer:", err);
      setIsProcessing(false);
      toast({
        title: "Error saving transfer",
        description: err instanceof Error ? err.message : "Failed to save transfer",
        variant: "destructive",
      });
    }
  };

  const handleStatusUpdate = async (transferId: string, newStatus: TransferStatus) => {
    try {
      setIsProcessing(true);
      const dateCompleted = newStatus === "Completed" ? new Date().toISOString().split("T")[0] : null;

      // Get the transfer with its items before updating
      const transfer = transfers.find((t) => t.id === transferId);
      if (!transfer) {
        throw new Error("Transfer not found");
      }

      // Update in database
      const { error } = await supabase
        .from("property_transfers")
        .update({
          status: UI_TO_DB_STATUS[newStatus] || "Pending",
          ...(dateCompleted && { date_completed: dateCompleted }),
        })
        .eq("id", transferId);

      if (error) throw error;

      // If transfer is being completed, update assignments and property cards (using ITR as reference)
      if (newStatus === "Completed" && transfer.items && transfer.items.length > 0) {
        console.log(`🔄 Completing transfer ${transfer.itrNumber}: Updating assignments for receiving custodian ${transfer.toAccountableOfficer}`);

        // Get the "to" custodian's position/designation (and id for inventory linkage)
        let toCustodianPosition = transfer.toAccountableOfficerDesignation || "";
        let toCustodianId: string | null = transfer.toAccountableOfficerId || null;
        if (!toCustodianPosition && transfer.toAccountableOfficer) {
          // Try to find custodian by ID first, then by name
          const { data: custodianData } = transfer.toAccountableOfficerId
            ? await supabase
              .from("custodians")
              .select("id, position")
              .eq("id", transfer.toAccountableOfficerId)
              .single()
            : await supabase
              .from("custodians")
              .select("id, position")
              .eq("name", transfer.toAccountableOfficer)
              .single();
          if (custodianData) {
            toCustodianPosition = custodianData.position || "";
            toCustodianId = custodianData.id || toCustodianId;
          }
        }

        const rollbackState: TransferCompletionRollbackState = {
          slipIds: [], // Unused now, but kept in state object for type compatibility
          slipItemIds: [], // Unused now
          propertyCardEntryIds: [],
          inventorySnapshots: [],
        };

        try {
          // Process all transfer items
          for (const item of transfer.items) {
            let inventoryItemId = item.inventoryItemId;

            if (!inventoryItemId && item.propertyNumber) {
              const { data: invLookup } = await supabase
                .from("inventory_items")
                .select("id")
                .eq("property_number", item.propertyNumber)
                .single();

              if (invLookup) {
                inventoryItemId = invLookup.id;
              }
            }

            if (!inventoryItemId) {
              throw new Error(`Inventory item not found for property number ${item.propertyNumber}`);
            }

            const { data: inventoryItem } = await supabase
              .from("inventory_items")
              .select("*")
              .eq("id", inventoryItemId)
              .single();

            if (!inventoryItem) {
              throw new Error(`Inventory data missing for property number ${item.propertyNumber}`);
            }

            if (!rollbackState.inventorySnapshots.some((snap) => snap.id === inventoryItem.id)) {
              rollbackState.inventorySnapshots.push({
                id: inventoryItem.id,
                custodian: inventoryItem.custodian,
                custodian_position: inventoryItem.custodian_position,
                assignment_status: inventoryItem.assignment_status,
                assigned_date: inventoryItem.assigned_date,
                ics_number: inventoryItem.ics_number,
                ics_date: inventoryItem.ics_date,
              });
            }

            const itemQuantity = inventoryItem.quantity || 1;
            const itemUnitCost = inventoryItem.unit_cost || 0;
            const itemTotalCost = itemQuantity * itemUnitCost;
            
            // Release the item temporarily so the availability trigger allows reassignment
            const { error: releaseError } = await supabase
              .from("inventory_items")
              .update({
                custodian: null,
                custodian_position: null,
                assignment_status: "Available",
                assigned_date: null,
                ics_number: null,
                ics_date: null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", inventoryItem.id);

            if (releaseError) {
              throw releaseError;
            }

            // Ensure ITR metadata and custodian assignment are reflected on the inventory item
            // We set ics_number to the ITR number as requested by the user, and use it as the main reference
            const itrReferenceNumber = transfer.itrNumber;
            
            const { error: invErr } = await supabase
              .from("inventory_items")
              .update({
                ics_number: itrReferenceNumber,
                ics_date: dateCompleted || new Date().toISOString().split("T")[0],
                // Re-assign to receiving custodian after temporary release
                custodian: transfer.toAccountableOfficer,
                custodian_position: toCustodianPosition || null,
                custodian_id: toCustodianId,
                assignment_status: "Assigned",
                assigned_date: dateCompleted || new Date().toISOString().split("T")[0],
                updated_at: new Date().toISOString(),
              })
              .eq("id", inventoryItem.id);

            if (invErr) {
              console.error(`Failed to update inventory item ${inventoryItem.property_number}:`, invErr);
              throw invErr;
            } else {
              console.log(`✅ Updated inventory item ${inventoryItem.property_number} to custodian ${transfer.toAccountableOfficer} with reference ${itrReferenceNumber}`);
            }

            // Create property card entry for the transfer
            const { data: propertyCard } = await supabase
              .from("property_cards")
              .select("id")
              .eq("inventory_item_id", inventoryItem.id)
              .single();

            if (propertyCard) {
              // Get last balance from property card
              let lastBalance = 0;
              const { data: lastEntry } = await supabase
                .from("property_card_entries")
                .select("balance_qty")
                .eq("property_card_id", propertyCard.id)
                .order("date", { ascending: false })
                .limit(1)
                .single();

              if (lastEntry && typeof lastEntry.balance_qty === "number") {
                lastBalance = lastEntry.balance_qty;
              }

              // Create transfer-out entry (issue from old custodian)
              const { data: transferOutEntry } = await supabase
                .from("property_card_entries")
                .insert({
                  property_card_id: propertyCard.id,
                  date: dateCompleted || new Date().toISOString().split("T")[0],
                  reference: transfer.itrNumber,
                  receipt_qty: 0,
                  unit_cost: 0,
                  total_cost: 0,
                  issue_item_no: inventoryItem.property_number,
                  issue_qty: itemQuantity,
                  office_officer: `Transfer to ${transfer.toAccountableOfficerDepartment ? `${transfer.toAccountableOfficerDepartment}-` : ""}${transfer.toAccountableOfficer}`,
                  balance_qty: Math.max(0, lastBalance - itemQuantity),
                  amount: 0,
                  remarks: `Transferred to ${transfer.toAccountableOfficer} via ITR ${transfer.itrNumber}`,
                  related_transfer_id: transferId,
                })
                .select('id')
                .single();

              if (transferOutEntry?.id) {
                rollbackState.propertyCardEntryIds.push(transferOutEntry.id);
              }

              // Create transfer-in entry (receipt by new custodian)
              // This now uses the ITR reference instead of an ICS slip
              const { data: transferInEntry } = await supabase
                .from("property_card_entries")
                .insert({
                  property_card_id: propertyCard.id,
                  date: dateCompleted || new Date().toISOString().split("T")[0],
                  reference: transfer.itrNumber,
                  receipt_qty: itemQuantity,
                  unit_cost: itemUnitCost,
                  total_cost: itemTotalCost,
                  issue_item_no: '',
                  issue_qty: 0,
                  office_officer: `${transfer.toAccountableOfficerDepartment ? `${transfer.toAccountableOfficerDepartment}-` : ""}${transfer.toAccountableOfficer}`,
                  balance_qty: itemQuantity,
                  amount: itemTotalCost,
                  remarks: `Received from ${transfer.fromAccountableOfficer} via ITR ${transfer.itrNumber}`,
                  related_transfer_id: transferId,
                })
                .select('id')
                .single();

              if (transferInEntry?.id) {
                rollbackState.propertyCardEntryIds.push(transferInEntry.id);
              }

              console.log(`✅ Created property card entries for ${inventoryItem.property_number}`);
            }
          }

          console.log(`🎉 Transfer completed: Items reassigned to ${transfer.toAccountableOfficer} using ITR ${transfer.itrNumber}`);
        } catch (transferProcessError) {
          await rollbackTransferCompletion(rollbackState);
          throw transferProcessError;
        }

        // Invalidate React Query caches to refresh the UI
        queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
        queryClient.invalidateQueries({ queryKey: ['custodian-summaries'] });
        queryClient.invalidateQueries({ queryKey: ['custodian-summary'] });
        queryClient.invalidateQueries({ queryKey: ['custodian-current-items'] });
        queryClient.invalidateQueries({ queryKey: ['custodian-item-history'] });
        queryClient.invalidateQueries({ queryKey: ['annex-custodian-slips'] });
        queryClient.invalidateQueries({ queryKey: ['annex-property-cards'] });
        queryClient.invalidateQueries({ queryKey: ['available-inventory-for-slips'] });
        queryClient.invalidateQueries({ queryKey: ['transfer-ics-options'] });
        queryClient.invalidateQueries({ queryKey: ['current-assigned-items'] });

      }

      // Refetch from server so UI shows accurate server state
      queryClient.invalidateQueries({ queryKey: ['property-transfers'] });

      toast({
        title: "Transfer completed",
        description:
          newStatus === "Completed"
            ? `Transfer completed successfully! ${transfer.items?.length || 0} item(s) have been transferred to ${transfer.toAccountableOfficer} with new ICS slip(s) created.`
            : `Transfer marked as ${newStatus}.`,
      });
      setIsProcessing(false);
    } catch (err) {
      console.error("Error updating transfer status:", err);
      toast({
        title: "Error updating status",
        description: err instanceof Error ? err.message : "Failed to update transfer status",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  // Confirm/Issue transfer mutation (similar to ICS confirmation)
  const confirmTransferMutation = useMutation({
    mutationFn: async (transferId: string) => {
      // Update transfer status to Issued
      const { error: updateError } = await supabase
        .from("property_transfers")
        .update({
          status: UI_TO_DB_STATUS["Issued"],
          updated_at: new Date().toISOString()
        })
        .eq("id", transferId);

      if (updateError) {
        throw new Error(`Failed to confirm transfer: ${updateError.message}`);
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Transfer has been officially confirmed and cannot be deleted"
      });
      setIsProcessing(false);
      // Refresh all related queries to pick up the new "Issued" status
      queryClient.invalidateQueries({ queryKey: ['property-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['custodian-summaries'] });
    },
    onError: (error: Error) => {
      setIsProcessing(false);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const handleConfirmTransfer = (transferId: string) => {
    if (confirm("Are you sure you want to officially confirm this transfer? Once confirmed, it cannot be deleted and will be marked as an official document.")) {
      setIsProcessing(true);
      confirmTransferMutation.mutate(transferId);
    }
  };

  const handleDeleteTransfer = async (transferId: string) => {
    setIsProcessing(true);
    // Get transfer to check status
    const transfer = transfers.find((t) => t.id === transferId);

    // Warn user about deleting completed/issued transfers
    if (transfer?.status === "Completed" || transfer?.status === "Issued") {
      const confirmed = window.confirm(
        `Warning: This transfer is marked as "${transfer.status}". Deleting it will remove all associated records including property card entries. Are you absolutely sure you want to proceed?`
      );
      if (!confirmed) {
        setIsProcessing(false);
        return;
      }
    } else if (!window.confirm("Are you sure you want to delete this transfer? This action cannot be undone.")) {
      setIsProcessing(false);
      return;
    }

    try {
      // Optimistic UI update: instantly remove the transfer from the list
      queryClient.setQueryData(['transfers'], (old: any) => 
        (old || []).filter((t: any) => t.id !== transferId)
      );

      // Revert inventory assignments back to the original custodians for the deleted transfer
      const { data: transferItems, error: transferItemsError } = await supabase
        .from("transfer_items")
        .select("inventory_item_id, from_custodian, to_custodian")
        .eq("transfer_id", transferId);

      if (transferItemsError) {
        throw transferItemsError;
      }

      const items = (transferItems || []).filter((ti: any) => ti.inventory_item_id);

      if (items.length > 0) {
        // Build a map of from_custodian name -> custodian metadata (id, position)
        const fromNames = Array.from(
          new Set(
            items
              .map((ti: any) => ti.from_custodian)
              .filter((name: string | null | undefined): name is string => Boolean(name))
          )
        );

        const custodianMeta = new Map<string, { id?: string | null; position?: string | null }>();
        if (fromNames.length > 0) {
          const { data: custodianRows, error: custodianError } = await supabase
            .from("custodians")
            .select("id, name, position")
            .in("name", fromNames);

          if (!custodianError && custodianRows) {
            (custodianRows as any[]).forEach((row: any) => {
              if (!row?.name) return;
              custodianMeta.set(row.name, {
                id: row.id,
                position: row.position,
              });
            });
          }
        }

        // Revert each inventory item back to its original custodian (run in parallel)
        const revertPromises = (items as any[]).map(async (ti) => {
          const meta = custodianMeta.get(ti.from_custodian) || {};
          const updatePayload: Record<string, any> = {
            custodian: ti.from_custodian || null,
            assignment_status: "Assigned",
            updated_at: new Date().toISOString(),
          };

          if (meta.position) {
            updatePayload.custodian_position = meta.position;
          }

          if (meta.id) {
            updatePayload.custodian_id = meta.id;
          }

          const { error: revertError } = await supabase
            .from("inventory_items")
            .update(updatePayload)
            .eq("id", ti.inventory_item_id);

          if (revertError) {
            console.warn("Failed to revert inventory item to original custodian", ti.inventory_item_id, revertError);
          }
        });
        
        await Promise.all(revertPromises);
      }

      // Delete property card entries that reference this transfer
      const { error: entriesError } = await supabase
        .from("property_card_entries")
        .delete()
        .eq("related_transfer_id", transferId);

      if (entriesError) {
        console.warn("Error deleting property card entries (may not exist):", entriesError);
        // Continue even if this fails - entries may not exist
      }

      // Delete transfer items first (due to foreign key)
      const { error: itemsError } = await supabase
        .from("transfer_items")
        .delete()
        .eq("transfer_id", transferId);

      if (itemsError) throw itemsError;

      // Delete transfer
      const { error: transferError } = await supabase
        .from("property_transfers")
        .delete()
        .eq("id", transferId);

      if (transferError) throw transferError;

      // Invalidate queries to refresh the list and custodian views
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      queryClient.invalidateQueries({ queryKey: ["custodian-summaries"] });
      queryClient.invalidateQueries({ queryKey: ["custodian-current-items"] });

      toast({
        title: "Transfer deleted",
        description:
          transfer?.status === "Draft"
            ? "Draft transfer deleted. Items have been returned to their previous custodians."
            : "The transfer has been permanently removed.",
      });
      setIsProcessing(false);
    } catch (err) {
      console.error("Error deleting transfer:", err);
      setIsProcessing(false);
      queryClient.invalidateQueries({ queryKey: ["transfers"] }); // Rollback optimistic UI
      toast({
        title: "Error deleting transfer",
        description: err instanceof Error ? err.message : "Failed to delete transfer",
        variant: "destructive",
      });
    }
  };

  const toggleCardExpansion = (transferId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(transferId)) {
        newSet.delete(transferId);
      } else {
        newSet.add(transferId);
      }
      return newSet;
    });
  };

  const handlePrint = (transfer: Transfer) => {
    setSelectedTransfer(transfer);
    setShowPrintPreview(true);
  };

  const handleExport = () => {
    if (!filteredTransfers.length) {
      toast({
        title: "Nothing to export",
        description: "Adjust the filters to include at least one transfer before exporting.",
        variant: "destructive",
      });
      return;
    }

    const rows = [
      [
        "ITR No.",
        "Entity",
        "Fund Cluster",
        "From Officer",
        "To Officer",
        "Date",
        "Transfer Type",
        "Status",
        "Reason",
        "Item Count",
        "Items",
        "Total Amount",
      ],
    ];

    filteredTransfers.forEach((transfer) => {
      const totalAmount = transfer.items.reduce((sum, item) => sum + (item.amount ?? 0), 0);
      const itemSummary = transfer.items
        .map((item) => `${item.propertyNumber} - ${item.description}`)
        .join("; ");

      rows.push([
        transfer.itrNumber,
        transfer.entityName,
        transfer.fundCluster,
        formatCustodianLine(transfer.fromAccountableOfficer, transfer.fromAccountableOfficerDepartment),
        formatCustodianLine(transfer.toAccountableOfficer, transfer.toAccountableOfficerDepartment),
        transfer.date,
        transfer.transferType === "Others" && transfer.otherTransferType
          ? `${transfer.transferType} (${transfer.otherTransferType})`
          : transfer.transferType,
        transfer.status,
        transfer.reason,
        transfer.items.length.toString(),
        itemSummary,
        totalAmount ? formatCurrency(totalAmount) : "",
      ]);
    });

    downloadCsv(`inventory-transfers-${Date.now()}.csv`, rows);
  };

  const handleRemoveItem = (propertyNumber: string) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.propertyNumber !== propertyNumber),
    }));
  };

  const handleOpenItemSelector = () => {
    if (!formData.fromAccountableOfficer) {
      toast({
        title: "Select an accountable officer first",
        description: "Please choose the releasing accountable officer to filter the ICS items.",
        variant: "destructive",
      });
      return;
    }
    setItemSelectorOpen(true);
  };

  const handleToggleItemSelection = (itemId: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const handleConfirmItemSelection = () => {
    const selectedOptions = availableIcsItems.filter((item) => selectedItemIds.includes(item.id));
    if (!selectedOptions.length) {
      toast({
        title: "No items selected",
        description: "Choose at least one item from the list before confirming.",
        variant: "destructive",
      });
      return;
    }

    setFormData((prev) => {
      const merged = new Map<string, TransferItem>();
      prev.items.forEach((item) => merged.set(item.propertyNumber, item));
      selectedOptions
        .map((option) => ({
          propertyNumber: option.propertyNumber,
          description: option.description,
          quantity: option.quantity,
          unit: 'piece',
          serialNumber: option.serialNumber,
          condition: option.condition,
          dateAcquired: option.dateAcquired,
          amount: option.amount,
          unitCost: option.unitCost,
          icsSlipId: option.icsSlipId,
          icsSlipNumber: option.icsSlipNumber,
          icsDate: option.icsDate,
          inventoryItemId: option.inventoryItemId,
          custodianName: option.custodianName,
        }))
        .forEach((item) => merged.set(item.propertyNumber, item));
      return {
        ...prev,
        items: Array.from(merged.values()),
      };
    });

    setSelectedItemIds([]);
    setItemSelectorOpen(false);
  };

  const updateItemField = (propertyNumber: string, field: keyof TransferItem, value: TransferItem[keyof TransferItem]) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.propertyNumber === propertyNumber ? { ...it, [field]: value } : it)),
    }));
  };

  const previewTransfer: Transfer = useMemo(
    () => ({
      id: "preview",
      entityName: formData.entityName,
      fromAccountableOfficer: formData.fromAccountableOfficer,
      fromAccountableOfficerDepartment: formData.fromAccountableOfficerDepartment,
      fromAccountableOfficerDesignation: formData.fromAccountableOfficerDesignation,
      toAccountableOfficer: formData.toAccountableOfficer,
      toAccountableOfficerDepartment: formData.toAccountableOfficerDepartment,
      toAccountableOfficerDesignation: formData.toAccountableOfficerDesignation,
      fundCluster: formData.fundCluster,
      itrNumber: formData.itrNumber,
      date: formData.date,
      transferType: formData.transferType,
      otherTransferType: formData.otherTransferType,
      reason: formData.reason,
      status: formData.status,
      items: formData.items,
      issuedBy: formData.issuedBy,
      history: [],
    }),
    [formData]
  );

  const [isEditMode, setIsEditMode] = useState(false);
  const totalSelectedAmount = formData.items.reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const isPreviewReady =
    isCreating &&
    (formData.entityName ||
      formData.fundCluster ||
      formData.itrNumber ||
      formData.items.length > 0 ||
      formData.reason);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Property Transfers"
        action={
          <Button onClick={() => setIsCreating(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Transfer
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search by ITR no., officer, reason, or item…"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="pl-10"
          />
        </div>
        <Input
          type="date"
          value={fromDateFilter}
          onChange={(event) => setFromDateFilter(event.target.value)}
          placeholder="From date"
        />
        <Input
          type="date"
          value={toDateFilter}
          onChange={(event) => setToDateFilter(event.target.value)}
          placeholder="To date"
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={handleExport} className="flex-1 sm:flex-none">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="flex-1 sm:flex-none"
            onClick={() => {
              setFromDateFilter("");
              setToDateFilter("");
              setSearchTerm("");
            }}
          >
            Clear Filters
          </Button>
        </div>
      </div>

      {isCreating && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Card>
            <CardHeader>
              <CardTitle>{editingTransferId ? "Edit Transfer" : "Create Inventory Transfer Report"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="entityName">Entity Name *</Label>
                  <Input
                    id="entityName"
                    value={formData.entityName}
                    readOnly
                    className="bg-muted"
                  />
                  {errors.entityName && (
                    <p className="mt-1 text-sm text-destructive">{errors.entityName}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    System-wide Entity Name (Locked)
                  </p>
                </div>
                <div>
                  <Label htmlFor="fundCluster">Fund Cluster *</Label>
                  <Input
                    id="fundCluster"
                    value={formData.fundCluster}
                    onChange={(event) => setFormData({ ...formData, fundCluster: event.target.value })}
                    placeholder="e.g., 101"
                  />
                  {errors.fundCluster && (
                    <p className="mt-1 text-sm text-destructive">{errors.fundCluster}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="itrNumber">ITR No. *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="itrNumber"
                      value={formData.itrNumber}
                      onChange={(event) =>
                        setFormData({ ...formData, itrNumber: event.target.value.toUpperCase() })
                      }
                      placeholder="2025-11-SPHV-0001"
                    />
                    <Button type="button" variant="outline" onClick={handleGenerateItrNumber}>
                      Generate
                    </Button>
                  </div>
                  {errors.itrNumber && (
                    <p className="mt-1 text-sm text-destructive">{errors.itrNumber}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Format: YYYY-MM-SPHV|SPLV-#### (per month and value category)
                  </p>
                </div>
                <div>
                  <Label htmlFor="transferDate">Date *</Label>
                  <Input
                    id="transferDate"
                    type="date"
                    value={formData.date}
                    onChange={(event) => setFormData({ ...formData, date: event.target.value })}
                  />
                  {errors.date && <p className="mt-1 text-sm text-destructive">{errors.date}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <CustodianSelector
                    className="space-y-1"
                    label="From Accountable Officer *"
                    value={formData.fromAccountableOfficer}
                    onChange={(name: string, custodian?: Custodian) =>
                      setFormData((prev) => ({
                        ...prev,
                        fromAccountableOfficer: name,
                        fromAccountableOfficerDepartment: custodian?.department_name,
                        fromAccountableOfficerDesignation: custodian?.position || "",
                        fromAccountableOfficerId: custodian?.id,
                      }))
                    }
                    placeholder="Search custodians..."
                    required
                  />
                  {errors.fromOfficer && (
                    <p className="mt-1 text-sm text-destructive">{errors.fromOfficer}</p>
                  )}
                </div>
                <div>
                  <CustodianSelector
                    className="space-y-1"
                    label="To Accountable Officer *"
                    value={formData.toAccountableOfficer}
                    onChange={(name: string, custodian?: Custodian) =>
                      setFormData((prev) => ({
                        ...prev,
                        toAccountableOfficer: name,
                        toAccountableOfficerDepartment: custodian?.department_name,
                        toAccountableOfficerDesignation: custodian?.position || "",
                        toAccountableOfficerId: custodian?.id,
                      }))
                    }
                    placeholder="Search custodians..."
                    required
                  />
                  {errors.toOfficer && (
                    <p className="mt-1 text-sm text-destructive">{errors.toOfficer}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Transfer Type *</Label>
                  <Select
                    value={formData.transferType}
                    onValueChange={(value: TransferType) =>
                      setFormData((prev) => ({
                        ...prev,
                        transferType: value,
                        otherTransferType: value === "Others" ? prev.otherTransferType : "",
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select transfer type" />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSFER_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {formData.transferType === "Others" && (
                  <div>
                    <Label htmlFor="otherTransferType">Specify Other Transfer Type</Label>
                    <Input
                      id="otherTransferType"
                      value={formData.otherTransferType || ""}
                      onChange={(event) =>
                        setFormData({ ...formData, otherTransferType: event.target.value })
                      }
                      placeholder="Describe the transfer type"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-base font-semibold">Items to Transfer *</Label>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={handleOpenItemSelector}>
                      Select from ICS
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={() => setIsEditMode((v) => !v)}>
                      {isEditMode ? "Disable Edit" : "Enable Edit"}
                    </Button>
                    {isLoadingIcs && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  </div>
                </div>
                {errors.items && <p className="text-sm text-destructive">{errors.items}</p>}
                {formData.items.length === 0 ? (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground bg-muted/30">
                    Select items from existing ICS slips. The table will auto-fill Item No., ICS number/date,
                    description, amount, and condition.
                  </div>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[120px]">Item No.</TableHead>
                          <TableHead>ICS No./Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right w-[120px]">Amount</TableHead>
                          <TableHead className="w-[140px]">Condition</TableHead>
                          <TableHead className="w-[160px] text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {formData.items.map((item) => {
                          const icsDisplay = [item.icsSlipNumber, item.icsDate].filter(Boolean).join(" / ");
                          return (
                            <TableRow key={item.propertyNumber}>
                              <TableCell className="font-medium">{item.propertyNumber}</TableCell>
                              <TableCell>{icsDisplay || "—"}</TableCell>
                              <TableCell>
                                {isEditMode ? (
                                  <div className="space-y-1">
                                    <Input
                                      value={item.description}
                                      onChange={(e) => updateItemField(item.propertyNumber, 'description', e.target.value)}
                                    />
                                    <div className="text-xs text-muted-foreground">
                                      {formatDate(item.dateAcquired)}{item.quantity ? ` • Qty: ${item.quantity}` : ""}
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="font-medium">{item.description}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {formatDate(item.dateAcquired)}{item.quantity ? ` • Qty: ${item.quantity}` : ""}
                                    </div>
                                  </>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {isEditMode ? (
                                  <Input
                                    type="number"
                                    value={item.amount ?? 0}
                                    onChange={(e) => updateItemField(item.propertyNumber, 'amount', Number(e.target.value))}
                                    className="w-28 text-right"
                                  />
                                ) : (
                                  item.amount !== undefined ? formatCurrency(item.amount) : "—"
                                )}
                              </TableCell>
                              <TableCell>
                                {isEditMode ? (
                                  <Input
                                    value={item.condition || ""}
                                    onChange={(e) => updateItemField(item.propertyNumber, 'condition', e.target.value)}
                                  />
                                ) : (
                                  item.condition || "—"
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      navigate(`/property-cards?search=${encodeURIComponent(item.propertyNumber)}`)
                                    }
                                  >
                                    Card
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      navigate(
                                        `/custodian-slips?slip=${encodeURIComponent(item.icsSlipNumber || "")}`
                                      )
                                    }
                                  >
                                    ICS
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveItem(item.propertyNumber)}
                                  >
                                    Remove
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    <div className="px-4 py-2 text-sm text-right text-muted-foreground border-t">
                      Total amount of selected items: <span className="font-semibold">{formatCurrency(totalSelectedAmount)}</span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="reason">Reason for Transfer *</Label>
                <Textarea
                  id="reason"
                  value={formData.reason}
                  onChange={(event) => setFormData({ ...formData, reason: event.target.value })}
                  placeholder="Provide the justification or remarks for this transfer."
                  rows={4}
                />
                {errors.reason && <p className="mt-1 text-sm text-destructive">{errors.reason}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="approvedBy">Approved By (Name)</Label>
                  <Input
                    id="approvedBy"
                    value={formData.approvedBy || ""}
                    onChange={(event) => setFormData({ ...formData, approvedBy: event.target.value })}
                    placeholder="e.g. Carla May Dangao"
                  />
                </div>
                <div>
                  <Label htmlFor="approvedByDesignation">Approved By (Designation)</Label>
                  <Input
                    id="approvedByDesignation"
                    value={formData.approvedByDesignation || ""}
                    onChange={(event) => setFormData({ ...formData, approvedByDesignation: event.target.value })}
                    placeholder="e.g. Supervising Administrative Officer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="issuedBy">Released/Issued By (Name)</Label>
                  <Input
                    id="issuedBy"
                    value={formData.issuedBy || ""}
                    onChange={(event) => setFormData({ ...formData, issuedBy: event.target.value })}
                    placeholder="Officer releasing the items"
                  />
                </div>
                <div>
                  <Label htmlFor="issuedByDesignation">Released/Issued By (Designation)</Label>
                  <Input
                    id="issuedByDesignation"
                    value={formData.issuedByDesignation || ""}
                    onChange={(event) => setFormData({ ...formData, issuedByDesignation: event.target.value })}
                    placeholder="e.g. Supply Officer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <CustodianSelector
                    className="space-y-1"
                    label="Received By (Name)"
                    value={formData.receivedBy || ""}
                    onChange={(name: string, custodian?: Custodian) =>
                      setFormData((prev) => ({
                        ...prev,
                        receivedBy: name,
                        receivedByDesignation: custodian?.position || prev.receivedByDesignation || "",
                      }))
                    }
                    placeholder="Search recipients..."
                  />
                </div>
                <div>
                  <Label htmlFor="receivedByDesignation">Received By (Designation)</Label>
                  <Input
                    id="receivedByDesignation"
                    value={formData.receivedByDesignation || ""}
                    onChange={(event) => setFormData({ ...formData, receivedByDesignation: event.target.value })}
                    placeholder="e.g. Supply Clerk"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => {
                  setIsCreating(false);
                  setEditingTransferId(null);
                }}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleCreateTransfer}>
                  {editingTransferId ? "Update Transfer" : "Save Transfer"}
                </Button>
              </div>
            </CardContent>
          </Card>


        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredTransfers.map((transfer) => {
          const totalAmount = transfer.items.reduce((sum, item) => sum + (item.amount ?? 0), 0);
          const isExpanded = expandedCards.has(transfer.id) || hoveredCard === transfer.id;

          return (
            <Card key={transfer.id} className="flex flex-col hover:shadow-md transition-shadow duration-200 cursor-pointer"
                  onMouseEnter={() => setHoveredCard(transfer.id)}
                  onMouseLeave={() => setHoveredCard(null)}
                  onClick={() => toggleCardExpansion(transfer.id)}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{transfer.itrNumber}</CardTitle>
                    {isRecentlyAddedTransfer(transfer) && (
                      <Badge variant="default" className="bg-emerald-600 text-white text-xs">
                        Recently Added
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={transfer.status === "Draft" ? "secondary" : transfer.status === "Issued" ? "default" : transfer.status === "Completed" ? "default" : transfer.status === "Rejected" ? "destructive" : "secondary"} className="flex items-center gap-1">
                      {transfer.status === "Draft" ? <Clock className="h-3.5 w-3.5" /> : transfer.status === "Issued" ? <CheckCircle className="h-3.5 w-3.5" /> : transfer.status === "Completed" ? <CheckCircle className="h-3.5 w-3.5" /> : transfer.status === "Rejected" ? <AlertCircle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                      {transfer.status}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleCardExpansion(transfer.id)}
                      className="h-8 w-8 p-0"
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                {!isExpanded && (
                  <p className="text-sm text-muted-foreground">{formatDate(transfer.date)}</p>
                )}
              </CardHeader>

              {isExpanded && (
                <CardContent className="flex flex-1 flex-col gap-4 text-sm">
                  <div className="space-y-1.5">
                    <p>
                      <strong>Entity:</strong> {transfer.entityName}
                    </p>
                    <p>
                      <strong>Fund Cluster:</strong> {transfer.fundCluster}
                    </p>
                    <p>
                      <strong>From:</strong>{" "}
                      {formatCustodianLine(
                        transfer.fromAccountableOfficer,
                        transfer.fromAccountableOfficerDepartment
                      ) || "—"}
                    </p>
                    <p>
                      <strong>To:</strong>{" "}
                      {formatCustodianLine(
                        transfer.toAccountableOfficer,
                        transfer.toAccountableOfficerDepartment
                      ) || "—"}
                    </p>
                    <p>
                      <strong>Transfer Type:</strong>{" "}
                      {transfer.transferType === "Others" && transfer.otherTransferType
                        ? `${transfer.transferType} – ${transfer.otherTransferType}`
                        : transfer.transferType}
                    </p>
                    <p>
                      <strong>Reason:</strong> {transfer.reason || "—"}
                    </p>
                    {totalAmount > 0 && (
                      <p>
                        <strong>Total Amount:</strong> {formatCurrency(totalAmount)}
                      </p>
                    )}
                  </div>

                  {transfer.items.length > 0 && (
                    <div className="border rounded-md overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Item No.</TableHead>
                            <TableHead>ICS</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {transfer.items.map((item) => {
                            const icsDisplay = [item.icsSlipNumber, item.icsDate].filter(Boolean).join(" / ");
                            return (
                              <TableRow key={item.propertyNumber}>
                                <TableCell className="font-medium">{item.propertyNumber}</TableCell>
                                <TableCell>{icsDisplay || "—"}</TableCell>
                                <TableCell>
                                  <div>{item.description}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {item.condition || "—"}
                                    {item.quantity ? ` • Qty: ${item.quantity}` : ""}
                                    {item.serialNumber ? ` • SN: ${item.serialNumber}` : ""}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  {item.amount !== undefined ? formatCurrency(item.amount) : "—"}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <History className="h-4 w-4" />
                      History
                    </div>
                    <ScrollArea className="mt-2 max-h-32 pr-2">
                      <div className="space-y-1.5 text-xs text-muted-foreground">
                        {transfer.history.map((entry, index) => (
                          <div key={`${entry.timestamp}-${index}`}>
                            <span className="font-medium text-foreground">{formatDateTime(entry.timestamp)}</span>{" "}
                            — {entry.action} ({entry.status})
                            {entry.details && <div className="ml-5 text-[11px]">{entry.details}</div>}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>

                  <div className="mt-auto flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Button 
                        type="button" 
                        size="sm" 
                        variant="outline" 
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditTransfer(transfer);
                        }}
                        disabled={transfer.status === "Completed" || transfer.status === "Issued"}
                      >
                        Edit Transfer
                      </Button>
                      <Button 
                        type="button" 
                        size="sm" 
                        variant="outline" 
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePrint(transfer);
                        }}
                      >
                        <Printer className="h-4 w-4 mr-2" />
                        Print
                      </Button>
                    </div>

                    {(transfer.status === "Rejected" || transfer.status === "Completed") && (
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="w-full"
                        onClick={() => handleDeleteTransfer(transfer.id)}
                      >
                        {transfer.status === "Rejected" ? "Delete Rejected Transfer" : "Delete Completed Transfer"}
                      </Button>
                    )}

                    {/* Show Confirm button for Draft transfers (like ICS) */}
                    {(transfer.status === "Draft" || !transfer.status) && (
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={() => handleConfirmTransfer(transfer.id)}
                        disabled={confirmTransferMutation.isPending}
                        title="Confirm this transfer as official (cannot be deleted after confirmation)"
                      >
                        {confirmTransferMutation.isPending ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                            Confirming...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-3.5 w-3.5 mr-2" />
                            Confirm
                          </>
                        )}
                      </Button>
                    )}

                    {/* Show Delete button for Draft transfers only */}
                    {(transfer.status === "Draft" || !transfer.status) && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="flex-1 text-red-600 hover:text-red-700"
                        onClick={() => handleDeleteTransfer(transfer.id)}
                        title="Delete this draft transfer"
                      >
                        Delete
                      </Button>
                    )}

                    {/* Show action buttons for Issued transfers */}
                    {transfer.status === "Issued" && (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleStatusUpdate(transfer.id, "Completed")}
                        >
                          Mark Complete
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="flex-1"
                          onClick={() => handleStatusUpdate(transfer.id, "Rejected")}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}

        {!filteredTransfers.length && (
          <Card className="col-span-full border-dashed border-muted-foreground/40">
            <CardHeader>
              <CardTitle className="text-lg">No transfers found</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              Adjust the filters or create a new transfer to see it listed here.
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={showPrintPreview} onOpenChange={setShowPrintPreview}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ITR Print Preview</DialogTitle>
            <DialogDescription>
              Inventory Transfer Report (Annex A.5) — Verify layout before printing.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center bg-muted/30 p-4 rounded-lg overflow-auto">
            {selectedTransfer && renderPrintLayout(selectedTransfer, true)}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPrintPreview(false)}>
              Close
            </Button>
            <Button onClick={() => printDocument(PRINT_LAYOUT.A4_PORTRAIT)}>
              <Printer className="h-4 w-4 mr-2" />
              Print / Save as PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print View attached to Body via Portal */}
      {selectedTransfer && createPortal(
        <PrintDocumentLayout layout={PRINT_LAYOUT.A4_PORTRAIT} className="print-portal-root">
          {renderPrintLayout(selectedTransfer)}
        </PrintDocumentLayout>,
        document.body
      )}

      <Dialog open={isItemSelectorOpen} onOpenChange={setItemSelectorOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Select Items from ICS</DialogTitle>
            <DialogDescription>
              Showing items issued to {formData.fromAccountableOfficer || "the selected accountable officer"}.
              Choose the items that will be transferred.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              placeholder="Search by item number, description, ICS number…"
              value={itemSearchTerm}
              onChange={(event) => setItemSearchTerm(event.target.value)}
            />
            <div className="border rounded-md h-[360px] overflow-hidden">
              <ScrollArea className="h-[360px]">
                <Table className="table-fixed">
                  <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
                    <TableRow>
                      <TableHead className="w-[48px]" />
                      <TableHead className="w-[160px]">Item No.</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-[200px]">ICS No.</TableHead>
                      <TableHead className="w-[140px]">Date Issued</TableHead>
                      <TableHead className="w-[140px] text-right">Amount</TableHead>
                      <TableHead className="w-[160px]">Condition</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingIcs ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center">
                          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading ICS items…
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : availableIcsItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                          No ICS items found for the selected officer. Adjust your search or confirm the officer selection.
                        </TableCell>
                      </TableRow>
                    ) : (
                      availableIcsItems.map((item) => {
                        const checked = selectedItemIds.includes(item.id);
                        return (
                          <TableRow
                            key={item.id}
                            className="cursor-pointer"
                            onClick={() => handleToggleItemSelection(item.id)}
                          >
                            <TableCell className="w-[48px]">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => handleToggleItemSelection(item.id)}
                              />
                            </TableCell>
                            <TableCell className="w-[160px] font-medium">{item.propertyNumber}</TableCell>
                            <TableCell className="truncate">
                              <div>{item.description || "—"}</div>
                              {item.serialNumber && (
                                <div className="text-xs text-muted-foreground">SN: {item.serialNumber}</div>
                              )}
                            </TableCell>
                            <TableCell className="w-[200px] truncate">{item.icsSlipNumber || "—"}</TableCell>
                            <TableCell className="w-[140px]">{formatDate(item.icsDate)}</TableCell>
                            <TableCell className="w-[140px] text-right">
                              {item.amount !== undefined ? formatCurrency(item.amount) : "—"}
                            </TableCell>
                            <TableCell className="w-[160px]">{item.condition || "—"}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <p className="text-sm text-muted-foreground">
              {selectedItemIds.length
                ? `${selectedItemIds.length} item(s) selected`
                : "Select one or more items to add to the transfer."}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setItemSelectorOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleConfirmItemSelection}>
                Add Selected Items
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
            background: white !important;
          }
          /* Hide all main app content and dialog backdrops */
          body > *:not(.print-portal-root) {
            display: none !important;
          }
          /* Show portal content specifically */
          .print-portal-root {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: white !important;
            padding: 0;
          }
          .signature-section { break-inside: avoid; }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>

      {isProcessing && (
        <div className="fixed inset-0 z-[10000] bg-black/50 flex items-center justify-center">
          <div className="bg-card text-foreground rounded-md p-6 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Updating…</span>
          </div>
        </div>
      )}
    </div>
  );
};
