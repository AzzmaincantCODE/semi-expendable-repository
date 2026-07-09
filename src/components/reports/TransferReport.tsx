import React from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import headerLogo from "@/assets/HEADERLOGO.png";
import { PrintLayoutHint } from "@/components/print/PrintDocumentLayout";
import { printDocument } from "@/lib/printDocument";
import { PRINT_LAYOUT } from "@/lib/printLayouts";

interface TransferItem {
  propertyNumber: string;
  description: string;
  quantity: number;
  unit: string;
  serialNumber: string;
  condition: string;
  remarks: string;
}

interface TransferReportProps {
  data: {
    transferNumber: string; // ITR No.
    date: string;

    // Transfer Type
    transferType: 'Donation' | 'Reassignment' | 'Relocate' | 'Others';
    transferTypeOthers?: string;

    // Entities
    fromEntityName: string;
    fromFundCluster: string;
    toEntityName: string;
    toFundCluster: string;

    // Reference
    icsNumber?: string;
    icsDate?: string;

    reason: string;

    // Signatories
    approvedBy: { name: string; position: string; date: string };
    releasedBy: { name: string; position: string; date: string };
    receivedBy: { name: string; position: string; date: string };

    items: TransferItem[];
  };
}

export const TransferReport: React.FC<TransferReportProps> = ({ data }) => {
  const handlePrint = () => {
    void printDocument(PRINT_LAYOUT.A4_PORTRAIT);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-4 pr-12 print:hidden">
        <h2 className="text-2xl font-bold">Inventory Transfer Report</h2>
        <div className="flex items-center gap-2">
          <PrintLayoutHint layout={PRINT_LAYOUT.A4_PORTRAIT} />
          <Button onClick={handlePrint} className="flex items-center gap-2">
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      <Card className="print-doc-a4-portrait max-w-none rounded-none print:shadow-none print:border-2 print:border-black" style={{ width: '1040px', margin: '0 auto' }}>
        <CardHeader className="text-center border-b-2 border-black p-0">
          <div className="w-full mb-2">
            <img src={headerLogo} alt="Official Header" className="w-full h-auto object-contain" />
          </div>
          <div className="pb-4">
            <h1 className="text-xl font-bold uppercase">INVENTORY TRANSFER REPORT</h1>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-4">
          {/* Header Info */}
          <div className="flex justify-between mb-4 border-b pb-2 border-gray-300">
            <div className="space-y-1">
              <div className="flex gap-2">
                <span className="font-semibold text-sm">Entity Name:</span>
                <span className="border-b border-gray-400 min-w-[200px] text-sm px-2">{data.fromEntityName}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-semibold text-sm">Fund Cluster:</span>
                <span className="border-b border-gray-400 min-w-[150px] text-sm px-2">{data.fromFundCluster || '___________'}</span>
              </div>
            </div>
            <div className="space-y-1 text-right">
              <div className="flex gap-2 justify-end">
                <span className="font-semibold text-sm">ITR No.:</span>
                <span className="border-b border-gray-400 min-w-[150px] text-sm px-2 font-mono">{data.transferNumber ? data.transferNumber.replace(/-(SPHV|SPLV)-/i, '-') : ''}</span>
              </div>
              <div className="flex gap-2 justify-end">
                <span className="font-semibold text-sm">Date:</span>
                <span className="border-b border-gray-400 min-w-[150px] text-sm px-2">{data.date}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="border border-gray-400 p-3 space-y-3">
              <label className="text-xs font-bold uppercase block border-b border-gray-300 pb-1 mb-2">From (Transferor):</label>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Entity Name:</label>
                <p className="text-sm border-b border-dotted border-gray-400 pb-1">{data.fromEntityName}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold">Fund Cluster:</label>
                <p className="text-sm border-b border-dotted border-gray-400 pb-1">{data.fromFundCluster}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold">Reason for Transfer:</label>
                <p className="text-sm border-b border-dotted border-gray-400 pb-1">{data.reason}</p>
              </div>
            </div>

            <div className="border border-gray-400 p-3 space-y-3">
              <label className="text-xs font-bold uppercase block border-b border-gray-300 pb-1 mb-2">To (Transferee):</label>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Entity Name:</label>
                <p className="text-sm border-b border-dotted border-gray-400 pb-1">{data.toEntityName}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold">Fund Cluster:</label>
                <p className="text-sm border-b border-dotted border-gray-400 pb-1">{data.toFundCluster}</p>
              </div>

              <div className="pt-2">
                <label className="text-xs font-bold block mb-1">Transfer Type:</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={data.transferType === 'Donation'} readOnly /> Donation
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={data.transferType === 'Relocate'} readOnly /> Relocate
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={data.transferType === 'Reassignment'} readOnly /> Reassignment
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={data.transferType === 'Others'} readOnly /> Others: {data.transferTypeOthers || '_______'}
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="border-2 border-black">
            <table className="text-xs border-collapse" style={{ width: '988px', tableLayout: 'fixed' }}>
              <thead>
                <tr className="border-b-2 border-black bg-gray-100">
                  <th className="border-r border-black p-2 text-center" style={{ width: '50px' }}>Item No.</th>
                  <th className="border-r border-black p-2 text-center" style={{ width: '130px' }}>Property Number</th>
                  <th className="border-r border-black p-2 text-center" style={{ width: '280px' }}>Description</th>
                  <th className="border-r border-black p-2 text-center" style={{ width: '60px' }}>Qty</th>
                  <th className="border-r border-black p-2 text-center" style={{ width: '60px' }}>Unit</th>
                  <th className="border-r border-black p-2 text-center" style={{ width: '130px' }}>Serial Number</th>
                  <th className="border-r border-black p-2 text-center" style={{ width: '130px' }}>Condition</th>
                  <th className="p-2 text-center" style={{ width: '208px' }}>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, index) => (
                  <tr key={index} className="border-b border-gray-300">
                    <td className="border-r border-black p-2 text-center">{index + 1}</td>
                    <td className="border-r border-black p-2 text-center font-mono">{item.propertyNumber}</td>
                    <td className="border-r border-black p-2">{item.description}</td>
                    <td className="border-r border-black p-2 text-center">{item.quantity}</td>
                    <td className="border-r border-black p-2 text-center">{item.unit}</td>
                    <td className="border-r border-black p-2 text-center font-mono">{item.serialNumber}</td>
                    <td className="border-r border-black p-2 text-center">{item.condition}</td>
                    <td className="p-2">{item.remarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Signatories */}
          <div className="grid grid-cols-3 gap-6 mt-6 pt-4">

            {/* Approved By */}
            <div className="text-center">
              <p className="text-xs font-semibold mb-6">Approved by:</p>

              <div className="px-4">
                <div className="border-b border-black relative min-h-[20px]">
                  <p className="font-bold uppercase text-xs absolute bottom-0 left-0 right-0">{data.approvedBy.name}</p>
                </div>
                <p className="text-[10px]">Signature Over Printed Name</p>

                <div className="border-b border-black mt-4 relative min-h-[20px]">
                  <p className="text-xs absolute bottom-0 left-0 right-0">{data.approvedBy.position}</p>
                </div>
                <p className="text-[10px]">Designation</p>
                <div className="border-b border-black mt-4 relative min-h-[20px]">
                  <p className="text-xs absolute bottom-0 left-0 right-0">{data.approvedBy.date}</p>
                </div>
                <p className="text-[10px]">Date</p>
              </div>
            </div>

            {/* Released/Issued By */}
            <div className="text-center">
              <p className="text-xs font-semibold mb-6">Released/Issued by:</p>

              <div className="px-4">
                <div className="border-b border-black relative min-h-[20px]">
                  <p className="font-bold uppercase text-xs absolute bottom-0 left-0 right-0">{data.releasedBy.name}</p>
                </div>
                <p className="text-[10px]">Signature Over Printed Name</p>

                <div className="border-b border-black mt-4 relative min-h-[20px]">
                  <p className="text-xs absolute bottom-0 left-0 right-0">{data.releasedBy.position}</p>
                </div>
                <p className="text-[10px]">Designation</p>
                <div className="border-b border-black mt-4 relative min-h-[20px]">
                  <p className="text-xs absolute bottom-0 left-0 right-0">{data.releasedBy.date}</p>
                </div>
                <p className="text-[10px]">Date</p>
              </div>
            </div>

            {/* Received By */}
            <div className="text-center">
              <p className="text-xs font-semibold mb-6">Received by:</p>

              <div className="px-4">
                <div className="border-b border-black relative min-h-[20px]">
                  <p className="font-bold uppercase text-xs absolute bottom-0 left-0 right-0">{data.receivedBy.name}</p>
                </div>
                <p className="text-[10px]">Signature Over Printed Name</p>

                <div className="border-b border-black mt-4 relative min-h-[20px]">
                  <p className="text-xs absolute bottom-0 left-0 right-0">{data.receivedBy.position}</p>
                </div>
                <p className="text-[10px]">Designation</p>
                <div className="border-b border-black mt-4 relative min-h-[20px]">
                  <p className="text-xs absolute bottom-0 left-0 right-0">{data.receivedBy.date}</p>
                </div>
                <p className="text-[10px]">Date</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};