import React from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { PrintDocumentLayout, PrintLayoutHint } from "@/components/print/PrintDocumentLayout";
import { printDocument } from "@/lib/printDocument";
import { PRINT_LAYOUT } from "@/lib/printLayouts";
import { AnnexICSPrintData } from "@/types/annex";
import headerLogo from "@/assets/HEADERLOGO.png";
import { DescriptionWithSN } from "./DescriptionWithSN";

export const InventoryCustodianSlipReport: React.FC<{ data: AnnexICSPrintData }> = ({ data }) => {
  const navigate = useNavigate();
  const grandTotal = data.items.reduce((sum, item) => sum + (Number(item.totalCost) || 0), 0);

  // Generate empty rows to fill the table (at least 8 rows total)
  const totalRows = 8;
  const emptyRows = Math.max(0, totalRows - data.items.length);

  const ReportContent = ({ preview = false }: { preview?: boolean }) => (
    <div
      className={
        preview
          ? "mx-auto bg-white p-[12mm] w-[210mm] min-h-[297mm] shadow-md border"
          : "ics-slip-print print-doc-a4-portrait print-page-a4 print-page-fit flex flex-col"
      }
      {...(!preview ? { "data-print-root": true } : {})}
    >
      <div className="bg-white text-black font-serif text-sm">
        <div className="w-full flex justify-center" style={{ marginBottom: "1mm" }}>
          <img
            src={headerLogo}
            alt="Official Header"
            className="block w-full max-h-[26mm] object-fill object-bottom"
          />
        </div>

      {/* Form Body — directly under header (no justify-between gap) */}
      <div className="border-2 border-black print:border-black">

        {/* Title inside the bordered box */}
        <div className="text-center border-b border-black" style={{ padding: '8px 0 4px 0' }}>
          <h3 className="text-lg font-bold uppercase tracking-wide">INVENTORY CUSTODIAN SLIP</h3>
        </div>

        {/* Entity Name, Fund Cluster, ICS No. */}
        <div className="border-b border-black" style={{ padding: '4px 6px' }}>
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1 flex-1">
              <span className="text-xs font-semibold whitespace-nowrap">Entity Name:</span>
              <span className="font-bold uppercase text-xs">{data.entityName}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xs font-bold whitespace-nowrap">ICS No:</span>
              <span className="font-bold text-xs">
                {(() => {
                  let num = data.slipNumber || '';
                  // Remove ICS- or ICS prefix for cleaner print view
                  num = num.replace(/^ICS-|^ICS\s+/i, '');
                  // Remove -SPHV- or -SPLV- or SPHV- or SPLV- from the slip number
                  return num.replace(/-(SPHV|SPLV)-/i, '-').replace(/^(SPHV|SPLV)-/i, '');
                })()}
              </span>
            </div>
          </div>
          <div className="flex items-baseline gap-1" style={{ marginTop: '2px' }}>
            <span className="text-xs font-semibold whitespace-nowrap">Fund Cluster:</span>
            <span className="uppercase text-xs">{data.fundCluster}</span>
          </div>
        </div>

        {/* Main table */}
        <table className="border-collapse text-xs font-sans" style={{ width: '100%', tableLayout: 'fixed' }}>
          <thead>
            <tr className="border-b border-black">
              <th className="border-r border-black text-center font-bold align-middle" rowSpan={2} style={{ width: '8%', padding: '2px' }}>Qty</th>
              <th className="border-r border-black text-center font-bold align-middle" rowSpan={2} style={{ width: '10%', padding: '2px' }}>Unit of<br />Measure</th>
              <th className="border-r border-black text-center font-bold align-middle" colSpan={2} style={{ padding: '0' }}>
                <div style={{ padding: '2px', borderBottom: '1px solid black' }}>Amount</div>
              </th>
              <th className="border-r border-black text-center font-bold align-middle" rowSpan={2} style={{ width: '33%', padding: '2px' }}>Description</th>
              <th className="border-r border-black text-center font-bold align-middle" rowSpan={2} style={{ width: '17%', padding: '2px' }}>Item No.</th>
              <th className="text-center font-bold align-middle" rowSpan={2} style={{ width: '10%', padding: '2px' }}>
                <div>Estimated</div>
                <div>Useful Life</div>
              </th>
            </tr>
            <tr className="border-b border-black">
              <th className="border-r border-black text-center font-bold" style={{ width: '11%', padding: '2px' }}>Unit Cost</th>
              <th className="border-r border-black text-center font-bold" style={{ width: '11%', padding: '2px' }}>Total Cost</th>
            </tr>
          </thead>
          <tbody>
            {/* Data rows */}
            {data.items.map((item, index) => (
              <tr key={index} className="border-b border-black">
                <td className="border-r border-black text-center align-top" style={{ padding: '2px 3px' }}>{item.quantity}</td>
                <td className="border-r border-black text-center align-top" style={{ padding: '2px 3px' }}>{item.unit}</td>
                <td className="border-r border-black text-right align-top tabular-nums" style={{ padding: '2px 3px' }}>
                  {item.unitCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="border-r border-black text-right align-top font-semibold tabular-nums" style={{ padding: '2px 3px' }}>
                  {item.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="border-r border-black align-top" style={{ padding: '2px 3px' }}>
                  <DescriptionWithSN
                    description={item.description}
                    serialNumber={item.serialNumber}
                    className="text-[11px] whitespace-pre-wrap break-words"
                    block
                  />
                </td>
                <td className="border-r border-black text-center align-top break-all whitespace-normal font-mono" style={{ padding: '2px 3px' }}>
                  <span 
                    className="cursor-pointer hover:underline text-blue-800 print:text-black print:no-underline"
                    onClick={() => navigate(`/inventory?search=${item.propertyNumber}`)}
                    title={`Click to view item ${item.propertyNumber} in inventory`}
                  >
                    {item.itemNumber}
                  </span>
                </td>
                <td className="text-center align-top" style={{ padding: '2px 3px' }}>{item.estimatedUsefulLife || ''}</td>
              </tr>
            ))}

            {/* Empty rows */}
            {Array.from({ length: emptyRows }).map((_, index) => (
              <tr key={`empty-${index}`} className="border-b border-black h-7">
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className=""></td>
              </tr>
            ))}

            {/* GRAND TOTAL ROW */}
            <tr className="border-b border-black font-bold h-7">
              <td className="border-r border-black"></td>
              <td className="border-r border-black text-center align-middle" style={{ padding: '2px 3px' }}>TOTAL</td>
              <td className="border-r border-black"></td>
              <td className="border-r border-black text-right align-middle tabular-nums" style={{ padding: '2px 3px' }}>
                {grandTotal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="border-r border-black"></td>
              <td className="border-r border-black"></td>
              <td className=""></td>
            </tr>

            {/* REMARKS ROW */}
            <tr className="border-b border-black">
              <td colSpan={7} style={{ padding: '3px 6px' }}>
                <span className="font-bold text-xs">REMARKS:</span>
                <span className="ml-2 text-xs">{data.remarks || ''}</span>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Signature section - 40/60 split to align with Description column */}
        <div className="flex font-sans">
          <div className="border-r border-black" style={{ width: '40%', padding: '8px 16px' }}>
            <div className="text-xs font-semibold mb-1">Received from:</div>
            <div style={{ marginTop: '32px' }}>
              <div className="border-b border-black text-center min-h-[18px] font-bold uppercase text-xs">{data.issuedBy}</div>
              <div className="text-center text-[10px]">Signature Over Printed Name</div>
              <div className="border-b border-black text-center min-h-[18px] text-xs" style={{ marginTop: '12px' }}>
                {data.issuedByPosition || ''}
              </div>
              <div className="text-center text-[10px]">Position/Office</div>
              <div className="border-b border-black text-center min-h-[18px] text-xs" style={{ marginTop: '12px' }}>{data.dateIssued}</div>
              <div className="text-center text-[10px]">Date</div>
            </div>
          </div>
          <div style={{ width: '60%', padding: '8px 16px' }}>
            <div className="text-xs font-semibold mb-1">Received by:</div>
            <div style={{ marginTop: '32px' }}>
              <div className="border-b border-black text-center min-h-[18px] font-bold uppercase text-xs">
                {data.receivedBy || data.custodianName}
              </div>
              <div className="text-center text-[10px]">Signature Over Printed Name</div>
              <div className="border-b border-black text-center min-h-[18px] text-xs" style={{ marginTop: '12px' }}>
                {(() => {
                  const designation = data.designation || '';
                  const office = data.office || '';
                  if (designation && office) return `${designation} / ${office}`;
                  return designation || office || '';
                })()}
              </div>
              <div className="text-center text-[10px]">Position/Office</div>
              <div className="border-b border-black text-center min-h-[18px] text-xs" style={{ marginTop: '12px' }}></div>
              <div className="text-center text-[10px]">Date</div>
            </div>
          </div>
        </div>

      </div>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @media print {
          /* Hide all other root elements and radix dialog overlays safely */
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
          }
        }
      `}</style>

      {/* Normal View */}
      <div className="print:hidden">
        <div className="flex justify-end mb-4 gap-2 sticky top-0 z-10 bg-white/90 p-2 pr-12 backdrop-blur-sm border-b items-center">
          <PrintLayoutHint layout={PRINT_LAYOUT.A4_PORTRAIT} />
          <Button onClick={() => printDocument(PRINT_LAYOUT.A4_PORTRAIT)}>
            <Printer className="h-4 w-4 mr-2" /> Print
          </Button>
        </div>
        <div className="flex justify-center pb-8">
          <ReportContent preview={true} />
        </div>
      </div>

      {/* Print View via Portal */}
      {createPortal(
        <PrintDocumentLayout
          layout={PRINT_LAYOUT.A4_PORTRAIT}
          className="print-portal-root"
        >
          <ReportContent preview={false} />
        </PrintDocumentLayout>,
        document.body
      )}
    </>
  );
};