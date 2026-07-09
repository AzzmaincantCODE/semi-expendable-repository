// =====================================================
// Registry of Semi-Expendable Property Issued - Annex A.4
// Groups by SEMI-EXPENDABLE CATEGORY (e.g. "AGRICULTURAL AND FORESTRY EQUIPMENT")
// Each card shows ALL items in that category with issue/return/re-issue/disposal history
// =====================================================

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  BookOpen, Printer, Package, Scale, Eye, X, FolderOpen, ChevronsUpDown, Check, Download
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { createPortal } from "react-dom";
import headerLogo from "@/assets/HEADERLOGO.png";
import { cn } from "@/lib/utils";
import { PrintDocumentLayout, PrintLayoutHint } from "@/components/print/PrintDocumentLayout";
import { printDocument } from "@/lib/printDocument";
import { PRINT_LAYOUT } from "@/lib/printLayouts";
import { exportToExcel } from "@/lib/excelExport";

// ── Types ────────────────────────────────────────────

/** One row in the registry table — one ICS event for a specific item */
interface RegistryRow {
  date: string;
  icsNumber: string;
  propertyNumber: string;
  description: string;
  estimatedUsefulLife: string;
  issuedQty: number;
  issuedOfficer: string;
  returnedQty: number;
  returnedOfficer: string;
  reissuedQty: number;
  reissuedOfficer: string;
  disposedQty: number;
  balanceQty: number;
  amount: number;
  remarks: string;
}

/** One semi-expendable category with all its items */
interface CategoryRegistry {
  categoryName: string;
  fundCluster: string;
  rows: RegistryRow[];
  totalAmount: number;
  totalItems: number;
}

