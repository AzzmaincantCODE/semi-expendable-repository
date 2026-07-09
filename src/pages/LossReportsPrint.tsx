import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import { LossReport } from "@/components/reports/LossReport";
import { PrintDocumentLayout, PrintLayoutHint } from "@/components/print/PrintDocumentLayout";
import { printDocument } from "@/lib/printDocument";
import { PRINT_LAYOUT } from "@/lib/printLayouts";

export const LossReportsPrint = () => {
  const navigate = useNavigate();
  const [printData, setPrintData] = useState<any>(null);

  useEffect(() => {
    const rawData = sessionStorage.getItem("print_loss_report_data");
    if (rawData) {
      try {
        setPrintData(JSON.parse(rawData));
      } catch (err) {
        console.error("Failed to parse loss report print data:", err);
      }
    }
  }, []);

  const handlePrint = () => printDocument(PRINT_LAYOUT.A4_PORTRAIT);

  if (!printData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8 text-red-600 bg-white shadow rounded-lg border">
          No loss report data found to print. Please return and click Print again.
        </div>
      </div>
    );
  }

  return (
    <PrintDocumentLayout
      layout={PRINT_LAYOUT.A4_PORTRAIT}
      className="min-h-screen bg-gray-100 py-8 print:p-0 print:bg-white text-black"
    >
      <div className="no-print fixed top-4 right-4 z-50 flex gap-2 pr-12">
        <PrintLayoutHint layout={PRINT_LAYOUT.A4_PORTRAIT} />
        <Button onClick={handlePrint} className="gap-2 shadow-lg bg-orange-600 hover:bg-orange-700 text-white">
          <Printer className="h-4 w-4" /> Print RLSDDSP
        </Button>
        <Button variant="outline" onClick={() => navigate(-1)} className="gap-2 shadow-lg bg-white">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>

      {/* Official Portrait A4 Document Container */}
      <div
        className="mx-auto bg-white shadow-2xl print:shadow-none p-[10mm] w-[210mm] min-h-[297mm] border border-gray-200 print:border-none flex flex-col justify-between"
        style={{ fontFamily: "'Times New Roman', serif" }}
      >
        <LossReport data={printData} />
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
