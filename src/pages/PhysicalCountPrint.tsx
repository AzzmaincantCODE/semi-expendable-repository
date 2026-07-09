import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import { PhysicalCountReport } from "@/components/reports/PhysicalCountReport";
import { PrintDocumentLayout, PrintLayoutHint } from "@/components/print/PrintDocumentLayout";
import { printDocument } from "@/lib/printDocument";
import { PRINT_LAYOUT } from "@/lib/printLayouts";

export const PhysicalCountPrint = () => {
  const navigate = useNavigate();
  const [printData, setPrintData] = useState<any>(null);

  useEffect(() => {
    const rawData = sessionStorage.getItem("print_physical_count_data");
    if (rawData) {
      try {
        setPrintData(JSON.parse(rawData));
      } catch (err) {
        console.error("Failed to parse physical count print data:", err);
      }
    }
  }, []);

  const handlePrint = () => printDocument(PRINT_LAYOUT.LONG_BOND_LANDSCAPE_ZERO);

  if (!printData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8 text-red-600 bg-white shadow rounded-lg border">
          No physical count data found to print. Please return and click Print again.
        </div>
      </div>
    );
  }

  return (
    <PrintDocumentLayout
      layout={PRINT_LAYOUT.LONG_BOND_LANDSCAPE_ZERO}
      className="min-h-screen bg-gray-100 py-8 print:p-0 print:bg-white text-black"
    >
      <div className="no-print fixed top-4 right-4 z-50 flex gap-2 pr-12">
        <PrintLayoutHint layout={PRINT_LAYOUT.LONG_BOND_LANDSCAPE_ZERO} />
        <Button onClick={handlePrint} className="gap-2 shadow-lg bg-orange-600 hover:bg-orange-700 text-white">
          <Printer className="h-4 w-4" /> Print Count
        </Button>
        <Button variant="outline" onClick={() => navigate(-1)} className="gap-2 shadow-lg bg-white">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>

      {/* Official Landscape A4 Document Container */}
      <div
        className="mx-auto bg-white shadow-2xl print:shadow-none p-[10mm] w-[297mm] min-h-[210mm] border border-gray-200 print:border-none flex flex-col justify-between"
        style={{ fontFamily: "'Times New Roman', serif" }}
      >
        <PhysicalCountReport data={printData} />
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
