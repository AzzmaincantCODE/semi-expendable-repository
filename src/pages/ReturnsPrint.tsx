import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { returnService } from "@/services/returnService";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Download } from "lucide-react";
import { ReturnRRSPPrintPage, RRSP_PRINT_STYLES } from "@/components/reports/ReturnRRSPPrintLayout";
import { PrintDocumentLayout, PrintLayoutHint } from "@/components/print/PrintDocumentLayout";
import { printDocument } from "@/lib/printDocument";
import { PRINT_LAYOUT } from "@/lib/printLayouts";
import { exportToExcel } from "@/lib/excelExport";

export const ReturnsPrint = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: slip, isLoading, error } = useQuery({
    queryKey: ["return-slip-print", id],
    queryFn: () => returnService.getReturnSlipWithItems(id!),
    enabled: !!id,
  });

  const handlePrint = () => printDocument(PRINT_LAYOUT.LONG_BOND_PORTRAIT_ZERO);

  if (isLoading) return <div className="p-8 text-center">Loading return slip...</div>;
  if (error || !slip) return <div className="p-8 text-center text-red-600">Return slip not found.</div>;

  return (
    <PrintDocumentLayout
      layout={PRINT_LAYOUT.LONG_BOND_PORTRAIT_ZERO}
      className="rrsp-print-root min-h-screen bg-gray-100 py-8 print:min-h-0 print:bg-white print:py-0 text-black"
    >
      <style dangerouslySetInnerHTML={{ __html: RRSP_PRINT_STYLES }} />

      <div className="no-print fixed top-4 right-4 z-50 flex gap-2 pr-12 print:!hidden">
        <PrintLayoutHint layout={PRINT_LAYOUT.LONG_BOND_PORTRAIT_ZERO} />
        <span className="self-center font-sans text-xs text-amber-800">2 forms, 50% / 50%</span>
        <Button onClick={() => {
            if (slip && slip.items) {
                const data = slip.items.map((item: any, idx: number) => ({
                    "RRSP No.": slip.rrsp_no?.replace('RRSP-', ''),
                    "Return Date": slip.date ? new Date(slip.date).toLocaleDateString() : "",
                    "Returned By": slip.returned_by,
                    "Item No.": idx + 1,
                    "Property No.": item.inventory_item?.property_number || "",
                    "Description": item.inventory_item?.description || "",
                    "Quantity": item.quantity,
                    "Unit": item.inventory_item?.unit || "",
                    "Value": item.inventory_item?.total_cost || 0,
                    "Remarks": item.remarks || ""
                }));
                exportToExcel(data, `RRSP_${slip.rrsp_no}.xlsx`, 'Return Slip');
            }
        }} className="gap-2 shadow-lg bg-emerald-600 hover:bg-emerald-700 text-white">
          <Download className="h-4 w-4" /> Export to Excel
        </Button>
        <Button onClick={handlePrint} className="gap-2 shadow-lg bg-orange-600 hover:bg-orange-700 text-white">
          <Printer className="h-4 w-4" /> Print RRSP (2 Copies)
        </Button>
        <Button variant="outline" onClick={() => navigate(-1)} className="gap-2 shadow-lg bg-white">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>

      <div className="flex justify-center">
        <ReturnRRSPPrintPage slip={slip} className="shadow-2xl print:shadow-none border border-gray-200 print:border-none" />
      </div>
    </PrintDocumentLayout>
  );
};
