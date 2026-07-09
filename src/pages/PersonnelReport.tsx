import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Printer } from "lucide-react";
import { custodianService } from "@/services/custodianService";
import { format } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const PersonnelReport = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const custodianId = searchParams.get("custodianId") || "";
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  const { data: summary, isLoading: summaryLoading, error: summaryError } = useQuery({
    queryKey: ["personnel-report", "summary", custodianId],
    queryFn: async () => {
      if (!custodianId) return null;
      return await custodianService.getSummary(custodianId);
    },
    enabled: Boolean(custodianId),
  });

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ["personnel-report", "history", custodianId],
    queryFn: async () => {
      if (!custodianId) return [];
      return await custodianService.getItemHistory(custodianId, { includeReturned: true });
    },
    enabled: Boolean(custodianId),
  });

  const currentItems = useMemo(() => history.filter((h) => h.is_currently_assigned), [history]);

  if (!custodianId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Personnel Report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Missing `custodianId`. Open this report from Quick Search → Personnel Report.
          </div>
        </CardContent>
      </Card>
    );
  }

  if (summaryError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Personnel Report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-destructive">Failed to load: {(summaryError as Error).message}</div>
        </CardContent>
      </Card>
    );
  }

  const custodian = summary?.custodian;

  const renderPrintContent = () => (
    <div className="personnel-report-print max-w-4xl mx-auto p-8 bg-white text-black">
      <div className="text-center border-b-2 border-black pb-4 mb-6">
        <h1 className="text-2xl font-bold">PERSONNEL REPORT - CUSTODIAN</h1>
        <p className="text-lg mt-2">
          {custodian?.name || "Custodian"}{" "}
          {custodian?.custodian_no ? `(${custodian.custodian_no})` : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div>
          <div className="text-xs text-gray-600">Position</div>
          <div className="font-medium">{custodian?.position || "-"}</div>
        </div>
        <div>
          <div className="text-xs text-gray-600">Department</div>
          <div className="font-medium">{custodian?.department_name || "-"}</div>
        </div>
        <div>
          <div className="text-xs text-gray-600">Current Items</div>
          <div className="font-medium">{summary?.currently_assigned_items ?? "-"}</div>
        </div>
        <div>
          <div className="text-xs text-gray-600">Current Value</div>
          <div className="font-medium">₱{(summary?.currently_assigned_value ?? 0).toLocaleString()}</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-lg font-semibold border-b border-black pb-1">Current Items in Custody</div>
        {currentItems.length === 0 ? (
          <p className="text-sm text-gray-600 py-4">No current items in custody.</p>
        ) : (
          <table className="w-full border-collapse border border-black text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-black p-2 text-left">Property No.</th>
                <th className="border border-black p-2 text-left">Description</th>
                <th className="border border-black p-2 text-left">Condition</th>
                <th className="border border-black p-2 text-right">Value</th>
                <th className="border border-black p-2 text-left">ICS Slip</th>
                <th className="border border-black p-2 text-left">Date Issued</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map((it) => (
                <tr key={it.id}>
                  <td className="border border-black p-2 font-mono">{it.property_number}</td>
                  <td className="border border-black p-2">{it.description}</td>
                  <td className="border border-black p-2">{it.condition}</td>
                  <td className="border border-black p-2 text-right">₱{it.total_cost.toLocaleString()}</td>
                  <td className="border border-black p-2 font-mono">{it.custodian_slip_number || "-"}</td>
                  <td className="border border-black p-2">{it.date_issued ? format(new Date(it.date_issued), "MMM dd, yyyy") : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="text-2xl font-bold">Personnel Report</div>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setShowPrintPreview(true)}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="font-medium mb-1">Print tip</p>
            <p className="text-xs">Uncheck &quot;Headers and footers&quot; in the print dialog (More options) to remove the URL and date from the printed page.</p>
          </TooltipContent>
        </Tooltip>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>
              {custodian?.name || "Custodian"}{" "}
              {custodian?.custodian_no ? <span className="text-muted-foreground">({custodian.custodian_no})</span> : null}
            </span>
            {custodian?.is_active !== undefined && (
              <Badge variant={custodian.is_active ? "default" : "secondary"}>{custodian.is_active ? "Active" : "Inactive"}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {summaryLoading ? (
            <div className="text-sm text-muted-foreground">Loading summary…</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <div className="text-xs text-muted-foreground">Position</div>
                <div className="font-medium">{custodian?.position || "-"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Department</div>
                <div className="font-medium">{custodian?.department_name || "-"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Current Items</div>
                <div className="font-medium">{summary?.currently_assigned_items ?? "-"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Current Value</div>
                <div className="font-medium">₱{(summary?.currently_assigned_value ?? 0).toLocaleString()}</div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="text-lg font-semibold">Current Items</div>
            {historyLoading ? (
              <div className="text-sm text-muted-foreground">Loading items…</div>
            ) : currentItems.length === 0 ? (
              <div className="text-sm text-muted-foreground">No current items in custody.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Property No.</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>ICS Slip</TableHead>
                    <TableHead>Date Issued</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentItems.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell className="font-mono">{it.property_number}</TableCell>
                      <TableCell>{it.description}</TableCell>
                      <TableCell>
                        <Badge variant={it.condition === "Serviceable" ? "default" : "destructive"}>{it.condition}</Badge>
                      </TableCell>
                      <TableCell>₱{it.total_cost.toLocaleString()}</TableCell>
                      <TableCell className="font-mono">{it.custodian_slip_number || "-"}</TableCell>
                      <TableCell>{it.date_issued ? format(new Date(it.date_issued), "MMM dd, yyyy") : "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Print-only content rendered to body - only shows when printing */}
      {summary && !summaryLoading && createPortal(
        <div className="personnel-report-print-only">
          {renderPrintContent()}
        </div>,
        document.body
      )}

      <Dialog open={showPrintPreview} onOpenChange={setShowPrintPreview}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Personnel Report Preview</DialogTitle>
            <DialogDescription>
              Verify the personnel custody details before printing.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex justify-center bg-muted/30 p-4 rounded-lg overflow-auto">
            <div className="w-[210mm] bg-white p-8 shadow-sm">
              {renderPrintContent()}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPrintPreview(false)}>
              Close
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" />
              Print / Save as PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .personnel-report-print-only,
          .personnel-report-print-only * { visibility: visible; }
          .personnel-report-print-only {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
};


