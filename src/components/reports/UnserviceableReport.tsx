import React from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import headerLogo from "@/assets/HEADERLOGO.png";
import { printDocument } from "@/lib/printDocument";
import { PRINT_LAYOUT } from "@/lib/printLayouts";

interface UnserviceableItem {
  propertyNumber: string;
  description: string;
  serialNumber?: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  // Valuation
  accumulatedDepreciation?: number; // Optional as semi-exp is usually expensed, but good for tracking
  accumulatedImpairment?: number;
  carryingAmount?: number;

  dateAcquired: string;
  condition: string; // Remarks
  recommendation?: string;

  // Disposal Details
  disposalMode?: 'Sale' | 'Transfer' | 'Destruction' | 'Others';
  appraisedValue?: number;
  orNumber?: string;
  amount?: number;
}

interface UnserviceableReportProps {
  data: {
    reportNumber: string;
    reportDate: string;
    department: string;
    fundCluster?: string;

    // Accountable Officer
    accountableOfficer: string;
    designation: string;
    station: string;

    inspectors: { name: string; position: string }[];
    witness: { name: string; position: string };
    approvedBy: { name: string; position: string };

    items: UnserviceableItem[];
    totalValue: number;
  };
}

export const UnserviceableReport: React.FC<UnserviceableReportProps> = ({ data }) => {
  const handlePrint = () => {
    void printDocument(PRINT_LAYOUT.A4_PORTRAIT);
  };

  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case 'Repair': return 'text-blue-600';
      case 'Dispose': return 'text-orange-600';
      case 'Condemn': return 'text-red-600';
      default: return '';
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-4 pr-12 print:hidden">
        <h2 className="text-2xl font-bold">Inventory and Inspection Report of Unserviceable Semi-Expendable Property</h2>
        <Button onClick={handlePrint} className="flex items-center gap-2">
          <Printer className="h-4 w-4" />
          Print
        </Button>
      </div>

      <Card className="print-doc-a4-portrait max-w-none rounded-none print:shadow-none print:border-2 print:border-black" style={{ width: '1040px', margin: '0 auto' }}>
        <CardHeader className="text-center border-b-2 border-black p-0">
          <div className="w-full mb-2">
            <img src={headerLogo} alt="Official Header" className="w-full h-auto object-contain" />
          </div>
          <div className="pb-4">
            <h1 className="text-lg font-bold uppercase">INVENTORY AND INSPECTION REPORT OF UNSERVICEABLE SEMI-EXPENDABLE PROPERTY</h1>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-4 gap-4 mb-6 text-sm">
            <div className="border-b border-gray-400 pb-1">
              <label className="text-xs font-semibold uppercase">Entity Name:</label>
              <p className="font-semibold">{data.department}</p>
            </div>
            <div className="border-b border-gray-400 pb-1">
              <label className="text-xs font-semibold uppercase">Fund Cluster:</label>
              <p>{data.fundCluster || '________________'}</p>
            </div>
            <div className="border-b border-gray-400 pb-1">
              <label className="text-xs font-semibold uppercase">Date:</label>
              <p>{data.reportDate}</p>
            </div>
            <div className="border-b border-gray-400 pb-1">
              <label className="text-xs font-semibold uppercase">IIRUSP No.:</label>
              <p className="font-mono">{data.reportNumber}</p>
            </div>

            <div className="border-b border-gray-400 pb-1 col-span-2">
              <label className="text-xs font-semibold uppercase">Accountable Officer:</label>
              <p>{(data.department && !data.accountableOfficer.startsWith(data.department)) ? `${data.department}-${data.accountableOfficer}` : data.accountableOfficer}</p>
            </div>
            <div className="border-b border-gray-400 pb-1">
              <label className="text-xs font-semibold uppercase">Designation:</label>
              <p>{data.designation}</p>
            </div>
            <div className="border-b border-gray-400 pb-1">
              <label className="text-xs font-semibold uppercase">Station:</label>
              <p>{data.station}</p>
            </div>
          </div>

          <div className="border-2 border-black">
            <table className="text-xs border-collapse" style={{ width: '988px', tableLayout: 'fixed' }}>
              <thead>
                <tr className="border-b-2 border-black bg-gray-100">
                  <th className="border-r border-black p-1 text-center" rowSpan={2} style={{ width: '50px' }}>Date Acquired</th>
                  <th className="border-r border-black p-1 text-center" rowSpan={2} style={{ width: '60px' }}>Property No.</th>
                  <th className="border-r border-black p-1 text-center" rowSpan={2} style={{ width: '40px' }}>Qty</th>
                  <th className="border-r border-black p-1 text-center" rowSpan={2} style={{ width: '120px' }}>Description</th>
                  <th className="border-r border-black p-1 text-center" rowSpan={2} style={{ width: '60px' }}>Unit Cost</th>
                  <th className="border-r border-black p-1 text-center" rowSpan={2} style={{ width: '70px' }}>Total Cost</th>
                  <th className="border-r border-black p-1 text-center" rowSpan={2} style={{ width: '60px' }}>Accum.<br />Impair</th>
                  <th className="border-r border-black p-1 text-center" rowSpan={2} style={{ width: '60px' }}>Carrying<br />Amount</th>
                  <th className="border-r border-black p-1 text-center" rowSpan={2} style={{ width: '80px' }}>Remaks/<br />Condition</th>
                  <th className="border-r border-black p-1 text-center" colSpan={4}>Disposal</th>
                  <th className="border-r border-black p-1 text-center" rowSpan={2} style={{ width: '60px' }}>Appraised<br />Value</th>
                  <th className="border-r border-black p-1 text-center" colSpan={2}>Record of Sales</th>
                </tr>
                <tr className="border-b-2 border-black bg-gray-100">
                  <th className="border-r border-black p-1 text-center" style={{ width: '40px' }}>Sale</th>
                  <th className="border-r border-black p-1 text-center" style={{ width: '40px' }}>Trans</th>
                  <th className="border-r border-black p-1 text-center" style={{ width: '40px' }}>Dest</th>
                  <th className="border-r border-black p-1 text-center" style={{ width: '40px' }}>Others</th>

                  <th className="border-r border-black p-1 text-center" style={{ width: '60px' }}>OR No.</th>
                  <th className="border-r border-black p-1 text-center" style={{ width: '60px' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, index) => (
                  <tr key={index} className="border-b border-gray-300">
                    <td className="border-r border-black p-1 text-center">{item.dateAcquired}</td>
                    <td className="border-r border-black p-1 text-center font-mono text-[10px]">{item.propertyNumber}</td>
                    <td className="border-r border-black p-1 text-center">{item.quantity}</td>
                    <td className="border-r border-black p-1 text-[10px]">
                      {item.description}
                      {item.serialNumber && <div className="text-[9px] text-gray-600 mt-0.5">SN: {item.serialNumber}</div>}
                    </td>
                    <td className="border-r border-black p-1 text-right text-[10px]">{item.unitCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="border-r border-black p-1 text-right text-[10px]">{item.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="border-r border-black p-1 text-right text-[10px]">{item.accumulatedImpairment?.toFixed(2) || '-'}</td>
                    <td className="border-r border-black p-1 text-right text-[10px]">{item.carryingAmount?.toFixed(2) || '-'}</td>
                    <td className="border-r border-black p-1 text-[10px]">{item.condition}</td>

                    {/* Disposal Modes */}
                    <td className="border-r border-black p-1 text-center">{item.disposalMode === 'Sale' ? '✓' : ''}</td>
                    <td className="border-r border-black p-1 text-center">{item.disposalMode === 'Transfer' ? '✓' : ''}</td>
                    <td className="border-r border-black p-1 text-center">{item.disposalMode === 'Destruction' ? '✓' : ''}</td>
                    <td className="border-r border-black p-1 text-center">{item.disposalMode === 'Others' ? '✓' : ''}</td>

                    <td className="border-r border-black p-1 text-right text-[10px]">{item.appraisedValue?.toFixed(2) || '-'}</td>
                    <td className="border-r border-black p-1 text-center text-[10px]">{item.orNumber || '-'}</td>
                    <td className="border-r border-black p-1 text-right text-[10px]">{item.amount?.toFixed(2) || '-'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-black bg-gray-100 font-semibold text-[10px]">
                  <td colSpan={5} className="border-r border-black p-1 text-right">TOTALS:</td>
                  <td className="border-r border-black p-1 text-right font-bold text-orange-600">
                    {data.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="border-r border-black p-1"></td>
                  <td className="border-r border-black p-1"></td>
                  <td className="border-r border-black p-1"></td>
                  <td className="border-r border-black p-1"></td>
                  <td className="border-r border-black p-1"></td>
                  <td className="border-r border-black p-1"></td>
                  <td className="border-r border-black p-1"></td>
                  <td className="border-r border-black p-1"></td>
                  <td className="border-r border-black p-1"></td>
                  <td className="p-1"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-3 gap-4 p-4 border border-gray-400">
              <div className="text-center">
                <p className="font-semibold text-blue-600">FOR REPAIR</p>
                <p className="text-2xl font-bold">
                  {data.items.filter(item => item.recommendation === 'Repair').length}
                </p>
                <p className="text-sm text-gray-600">items</p>
              </div>
              <div className="text-center">
                <p className="font-semibold text-orange-600">FOR DISPOSAL</p>
                <p className="text-2xl font-bold">
                  {data.items.filter(item => item.recommendation === 'Dispose').length}
                </p>
                <p className="text-sm text-gray-600">items</p>
              </div>
              <div className="text-center">
                <p className="font-semibold text-red-600">FOR CONDEMNATION</p>
                <p className="text-2xl font-bold">
                  {data.items.filter(item => item.recommendation === 'Condemn').length}
                </p>
                <p className="text-sm text-gray-600">items</p>
              </div>
            </div>

            <div className="p-4 border border-gray-400">
              <h3 className="font-semibold mb-4">INSPECTOR'S NOTES:</h3>
              <div className="space-y-2 text-sm">
                <div className="border-b border-gray-200 pb-8">
                  <p className="text-xs text-gray-500 mb-2">Additional observations and recommendations:</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mt-6 pt-4 border-t-2 border-black">
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-xs font-semibold mb-4">I HEREBY CERTIFY that the property enumerated above was disposed of as follows:</p>
                <div className="flex gap-4 justification-center text-xs font-bold">
                  <span className="border-b border-black px-2">N/A</span>
                </div>
              </div>

              <div className="text-center pt-8">
                <div className="border-b border-black mb-1">
                  <p className="font-bold text-sm uppercase">{data.approvedBy?.name || '_____________________'}</p>
                </div>
                <p className="text-xs text-center">{data.approvedBy?.position || 'Head of Agency'}</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="text-center">
                <p className="text-xs font-semibold mb-8">CERTIFIED CORRECT:</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {data.inspectors.map((inspector, index) => (
                  <div key={index} className="text-center pt-2">
                    <div className="border-b border-black mb-1">
                      <p className="font-bold text-xs uppercase">{inspector.name}</p>
                    </div>
                    <p className="text-[10px]">{inspector.position}</p>
                  </div>
                ))}
              </div>

              <div className="text-center pt-4">
                <div className="border-b border-black mb-1 w-2/3 mx-auto">
                  <p className="font-bold text-sm uppercase">{data.witness?.name || '_____________________'}</p>
                </div>
                <p className="text-xs">Witness</p>
              </div>
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