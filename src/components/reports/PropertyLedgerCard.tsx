import React from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import headerLogo from "@/assets/HEADERLOGO.png";

interface LedgerEntry {
  date: string;
  referenceNumber: string;
  // Receipt
  receivedQty?: number;
  receivedUnitCost?: number;
  receivedTotalCost?: number;
  // Issue/Transfer/Disposal
  issuedQty?: number;
  issuedUnitCost?: number;
  issuedTotalCost?: number;
  // Balance
  balanceQty: number;
  balanceAmount: number;
  // Impairment & Adjusted Cost
  accumulatedImpairment?: number;
  adjustedCost?: number;
  // Repair History
  repairNature?: string;
  repairAmount?: number;

  remarks?: string;
}

interface PropertyLedgerCardProps {
  data: {
    propertyNumber: string;
    description: string;
    unit: string;
    serialNumber?: string;
    uacsObjectCode?: string; // New field
    entries: LedgerEntry[];
  };
}

export const PropertyLedgerCard: React.FC<PropertyLedgerCardProps> = ({ data }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-4 pr-12 print:hidden">
        <h2 className="text-2xl font-bold">Semi-Expendable Property Ledger Card</h2>
        <Button onClick={handlePrint} className="flex items-center gap-2">
          <Printer className="h-4 w-4" />
          Print
        </Button>
      </div>

      <Card className="max-w-none rounded-none print:shadow-none print:border-2 print:border-black" style={{ width: '1040px', margin: '0 auto' }}>
        <CardHeader className="text-center border-b-2 border-black p-0">
          <div className="w-full mb-2">
            <img src={headerLogo} alt="Official Header" className="w-full h-auto object-contain" />
          </div>
          <div className="pb-4">
            <h1 className="text-xl font-bold uppercase">SEMI-EXPENDABLE PROPERTY LEDGER CARD</h1>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="border-b border-gray-400 pb-1">
              <label className="text-xs font-semibold uppercase">Entity Name:</label>
              <p className="font-semibold pl-2">[Department/Agency Name]</p>
            </div>
            <div className="border-b border-gray-400 pb-1">
              <label className="text-xs font-semibold uppercase">Fund Cluster:</label>
              <p className="font-semibold pl-2">____________________</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="border-b border-gray-400 pb-1 col-span-2">
              <label className="text-xs font-semibold uppercase">Semi-Expendable Property:</label>
              <div className="pl-2">
                <p className="text-sm">{data.description}</p>
                {data.serialNumber && <p className="text-xs text-gray-600">SN: {data.serialNumber}</p>}
              </div>
            </div>
            <div className="border-b border-gray-400 pb-1">
              <label className="text-xs font-semibold uppercase">Property Number:</label>
              <p className="font-mono text-lg pl-2">{data.propertyNumber}</p>
            </div>
            <div className="border-b border-gray-400 pb-1">
              <label className="text-xs font-semibold uppercase">UACS Object Code:</label>
              <p className="font-mono text-sm pl-2">{data.uacsObjectCode || '_________________'}</p>
            </div>

            <div className="border-b border-gray-400 pb-1 col-span-4">
              <label className="text-xs font-semibold uppercase">Description:</label>
              <div className="pl-2">
                <p className="text-sm">{data.description}</p>
                {data.serialNumber && <p className="text-xs text-gray-600">SN: {data.serialNumber}</p>}
              </div>
            </div>
          </div>

          <div className="border-2 border-black">
            <table className="text-xs border-collapse w-full">
              <thead>
                <tr className="border-b-2 border-black bg-gray-100">
                  <th className="border-r border-black p-1 text-center" rowSpan={2} style={{ width: '70px' }}>Date</th>
                  <th className="border-r border-black p-1 text-center" rowSpan={2} style={{ width: '80px' }}>Reference</th>
                  <th className="border-r border-black p-1 text-center" colSpan={3}>Receipt</th>
                  <th className="border-r border-black p-1 text-center" colSpan={3}>Issue/Transfer/Disposal</th>
                  <th className="border-r border-black p-1 text-center" colSpan={2}>Balance</th>
                  <th className="border-r border-black p-1 text-center" rowSpan={2} style={{ width: '70px' }}>Accum.<br />Impairment</th>
                  <th className="border-r border-black p-1 text-center" rowSpan={2} style={{ width: '70px' }}>Adjusted<br />Cost</th>
                  <th className="border-r border-black p-1 text-center" colSpan={2}>Repair History</th>
                  <th className="p-1 text-center" rowSpan={2} style={{ width: '80px' }}>Remarks</th>
                </tr>
                <tr className="border-b-2 border-black bg-gray-100">
                  <th className="border-r border-black p-1 text-center" style={{ width: '40px' }}>Qty</th>
                  <th className="border-r border-black p-1 text-center" style={{ width: '60px' }}>Unit Cost</th>
                  <th className="border-r border-black p-1 text-center" style={{ width: '70px' }}>Total Cost</th>

                  <th className="border-r border-black p-1 text-center" style={{ width: '40px' }}>Qty</th>
                  <th className="border-r border-black p-1 text-center" style={{ width: '60px' }}>Unit Cost</th>
                  <th className="border-r border-black p-1 text-center" style={{ width: '70px' }}>Total Cost</th>

                  <th className="border-r border-black p-1 text-center" style={{ width: '40px' }}>Qty</th>
                  <th className="border-r border-black p-1 text-center" style={{ width: '70px' }}>Amount</th>

                  <th className="border-r border-black p-1 text-center" style={{ width: '60px' }}>Nature</th>
                  <th className="border-r border-black p-1 text-center" style={{ width: '60px' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((entry, index) => (
                  <tr key={index} className="border-b border-gray-300">
                    <td className="border-r border-black p-1 text-center">{entry.date}</td>
                    <td className="border-r border-black p-1 text-center text-[10px]">{entry.referenceNumber}</td>

                    {/* Receipt */}
                    <td className="border-r border-black p-1 text-center">{entry.receivedQty || '-'}</td>
                    <td className="border-r border-black p-1 text-right">{entry.receivedUnitCost?.toFixed(2) || '-'}</td>
                    <td className="border-r border-black p-1 text-right">{entry.receivedTotalCost?.toFixed(2) || '-'}</td>

                    {/* Issued */}
                    <td className="border-r border-black p-1 text-center">{entry.issuedQty || '-'}</td>
                    <td className="border-r border-black p-1 text-right">{entry.issuedUnitCost?.toFixed(2) || '-'}</td>
                    <td className="border-r border-black p-1 text-right">{entry.issuedTotalCost?.toFixed(2) || '-'}</td>

                    {/* Balance */}
                    <td className="border-r border-black p-1 text-center font-bold">{entry.balanceQty}</td>
                    <td className="border-r border-black p-1 text-right font-bold">{entry.balanceAmount?.toFixed(2)}</td>

                    {/* New Columns */}
                    <td className="border-r border-black p-1 text-right">{entry.accumulatedImpairment?.toFixed(2) || '-'}</td>
                    <td className="border-r border-black p-1 text-right">{entry.adjustedCost?.toFixed(2) || '-'}</td>
                    <td className="border-r border-black p-1 text-center text-[10px]">{entry.repairNature || '-'}</td>
                    <td className="border-r border-black p-1 text-right">{entry.repairAmount?.toFixed(2) || '-'}</td>

                    <td className="p-1 text-[10px]">{entry.remarks || '-'}</td>
                  </tr>
                ))}

                {/* Empty rows to fill space */}
                {Array.from({ length: Math.max(0, 15 - data.entries.length) }).map((_, index) => (
                  <tr key={`empty-${index}`} className="border-b border-gray-300">
                    <td className="border-r border-black p-1 h-6">&nbsp;</td>
                    <td className="border-r border-black p-1">&nbsp;</td>
                    <td className="border-r border-black p-1">&nbsp;</td>
                    <td className="border-r border-black p-1">&nbsp;</td>
                    <td className="border-r border-black p-1">&nbsp;</td>
                    <td className="border-r border-black p-1">&nbsp;</td>
                    <td className="border-r border-black p-1">&nbsp;</td>
                    <td className="border-r border-black p-1">&nbsp;</td>
                    <td className="border-r border-black p-1">&nbsp;</td>
                    <td className="border-r border-black p-1">&nbsp;</td>
                    <td className="border-r border-black p-1">&nbsp;</td>
                    <td className="border-r border-black p-1">&nbsp;</td>
                    <td className="border-r border-black p-1">&nbsp;</td>
                    <td className="border-r border-black p-1">&nbsp;</td>
                    <td className="p-1">&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-6 mt-8 pt-4 border-t-2 border-black">
            <div className="text-center">
              <div className="border-b border-black mb-1 pb-8"></div>
              <p className="text-xs font-semibold">Supply Officer</p>
            </div>
            <div className="text-center">
              <div className="border-b border-black mb-1 pb-8"></div>
              <p className="text-xs font-semibold">Property Custodian</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};