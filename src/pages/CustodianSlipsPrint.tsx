import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { annexService } from "@/services/annexService";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Download } from "lucide-react";
import { InventoryCustodianSlipReport } from "@/components/reports/InventoryCustodianSlipReport";
import { PrintDocumentLayout, PrintLayoutHint } from "@/components/print/PrintDocumentLayout";
import { printDocument } from "@/lib/printDocument";
import { PRINT_LAYOUT } from "@/lib/printLayouts";
import { AnnexICSPrintData } from "@/types/annex";
import { exportToExcel } from "@/lib/excelExport";

export const CustodianSlipsPrint = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: slip, isLoading, error } = useQuery({
    queryKey: ["custodian-slip-print", id],
    queryFn: () => annexService.getCustodianSlipWithItems(id!),
    enabled: !!id,
  });

  const handlePrint = () => printDocument(PRINT_LAYOUT.A4_PORTRAIT);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8 text-muted-foreground animate-pulse">
          Loading custodian slip details...
        </div>
      </div>
    );
  }

  if (error || !slip) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8 text-red-600 bg-white shadow rounded-lg border">
          Custodian slip not found.
        </div>
      </div>
    );
  }

  // Format to print data structure exactly as expected by the report component
  const getPrintData = (): AnnexICSPrintData => {
    const totalAmount = slip.items.reduce((sum, item) => sum + (item.amount || 0), 0);

    const acquisitionDates = slip.items
      .map(item => (item as any).dateAcquired)
      .filter(Boolean);
    const receivedFromDate = acquisitionDates.length > 0
      ? acquisitionDates.sort()[0]
      : slip.dateIssued;

    return {
      slipNumber: slip.slipNumber,
      entityName: "PROVINCIAL GOVERNMENT OF APAYAO",
      fundCluster: "General Fund",
      custodianName: slip.custodianName,
      designation: slip.designation,
      office: slip.office,
      dateIssued: receivedFromDate,
      issuedBy: slip.issuedBy,
      issuedByPosition: slip.issuedByPosition || "",
      receivedBy: slip.receivedBy,
      items: slip.items.map(item => ({
        itemNumber: item.propertyNumber,
        propertyNumber: item.propertyNumber,
        description: item.description,
        serialNumber: item.serialNumber,
        quantity: item.quantity,
        unit: item.unit,
        unitCost: item.unitCost,
        totalCost: item.totalCost,
        amount: item.amount,
        estimatedUsefulLife: item.estimatedUsefulLife,
        dateIssued: item.dateIssued
      })),
      totalAmount
    };
  };

  return (
    <PrintDocumentLayout
      layout={PRINT_LAYOUT.A4_PORTRAIT}
      className="min-h-screen bg-gray-100 py-8 print:p-0 print:bg-white text-black"
    >
      <div className="no-print fixed top-4 right-4 z-50 flex gap-2 pr-12">
        <PrintLayoutHint layout={PRINT_LAYOUT.A4_PORTRAIT} />
        <Button onClick={() => {
            if (slip && slip.items) {
                const data = slip.items.map((item: any, idx: number) => ({
                    "ICS No.": slip.slipNumber,
                    "Date Issued": slip.dateIssued,
                    "Custodian": slip.custodianName,
                    "Item No.": item.propertyNumber || (idx + 1).toString(),
                    "Quantity": item.quantity,
                    "Unit": item.unit || "",
                    "Unit Cost": item.unitCost || 0,
                    "Total Cost": item.totalCost || item.amount || 0,
                    "Description": item.description,
                    "Est. Useful Life": item.estimatedUsefulLife || ""
                }));
                exportToExcel(data, `ICS_${slip.slipNumber}.xlsx`, 'Custodian Slip');
            }
        }} className="gap-2 shadow-lg bg-emerald-600 hover:bg-emerald-700 text-white">
          <Download className="h-4 w-4" /> Export to Excel
        </Button>
        <Button onClick={handlePrint} className="gap-2 shadow-lg bg-orange-600 hover:bg-orange-700 text-white">
          <Printer className="h-4 w-4" /> Print ICS
        </Button>
        <Button variant="outline" onClick={() => navigate(-1)} className="gap-2 shadow-lg bg-white">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>

      {/* Official A4 Document Container */}
      <div
        className="mx-auto bg-white shadow-2xl print:shadow-none p-[10mm] w-[210mm] min-h-[297mm] border border-gray-200 print:border-none flex flex-col justify-between"
        style={{ fontFamily: "'Times New Roman', serif" }}
      >
        <InventoryCustodianSlipReport data={getPrintData()} />
      </div>

      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>
    </PrintDocumentLayout>
  );
};
