import React from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import headerLogo from "@/assets/HEADERLOGO.png";
import { PrintLayoutHint } from "@/components/print/PrintDocumentLayout";
import { printDocument } from "@/lib/printDocument";
import { PRINT_LAYOUT } from "@/lib/printLayouts";

interface CountItem {
  propertyNumber: string;
  description: string;
  unitCost: number; // New field
  bookQuantity: number;
  actualQuantity: number;
  varianceQty: number; // Renamed from variance
  varianceValue: number; // New field
  condition: string;
  location: string;
  remarks: string;
}

interface PhysicalCountReportProps {
  data: {
    reportNumber: string;
    countDate: string;
    department: string;
    fundCluster?: string;
    custodian: string;
    custodianDesignation?: string;
    custodianStation?: string;
    dateOfAssumption?: string;

    countedBy: { name: string; position: string }[];
    approvedBy?: { name: string; position: string };
    coaRepresentative?: { name: string; position: string };

    items: CountItem[];
    totalVarianceQty: number;
    totalVarianceValue: number;
  };
}

export const PhysicalCountReport: React.FC<PhysicalCountReportProps> = ({ data }) => {
  const handlePrint = () => {
    void printDocument(PRINT_LAYOUT.LONG_BOND_LANDSCAPE_ZERO);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-4 pr-12 print:hidden">
        <h2 className="text-2xl font-bold">Report on Physical Count of Semi-Expendable Property</h2>
        <div className="flex items-center gap-2">
          <PrintLayoutHint layout={PRINT_LAYOUT.LONG_BOND_LANDSCAPE_ZERO} />
          <Button onClick={handlePrint} className="flex items-center gap-2">
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      <Card className="print-doc-longbond-landscape-zero max-w-none rounded-none print:shadow-none print:border-2 print:border-black" style={{ width: '1040px', margin: '0 auto' }}>
        <CardHeader className="text-center border-b-2 border-black p-0">
          <div className="w-full mb-2">
            <img src={headerLogo} alt="Official Header" className="w-full h-auto object-contain" />
          </div>
          <div className="pb-4">
            <h1 className="text-lg font-bold uppercase">REPORT ON THE PHYSICAL COUNT OF SEMI-EXPENDABLE PROPERTY</h1>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-4 gap-4 mb-6 text-sm">
            <div className="border-b border-gray-400 pb-1">
              <label className="text-xs font-semibold uppercase">Type of Property:</label>
              <p className="font-semibold">Semi-Expendable</p>
            </div>
            <div className="border-b border-gray-400 pb-1">
              <label className="text-xs font-semibold uppercase">As of Date:</label>
              <p>{data.countDate}</p>
            </div>
            <div className="border-b border-gray-400 pb-1">
              <label className="text-xs font-semibold uppercase">Fund Cluster:</label>
              <p>{data.fundCluster || '________________'}</p>
            </div>
            <div className="border-b border-gray-400 pb-1">
              <label className="text-xs font-semibold uppercase">Report No.:</label>
              <p className="font-mono">{data.reportNumber}</p>
            </div>

            <div className="border-b border-gray-400 pb-1 col-span-2">
              <label className="text-xs font-semibold uppercase">Accountable Officer:</label>
              <p>{(data.department && !data.custodian.startsWith(data.department)) ? `${data.department}-${data.custodian}` : data.custodian}</p>
            </div>
            <div className="border-b border-gray-400 pb-1">
              <label className="text-xs font-semibold uppercase">Designation:</label>
              <p>{data.custodianDesignation || '________________'}</p>
            </div>
            <div className="border-b border-gray-400 pb-1">
              <label className="text-xs font-semibold uppercase">Station:</label>
              <p>{data.custodianStation || '________________'}</p>
            </div>
          </div>

          <div className="border-2 border-black">
            <table className="text-xs border-collapse" style={{ width: '988px', tableLayout: 'fixed' }}>
              <thead>
                <tr className="border-b-2 border-black bg-gray-100">
                  <th className="border-r border-black p-2 text-center" rowSpan={2} style={{ width: '120px' }}>Property No.</th>
                  <th className="border-r border-black p-2 text-center" rowSpan={2} style={{ width: '250px' }}>Description</th>
                  <th className="border-r border-black p-2 text-center" rowSpan={2} style={{ width: '70px' }}>Unit Cost</th>
                  <th className="border-r border-black p-2 text-center" rowSpan={2} style={{ width: '60px' }}>Book<br />Qty</th>
                  <th className="border-r border-black p-2 text-center" rowSpan={2} style={{ width: '60px' }}>Actual<br />Qty</th>
                  <th className="border-r border-black p-1 text-center" colSpan={2}>Shortage/Overage</th>
                  <th className="p-2 text-center" rowSpan={2} style={{ width: '188px' }}>Remarks</th>
                </tr>
                <tr className="border-b-2 border-black bg-gray-100">
                  <th className="border-r border-black p-1 text-center" style={{ width: '50px' }}>Qty</th>
                  <th className="border-r border-black p-1 text-center" style={{ width: '100px' }}>Value</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, index) => (
                  <tr key={index} className="border-b border-gray-300">
                    <td className="border-r border-black p-2 text-center font-mono">{item.propertyNumber}</td>
                    <td className="border-r border-black p-2">{item.description}</td>
                    <td className="border-r border-black p-2 text-right">{item.unitCost.toFixed(2)}</td>
                    <td className="border-r border-black p-2 text-center">{item.bookQuantity}</td>
                    <td className="border-r border-black p-2 text-center">{item.actualQuantity}</td>

                    {/* Variance Qty */}
                    <td className={`border-r border-black p-2 text-center font-semibold ${item.varianceQty !== 0 ? (item.varianceQty > 0 ? 'text-green-600' : 'text-red-600') : ''
                      }`}>
                      {item.varianceQty !== 0 ? (item.varianceQty > 0 ? '+' : '') + item.varianceQty : '-'}
                    </td>

                    {/* Variance Value */}
                    <td className={`border-r border-black p-2 text-right font-semibold ${item.varianceValue !== 0 ? (item.varianceValue > 0 ? 'text-green-600' : 'text-red-600') : ''
                      }`}>
                      {item.varianceValue !== 0 ? (item.varianceValue > 0 ? '+' : '') + item.varianceValue.toFixed(2) : '-'}
                    </td>

                    <td className="p-2">{item.remarks}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-black bg-gray-100">
                  <td colSpan={5} className="border-r border-black p-2 text-right font-semibold">TOTAL DISCREPANCY:</td>
                  <td className={`border-r border-black p-2 text-center font-bold ${data.totalVarianceQty !== 0 ? (data.totalVarianceQty > 0 ? 'text-green-600' : 'text-red-600') : ''
                    }`}>
                    {data.totalVarianceQty !== 0 ? (data.totalVarianceQty > 0 ? '+' : '') + data.totalVarianceQty : '-'}
                  </td>
                  <td className={`border-r border-black p-2 text-right font-bold ${data.totalVarianceValue !== 0 ? (data.totalVarianceValue > 0 ? 'text-green-600' : 'text-red-600') : ''
                    }`}>
                    {data.totalVarianceValue.toFixed(2)}
                  </td>
                  <td className="p-2"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-6 p-4 border border-gray-400">
            <h3 className="font-semibold mb-2">SUMMARY OF VARIANCES:</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-semibold">Overage: </span>
                <span className="text-green-600">+{data.items.filter(item => item.varianceQty > 0).reduce((sum, item) => sum + item.varianceQty, 0)}</span>
              </div>
              <div>
                <span className="font-semibold">Shortage: </span>
                <span className="text-red-600">{data.items.filter(item => item.varianceQty < 0).reduce((sum, item) => sum + item.varianceQty, 0)}</span>
              </div>
              <div>
                <span className="font-semibold">Net Variance: </span>
                <span className={data.totalVarianceQty !== 0 ? (data.totalVarianceQty > 0 ? 'text-green-600' : 'text-red-600') : ''}>
                  {data.totalVarianceQty > 0 ? '+' : ''}{data.totalVarianceQty}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mt-8 pt-4 border-t-2 border-black">
            <div className="text-center">
              <div className="border-b border-black mb-1 pb-8"></div>
              <p className="text-xs font-semibold">Certified Correct by:</p>
              <p className="text-xs">Inventory Committee Chair/Member</p>
            </div>
            <div className="text-center">
              <div className="border-b border-black mb-1 pb-8"></div>
              <p className="text-xs font-semibold">Approved by:</p>
              <p className="text-xs">Head of Agency</p>
            </div>
            <div className="text-center">
              <div className="border-b border-black mb-1 pb-8"></div>
              <p className="text-xs font-semibold">Verified by:</p>
              <p className="text-xs">COA Representative</p>
            </div>
            <div className="text-center">
              <div className="border-b border-black mb-1 pb-8"></div>
              <p className="text-xs font-semibold">Conformed by:</p>
              <p className="text-xs">Accountable Officer</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
};