// ── Helpers ──────────────────────────────────────────
const fmtCurrency = (n: number) =>
  `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d: string) => {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "2-digit", day: "2-digit" });
};

// ── Component ────────────────────────────────────────
export const Registry = () => {
  const queryClient = useQueryClient();
  const [selectedFilter, setSelectedFilter] = useState<string>(""); // empty = all
  const [comboOpen, setComboOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryRegistry | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  // ── Real-time subscription ──
  useEffect(() => {
    const channel = supabase
      .channel("realtime:registry")
      .on("postgres_changes", { event: "*", schema: "public", table: "custodian_slips" }, () => {
        queryClient.invalidateQueries({ queryKey: ["registry-categories"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "custodian_slip_items" }, () => {
        queryClient.invalidateQueries({ queryKey: ["registry-categories"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_items" }, () => {
        queryClient.invalidateQueries({ queryKey: ["registry-categories"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "transfer_items" }, () => {
        queryClient.invalidateQueries({ queryKey: ["registry-categories"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // ── Fetch all items grouped by semi-expendable category ──
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["registry-categories"],
    queryFn: async () => {
      // 1. Fetch initial issuances (ICS)
      const { data: slipData, error: slipError } = await supabase
        .from("custodian_slip_items")
        .select(`
          quantity, amount, inventory_item_id, property_number, description,
          custodian_slips!inner (
            slip_number, custodian_name, office, date_issued, created_at
          ),
          inventory_items (
            id, property_number, description, total_cost,
            estimated_useful_life, semi_expandable_category, category, sub_category, assignment_status, condition,
            fund_sources ( name )
          )
        `);

      if (slipError) throw slipError;

      // 2. Fetch transfers (ITR)
      const { data: transferData, error: transferError } = await supabase
        .from("property_transfers")
        .select(`
          *,
          transfer_items (
            quantity, inventory_item_id, property_number, description,
            inventory_items (
              id, property_number, description, total_cost,
              estimated_useful_life, semi_expandable_category, category, sub_category, assignment_status, condition,
              fund_sources ( name )
            )
          )
        `);

      if (transferError) throw transferError;

      // 2.5 Fetch custodian metadata for both ICS and Transfers
      const officerNames = new Set<string>();
      (slipData || []).forEach(row => {
        const slip = Array.isArray(row.custodian_slips) ? row.custodian_slips[0] : row.custodian_slips;
        if (slip?.custodian_name) officerNames.add(slip.custodian_name);
      });
      (transferData || []).forEach(t => {
        if (t.to_custodian) officerNames.add(t.to_custodian);
        if (t.from_custodian) officerNames.add(t.from_custodian);
        if (t.to_department) officerNames.add(t.to_department);
        if (t.from_department) officerNames.add(t.from_department);
      });

      const custodianMeta = new Map<string, string>(); // Name -> Office
      if (officerNames.size > 0) {
        const { data: custs } = await supabase
          .from("custodians")
          .select("name, office")
          .in("name", Array.from(officerNames));
        
        (custs || []).forEach(c => {
          if (c.name && c.office) custodianMeta.set(c.name.trim().toLowerCase(), c.office.trim().toUpperCase());
        });
      }
      type UnifiedEvent = {
        date: string;
        createdAt: string;
        reference: string;
        custodianName: string;
        office: string;
        quantity: number;
        amount: number;
        inventoryItemId: string;
        inventoryItem: Record<string, unknown> | null;
        rawPropNumber: string;
        rawDesc: string;
      };

      const events: UnifiedEvent[] = [];

      (slipData || []).forEach(row => {
        const slip = (Array.isArray(row.custodian_slips) ? row.custodian_slips[0] : row.custodian_slips) as Record<string, unknown>;
        const inv = (Array.isArray(row.inventory_items) ? row.inventory_items[0] : row.inventory_items) as Record<string, unknown>;
        
        let ref = (slip?.slip_number as string) || "";
        if (ref && !ref.toUpperCase().startsWith('ICS')) {
          ref = `ICS-${ref}`;
        }
        
        events.push({
          date: (slip?.date_issued as string) || "",
          createdAt: (slip?.created_at as string) || (slip?.date_issued as string) || "",
          reference: ref,
          custodianName: (slip?.custodian_name as string) || "",
          office: (slip?.office as string) || "",
          quantity: Number(row.quantity) || 1,
          amount: Number(row.amount) || 0,
          inventoryItemId: (row.inventory_item_id as string) || (inv?.id as string) || "",
          inventoryItem: inv || null,
          rawPropNumber: (row.property_number as string) || "",
          rawDesc: (row.description as string) || "",
        });
      });

      (transferData || []).forEach(transfer => {
        const tItems = transfer.transfer_items as any[];
        (tItems || []).forEach(row => {
          const inv = (Array.isArray(row.inventory_items) ? row.inventory_items[0] : row.inventory_items) as Record<string, unknown> | null;
          const invAmount = inv?.total_cost ? Number(inv.total_cost) : 0;
          
          const toCust = (transfer.to_custodian as string) || (transfer.to_department as string) || "";
          const toOffice = custodianMeta.get(toCust.toLowerCase()) || "";

          let ref = (transfer.itr_number || transfer.transfer_number || "Draft") as string;
          if (ref && ref !== "Draft" && !ref.toUpperCase().startsWith('ITR')) {
            ref = `ITR-${ref}`;
          }

          events.push({
            date: (transfer.date_requested as string) || (transfer.date as string) || "",
            createdAt: (transfer.created_at as string) || (transfer.date_requested as string) || "",
            reference: ref,
            custodianName: toCust,
            office: toOffice,
            quantity: Number(row.quantity) || 1,
            amount: invAmount,
            inventoryItemId: (row.inventory_item_id as string) || (inv?.id as string) || "",
            inventoryItem: inv,
            rawPropNumber: (row.property_number as string) || "",
            rawDesc: (row.description as string) || "",
          });
        });
      });

      // Sort by creation time (or date) ascending so oldest events are processed first
      events.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      // 4. Group by inventoryItemId, maintaining exactly one row per item
      const itemRowMap = new Map<string, RegistryRow & { _catName: string, _fundCluster: string, _latestCustodian: string }>();
      const latestInvMap = new Map<string, Record<string, unknown>>(); // To check final availability

      for (const ev of events) {
        const inv = ev.inventoryItem;
        const propNumKey = (inv?.property_number as string) || ev.rawPropNumber || ev.inventoryItemId;

        const catName = (inv?.semi_expandable_category as string)
          || (inv?.category as string)
          || (inv?.sub_category as string)
          || "Uncategorized";

        const itemAmount = ev.amount || Number(inv?.total_cost) || 0;
        const currentCustodian = String(ev.custodianName || "").trim();
        const currentOffice = String(ev.office || "").trim();
        
        let currentLabel = currentCustodian;
        if (currentOffice && currentCustodian) {
          if (!currentCustodian.toUpperCase().includes(currentOffice.toUpperCase())) {
            currentLabel = `${currentOffice.toUpperCase()} - ${currentCustodian.toUpperCase()}`;
          } else {
            currentLabel = currentCustodian.toUpperCase();
          }
        } else if (currentOffice && !currentCustodian) {
          currentLabel = currentOffice.toUpperCase();
        } else {
          currentLabel = currentCustodian.toUpperCase();
        }
        const qty = ev.quantity;

        if (inv) latestInvMap.set(propNumKey, inv);

        const fundSourceObj = inv?.fund_sources as Record<string, unknown> | null | undefined;
        const fundCluster = (fundSourceObj?.name as string) || "General Fund";

        if (!itemRowMap.has(propNumKey)) {
          // First issuance event for this item
          itemRowMap.set(propNumKey, {
            date: ev.date,
            icsNumber: ev.reference,
            propertyNumber: propNumKey,
            description: (inv?.description as string) || ev.rawDesc,
            estimatedUsefulLife: String(inv?.estimated_useful_life || ""),
            issuedQty: qty,
            issuedOfficer: currentLabel,
            returnedQty: 0,
            returnedOfficer: "",
            reissuedQty: 0,
            reissuedOfficer: "",
            disposedQty: 0,
            balanceQty: qty,
            amount: itemAmount,
            remarks: "",
            _catName: catName,
            _fundCluster: fundCluster,
            _latestCustodian: currentLabel,
          });
        } else {
          // Subsequent event (Transfer / Re-issuance)
          const row = itemRowMap.get(propNumKey)!;
          
          row.issuedQty = qty;
          row.issuedOfficer = row._latestCustodian; 
          
          row.reissuedQty = qty;
          row.reissuedOfficer = currentLabel;
          
          row.icsNumber = ev.reference;
          row.date = ev.date;
          row.remarks = "Re-issued";
          row._latestCustodian = currentLabel;
          // Only update the category if the new event actually has a valid category
          if (catName !== "Uncategorized") {
            row._catName = catName;
          }
        }
      }

      // Process Returns: If item is available/damaged AND has a history, it's a Return
      itemRowMap.forEach((row, invId) => {
        const inv = latestInvMap.get(invId);
        if (inv) {
          const assignmentStatus = (inv.assignment_status as string)?.toLowerCase() || "";
          const condition = (inv.condition as string)?.toLowerCase() || "";
          
          if (assignmentStatus === "available" || condition === "damaged" || condition === "unserviceable") {
            row.issuedQty = row.balanceQty || 1;
            row.issuedOfficer = row._latestCustodian;
            row.returnedQty = row.balanceQty || 1;
            row.returnedOfficer = row._latestCustodian;
            row.reissuedQty = 0;
            row.reissuedOfficer = "";
            row.balanceQty = 0;
            row.remarks = condition === "damaged" || condition === "unserviceable" ? `Returned - ${inv.condition}` : "Returned to Stock";
          } else if (condition === "disposed" || inv.status === "Disposed") {
            row.issuedQty = row.balanceQty || 1;
            row.issuedOfficer = row._latestCustodian;
            row.disposedQty = row.balanceQty || 1;
            row.balanceQty = 0;
            row.remarks = "Disposed";
          }
        }
      });

      // Group into CategoryRegistry array — by category + fund cluster
      const catFundMap = new Map<string, { rows: RegistryRow[], catName: string, fundCluster: string }>();

      itemRowMap.forEach((row) => {
        const groupKey = `${row._catName}|||${row._fundCluster}`;
        if (!catFundMap.has(groupKey)) {
          catFundMap.set(groupKey, { rows: [], catName: row._catName, fundCluster: row._fundCluster });
        }
        catFundMap.get(groupKey)!.rows.push(row);
      });

      const result: CategoryRegistry[] = [];
      catFundMap.forEach(({ rows, catName, fundCluster }) => {
        let totalAmount = 0;
        rows.forEach((r) => { totalAmount += r.amount; });
        result.push({
          categoryName: catName,
          fundCluster,
          rows: rows.sort((a, b) => a.propertyNumber.localeCompare(b.propertyNumber)),
          totalAmount,
          totalItems: rows.length,
        });
      });

      // Sort by category name, then fund cluster
      result.sort((a, b) => a.categoryName.localeCompare(b.categoryName) || a.fundCluster.localeCompare(b.fundCluster));
      return result;
    },
    staleTime: 30_000,
  });

  // ── Filtered ──
  const filtered = useMemo(() => {
    if (!selectedFilter) return categories;
    return categories.filter(c => `${c.categoryName}|||${c.fundCluster}` === selectedFilter);
  }, [categories, selectedFilter]);

  // ── Summary ──
  const summary = useMemo(() => ({
    totalCategories: categories.length,
    totalItems: categories.reduce((s, c) => s + c.totalItems, 0),
    totalValue: categories.reduce((s, c) => s + c.totalAmount, 0),
  }), [categories]);

  // ── Handlers ──
  const handleView = (cat: CategoryRegistry) => { setSelectedCategory(cat); setShowDetailDialog(true); };
  const handlePrint = (cat: CategoryRegistry) => { setSelectedCategory(cat); setShowPrintPreview(true); };

  // ── Print Layout — Annex A.4 matching the source image ──
  const renderPrintLayout = (cat: CategoryRegistry) => (
    <>
      <style type="text/css" media="print">{`
        html, body { background: #fff; margin: 0; padding: 0; }
      `}</style>
      <div className="print-doc-longbond-landscape-zero bg-white text-black mx-auto p-6" data-print-root style={{ width: "1120px", fontFamily: "'Times New Roman', serif", fontSize: "11pt" }}>
        <div className="w-full mb-1">
          <img src={headerLogo} alt="Official Header" className="w-full h-auto object-contain" />
        </div>
        <div className="text-right text-[11px] italic font-bold pr-2">Annex A.4</div>
        <div className="text-center mb-2">
          <div className="text-[15px] font-bold tracking-wide">REGISTRY OF SEMI-EXPENDABLE PROPERTY ISSUED</div>
        </div>
        <table className="w-full text-[11px] mb-2" style={{ borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={{ width: "60%" }}>
                <span>Entity Name: </span>
                <span className="font-bold">PROVINCIAL GOVERNMENT OF APAYAO</span>
              </td>
              <td className="text-right">
                <span>Fund Cluster: </span>
                <span className="font-bold uppercase">{cat.fundCluster}</span>
              </td>
            </tr>
            <tr>
              <td colSpan={2}>
                <span>Semi-Expendable Property: </span>
                <span className="font-bold uppercase">{cat.categoryName}</span>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Main Table — matches source image columns exactly */}
        <table className="w-full text-[10px]" style={{ borderCollapse: "collapse", border: "2px solid #000" }}>
          <thead>
            <tr>
              <th rowSpan={2} className="border border-black p-1 text-center font-bold" style={{ width: "55px" }}>Date</th>
              <th colSpan={2} className="border border-black p-1 text-center font-bold">Reference</th>

              <th rowSpan={2} className="border border-black p-1 text-center font-bold" style={{ width: "140px" }}>Item Description</th>
              <th rowSpan={2} className="border border-black p-1 text-center font-bold leading-tight" style={{ width: "45px" }}>Estimated<br />Useful<br />Life</th>
              <th colSpan={2} className="border border-black p-1 text-center font-bold">Issued</th>
              <th colSpan={2} className="border border-black p-1 text-center font-bold">Returned</th>
              <th colSpan={2} className="border border-black p-1 text-center font-bold">Re-issued</th>
              <th rowSpan={2} className="border border-black p-1 text-center font-bold" style={{ width: "40px" }}>Disposed<br />Qty.</th>
              <th rowSpan={2} className="border border-black p-1 text-center font-bold" style={{ width: "40px" }}>Balance<br />Qty.</th>
              <th rowSpan={2} className="border border-black p-1 text-center font-bold" style={{ width: "65px" }}>Amount</th>
              <th rowSpan={2} className="border border-black p-1 text-center font-bold" style={{ width: "60px" }}>Remarks</th>
            </tr>
            <tr>
              <th className="border border-black p-1 text-center font-bold leading-tight" style={{ width: "55px" }}>ICS/RRSP<br />No.</th>
              <th className="border border-black p-1 text-center font-bold leading-tight" style={{ width: "70px" }}>Semi-Expendable<br />Property No.</th>
              <th className="border border-black p-1 text-center font-bold" style={{ width: "25px" }}>Qty.</th>
              <th className="border border-black p-1 text-center font-bold" style={{ width: "80px" }}>Office/Officer</th>
              <th className="border border-black p-1 text-center font-bold" style={{ width: "25px" }}>Qty.</th>
              <th className="border border-black p-1 text-center font-bold" style={{ width: "80px" }}>Office/Officer</th>
              <th className="border border-black p-1 text-center font-bold" style={{ width: "25px" }}>Qty.</th>
              <th className="border border-black p-1 text-center font-bold" style={{ width: "80px" }}>Office/Officer</th>
            </tr>
          </thead>
          <tbody>
            {cat.rows.map((row, idx) => (
              <tr key={idx}>
                <td className="border border-black p-[2px] text-center text-[10px]">{fmtDate(row.date)}</td>
                <td className="border border-black p-[2px] text-center text-[10px] font-bold">{row.icsNumber}</td>
                <td className="border border-black p-[2px] text-center text-[10px] font-bold">{row.propertyNumber}</td>
                <td className="border border-black p-[2px] text-left text-[10px]">{row.description}</td>
                <td className="border border-black p-[2px] text-center text-[10px]">{row.estimatedUsefulLife}</td>
                <td className="border border-black p-[2px] text-center text-[10px]">{row.issuedQty}</td>
                <td className="border border-black p-[2px] text-center text-[10px]">{row.issuedOfficer}</td>
                <td className="border border-black p-[2px] text-center text-[10px]">{row.returnedQty || ""}</td>
                <td className="border border-black p-[2px] text-center text-[10px]">{row.returnedOfficer}</td>
                <td className="border border-black p-[2px] text-center text-[10px]">{row.reissuedQty || ""}</td>
                <td className="border border-black p-[2px] text-center text-[10px]">{row.reissuedOfficer}</td>
                <td className="border border-black p-[2px] text-center text-[10px]">{row.disposedQty || ""}</td>
                <td className="border border-black p-[2px] text-center text-[10px]">{row.balanceQty}</td>
                <td className="border border-black p-[2px] text-right text-[10px]">{fmtCurrency(row.amount)}</td>
                <td className="border border-black p-[2px] text-left text-[10px]">{row.remarks}</td>
              </tr>
            ))}

          </tbody>
          <tfoot>
            <tr className="font-bold">
              <td className="border border-black p-1 text-right" colSpan={13}>TOTAL</td>
              <td className="border border-black p-1 text-right text-[9px]">{fmtCurrency(cat.totalAmount)}</td>
              <td className="border border-black p-1"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Registry</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Annex A.4 — Registry of Semi-Expendable Property Issued
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Categories</p>
                <p className="text-2xl font-bold">{summary.totalCategories}</p>
              </div>
              <FolderOpen className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Items</p>
                <p className="text-2xl font-bold">{summary.totalItems}</p>
              </div>
              <Package className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-xl font-bold">{fmtCurrency(summary.totalValue)}</p>
              </div>
              <Scale className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Selector */}
      <Card>
        <CardContent className="pt-6">
          <Popover open={comboOpen} onOpenChange={setComboOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={comboOpen}
                className="w-full justify-between text-left font-normal h-10"
              >
                {selectedFilter
                  ? (() => { const c = categories.find(c => `${c.categoryName}|||${c.fundCluster}` === selectedFilter); return c ? `${c.categoryName} (${c.fundCluster})` : selectedFilter; })()
                  : "All Categories — Select a category to filter…"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput placeholder="Type to search categories…" />
                <CommandList>
                  <CommandEmpty>No category found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="__all__"
                      onSelect={() => { setSelectedFilter(""); setComboOpen(false); }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", !selectedFilter ? "opacity-100" : "opacity-0")} />
                      All Categories
                    </CommandItem>
                    {categories.map((cat) => {
                      const catKey = `${cat.categoryName}|||${cat.fundCluster}`;
                      return (
                      <CommandItem
                        key={catKey}
                        value={catKey}
                        onSelect={() => {
                          setSelectedFilter(catKey === selectedFilter ? "" : catKey);
                          setComboOpen(false);
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", selectedFilter === catKey ? "opacity-100" : "opacity-0")} />
                        <span className="uppercase">{cat.categoryName}</span>
                        <span className="text-xs text-muted-foreground ml-1">({cat.fundCluster})</span>
                        <Badge variant="secondary" className="ml-auto">{cat.totalItems}</Badge>
                      </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
        <span>Showing {filtered.length} of {categories.length} categories</span>
        <Badge variant="outline">{filtered.length} categories</Badge>
      </div>

      {/* Main Table — one row per category */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">Loading registry…</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <BookOpen className="h-12 w-12 mb-4 opacity-30" />
              <p className="text-lg font-medium">No registry entries found</p>
              <p className="text-sm mt-1">
                {selectedFilter ? "Try adjusting your search." : "Registry entries appear when ICS slips are created."}
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[600px]">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead>Semi-Expendable Category</TableHead>
                    <TableHead className="w-[100px] text-center">Items</TableHead>
                    <TableHead className="w-[130px] text-right">Total Value</TableHead>
                    <TableHead className="w-[120px] text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((cat) => (
                    <TableRow
                      key={`${cat.categoryName}|||${cat.fundCluster}`}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleView(cat)}
                    >
                      <TableCell>
                        <span className="font-semibold uppercase">{cat.categoryName}</span>
                        <span className="text-xs text-muted-foreground ml-2">({cat.fundCluster})</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{cat.totalItems}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{fmtCurrency(cat.totalAmount)}</TableCell>
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleView(cat)} title="View Registry">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handlePrint(cat)} title="Print Annex A.4">
                            <Printer className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* ── Detail Dialog ── */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Registry — {selectedCategory?.categoryName}
            </DialogTitle>
          </DialogHeader>
          {selectedCategory && (
            <div className="space-y-3">
              <div className="flex items-center gap-6 text-sm">
                <div>
                  <span className="text-muted-foreground">Category: </span>
                  <span className="font-bold uppercase">{selectedCategory.categoryName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Fund Cluster: </span>
                  <span className="font-bold uppercase">{selectedCategory.fundCluster}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Items: </span>
                  <Badge variant="secondary">{selectedCategory.totalItems}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Total: </span>
                  <span className="font-bold">{fmtCurrency(selectedCategory.totalAmount)}</span>
                </div>
              </div>

              <div className="border rounded-lg overflow-auto">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-center w-[65px]">Date</TableHead>
                      <TableHead className="text-center w-[80px]">ICS/RRSP No.</TableHead>
                      <TableHead className="text-center w-[80px]">Property No.</TableHead>
                      <TableHead className="w-[140px]">Description</TableHead>
                      <TableHead className="text-center w-[50px]">Est. Life</TableHead>
                      <TableHead className="text-center w-[35px]">Issued Qty</TableHead>
                      <TableHead className="text-center w-[90px]">Issued Officer</TableHead>
                      <TableHead className="text-center w-[35px]">Ret. Qty</TableHead>
                      <TableHead className="text-center w-[90px]">Ret. Officer</TableHead>
                      <TableHead className="text-center w-[35px]">Re-issued Qty</TableHead>
                      <TableHead className="text-center w-[90px]">Re-issued Officer</TableHead>
                      <TableHead className="text-center w-[35px]">Disposed</TableHead>
                      <TableHead className="text-center w-[35px]">Balance</TableHead>
                      <TableHead className="text-right w-[70px]">Amount</TableHead>
                      <TableHead className="w-[60px]">Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedCategory.rows.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-center">{fmtDate(row.date)}</TableCell>
                        <TableCell className="text-center font-mono font-medium">{row.icsNumber}</TableCell>
                        <TableCell className="text-center font-mono">{row.propertyNumber}</TableCell>
                        <TableCell>{row.description}</TableCell>
                        <TableCell className="text-center">{row.estimatedUsefulLife}</TableCell>
                        <TableCell className="text-center">{row.issuedQty}</TableCell>
                        <TableCell className="text-center">{row.issuedOfficer}</TableCell>
                        <TableCell className="text-center">{row.returnedQty || ""}</TableCell>
                        <TableCell className="text-center">{row.returnedOfficer}</TableCell>
                        <TableCell className="text-center">{row.reissuedQty || ""}</TableCell>
                        <TableCell className="text-center">{row.reissuedOfficer}</TableCell>
                        <TableCell className="text-center">{row.disposedQty || ""}</TableCell>
                        <TableCell className="text-center font-bold">{row.balanceQty}</TableCell>
                        <TableCell className="text-right">{fmtCurrency(row.amount)}</TableCell>
                        <TableCell>{row.remarks}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 font-bold">
                      <TableCell colSpan={13} className="text-right">TOTAL</TableCell>
                      <TableCell className="text-right">{fmtCurrency(selectedCategory.totalAmount)}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" onClick={() => { 
                if (selectedCategory) {
                    const data = selectedCategory.rows.map(r => ({
                        Date: r.date ? new Date(r.date).toLocaleDateString() : '',
                        "ICS/RRSP No.": r.icsNumber,
                        "Property No.": r.propertyNumber,
                        Description: r.description,
                        "Est. Life": r.estimatedUsefulLife,
                        "Issued Qty": r.issuedQty,
                        "Issued Officer": r.issuedOfficer,
                        "Ret. Qty": r.returnedQty,
                        "Ret. Officer": r.returnedOfficer,
                        "Re-issued Qty": r.reissuedQty,
                        "Re-issued Officer": r.reissuedOfficer,
                        Disposed: r.disposedQty,
                        Balance: r.balanceQty,
                        Amount: r.amount,
                        Remarks: r.remarks
                    }));
                    exportToExcel(data, `Registry_${selectedCategory.categoryName}.xlsx`, 'Registry');
                }
            }}>
              <Download className="h-4 w-4 mr-2" /> Export to Excel
            </Button>
            <Button variant="outline" onClick={() => { setShowDetailDialog(false); if (selectedCategory) handlePrint(selectedCategory); }}>
              <Printer className="h-4 w-4 mr-2" /> Print Annex A.4
            </Button>
            <Button variant="default" onClick={() => setShowDetailDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Print Preview Portal ── */}
      {showPrintPreview && selectedCategory && createPortal(
        <PrintDocumentLayout
          layout={PRINT_LAYOUT.LONG_BOND_LANDSCAPE_ZERO}
          className="print-only fixed inset-0 z-[9999] bg-white overflow-auto"
        >
          {renderPrintLayout(selectedCategory)}
          <div className="no-print fixed top-4 right-4 flex gap-2 z-[10000] pr-12">
            <PrintLayoutHint layout={PRINT_LAYOUT.LONG_BOND_LANDSCAPE_ZERO} />
            <Button onClick={() => printDocument(PRINT_LAYOUT.LONG_BOND_LANDSCAPE_ZERO)} variant="default">
              <Printer className="h-4 w-4 mr-2" /> Print
            </Button>
            <Button onClick={() => setShowPrintPreview(false)} variant="outline">
              <X className="h-4 w-4 mr-2" /> Close
            </Button>
          </div>
        </PrintDocumentLayout>,
        document.body
      )}
    </div>
  );
};
