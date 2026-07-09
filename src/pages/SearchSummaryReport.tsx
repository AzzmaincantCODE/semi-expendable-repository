import { useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Printer, Search, FileText } from "lucide-react";
import { simpleInventoryService } from "@/services/simpleInventoryService";
import { InventoryItem } from "@/types/inventory";
import { format } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PrintDocumentLayout } from "@/components/print/PrintDocumentLayout";
import { printDocument } from "@/lib/printDocument";
import { PRINT_LAYOUT } from "@/lib/printLayouts";

export const SearchSummaryReport = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  const handleGenerateReport = async () => {
    const query = searchTerm.trim();
    setError(null);
    if (!query) {
      setError("Enter a search term (e.g. property number, description, custodian name).");
      return;
    }
    setLoading(true);
    setHasSearched(true);
    setSubmittedQuery(query);
    try {
      const response = await simpleInventoryService.search(query, {
        filter: "issued",
        limit: 500,
      });
      if (response.success && response.data) {
        setItems(response.data);
      } else {
        setItems([]);
        setError(response.error || "No results.");
      }
    } catch (e) {
      setItems([]);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const totalValue = items.reduce((sum, i) => sum + (i.totalCost || 0), 0);

  const renderPrintContent = ({ preview = false }: { preview?: boolean } = {}) => (
    <div className={preview ? "search-summary-print max-w-4xl mx-auto p-8 bg-white text-black" : "print-page-a4 flex flex-col justify-between"}>
      <div className="text-center border-b-2 border-black pb-4 mb-6">
        <h1 className="text-2xl font-bold">SEARCH RESULTS SUMMARY REPORT</h1>
        <p className="text-lg mt-2">Assigned / custodied items matching search</p>
        <p className="text-sm mt-1">Search: &quot;{submittedQuery}&quot;</p>
        <p className="text-sm text-gray-600">Generated: {format(new Date(), "MMM dd, yyyy h:mm a")}</p>
      </div>

      <div className="mb-4 text-sm">
        <strong>Total items:</strong> {items.length} &nbsp;|&nbsp; <strong>Total value:</strong> ₱{totalValue.toLocaleString()}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-gray-600 py-4">No assigned items match this search.</p>
      ) : (
        <table className="w-full border-collapse border border-black text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black p-2 text-left">Property No.</th>
              <th className="border border-black p-2 text-left">Description</th>
              <th className="border border-black p-2 text-left">Custodian</th>
              <th className="border border-black p-2 text-left">Condition</th>
              <th className="border border-black p-2 text-right">Total Cost</th>
              <th className="border border-black p-2 text-left">Assigned Date</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td className="border border-black p-2 font-mono">{it.propertyNumber}</td>
                <td className="border border-black p-2">{it.description || "-"}</td>
                <td className="border border-black p-2">{it.custodian || "-"}</td>
                <td className="border border-black p-2">{it.condition}</td>
                <td className="border border-black p-2 text-right">₱{(it.totalCost || 0).toLocaleString()}</td>
                <td className="border border-black p-2">{it.assignedDate ? format(new Date(it.assignedDate), "MMM dd, yyyy") : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/reports")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-7 w-7" />
            Search Summary Report
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Summary search</CardTitle>
          <p className="text-sm text-muted-foreground">
            Search for assigned (custodied) inventory items and generate a printable summary report. Only items currently assigned to custodians are included.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="summary-search">Search term</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="summary-search"
                  placeholder="Property number, description, custodian name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGenerateReport()}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex items-end">
              <Button onClick={handleGenerateReport} disabled={loading}>
                {loading ? "Searching…" : "Generate report"}
              </Button>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {hasSearched && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Results ({items.length} items)</CardTitle>
            <p className="text-sm text-muted-foreground">
              Search: &quot;{submittedQuery}&quot; — Assigned items only. Total value: ₱{totalValue.toLocaleString()}
            </p>
            <div className="flex justify-end">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={() => setShowPrintPreview(true)}
                    disabled={items.length === 0}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Print summary report
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-xs">Uncheck &quot;Headers and footers&quot; in the print dialog (More options) to remove URL and date from the printed page.</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </CardHeader>
          <CardContent>
            {items.length === 0 && !loading ? (
              <p className="text-sm text-muted-foreground py-4">No assigned items match this search.</p>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Property No.</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Custodian</TableHead>
                      <TableHead>Condition</TableHead>
                      <TableHead className="text-right">Total Cost</TableHead>
                      <TableHead>Assigned Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((it) => (
                      <TableRow key={it.id}>
                        <TableCell className="font-mono">{it.propertyNumber}</TableCell>
                        <TableCell>{it.description || "-"}</TableCell>
                        <TableCell>{it.custodian || "-"}</TableCell>
                        <TableCell>{it.condition}</TableCell>
                        <TableCell className="text-right">₱{(it.totalCost || 0).toLocaleString()}</TableCell>
                        <TableCell>{it.assignedDate ? format(new Date(it.assignedDate), "MMM dd, yyyy") : "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Print-only content */}
      {hasSearched &&
        createPortal(
          <PrintDocumentLayout layout={PRINT_LAYOUT.A4_PORTRAIT} className="print-portal-root">
            {renderPrintContent({ preview: false })}
          </PrintDocumentLayout>,
          document.body
        )}

      <Dialog open={showPrintPreview} onOpenChange={setShowPrintPreview}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Search Summary Report Preview</DialogTitle>
            <DialogDescription>
              Verify the summary details before printing.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex justify-center bg-muted/30 p-4 rounded-lg overflow-auto">
            <div className="w-[210mm] bg-white p-8 shadow-sm">
              {renderPrintContent({ preview: true })}
            </div>
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

      <style>{`
        @media print {
          body > *:not(.print-portal-root) {
            display: none !important;
          }
          html, body {
            background-color: white !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }
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
        }
      `}</style>
    </div>
  );
};
