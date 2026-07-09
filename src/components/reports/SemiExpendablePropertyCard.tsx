import React from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '@/assets/Logo-Bagong-Pilipinas.png';
import gsoLogo from '@/assets/gso lgo.jpg';
import headerLogo from '@/assets/HEADERLOGO.png';
import { createPortal } from 'react-dom';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { PrintDocumentLayout, PrintLayoutHint } from "@/components/print/PrintDocumentLayout";
import { printDocument } from "@/lib/printDocument";
import { PRINT_LAYOUT, PRINT_LAYOUT_PAGE_CSS } from "@/lib/printLayouts";
import { AnnexSPCPrintData, AnnexSPCEntry } from "@/types/annex";
import { format, parseISO } from 'date-fns';
import { DescriptionWithSN } from "./DescriptionWithSN";

interface PropertyCardProps {
  data: AnnexSPCPrintData;
  /** When true, render landscape print layout inline (no portal) — used by /property-cards print route */
  embeddedPrint?: boolean;
}

export const SemiExpendablePropertyCard: React.FC<PropertyCardProps> = ({ data, embeddedPrint = false }) => {
  const navigate = useNavigate();
  const handlePrint = () => {
    void printDocument(PRINT_LAYOUT.A4_LANDSCAPE);
  };

  // Format date to MM/DD/YYYY
  const formatDate = (dateStr: string | undefined): string => {
    if (!dateStr) return '';
    try {
      const date = parseISO(dateStr);
      return format(date, 'MM/dd/yyyy');
    } catch {
      return dateStr; // Return original if parsing fails
    }
  };

  const entries = React.useMemo(() => {
    let runningQty = 0;
    let runningAmount = 0;
    return (data.entries || []).map((e) => {
      const receipt = Number(e.receiptQty || 0);
      const issue = Number(e.issueQty || 0);
      const receiptAmount = Number(e.totalCost || e.amount || 0);
      const issueAmount = 0;

      runningQty = runningQty + receipt - issue;
      runningAmount = runningAmount + receiptAmount - issueAmount;

      return {
        ...e,
        balanceQty: e.balanceQty != null ? e.balanceQty : runningQty,
        amount: e.amount != null ? e.amount : (e.totalCost != null ? e.totalCost : runningAmount)
      } as AnnexSPCEntry;
    });
  }, [data.entries]);

  // Dynamic font size helper - reduces font size for long text
  const getDynamicFontSize = (text: string | undefined, maxLen: number, baseSize: number = 11): string => {
    if (!text) return `${baseSize}px`;
    if (text.length <= maxLen) return `${baseSize}px`;
    if (text.length <= maxLen * 1.5) return `${baseSize - 1}px`;
    if (text.length <= maxLen * 2) return `${baseSize - 2}px`;
    return `${Math.max(baseSize - 3, 8)}px`;
  };

  // The actual card content, reusable for both screen and print
  const CardContentRender = () => (
    <Card
      className="property-card-print print-doc-a4-landscape max-w-none rounded-none shadow-none border-none"
      style={{ width: "100%", maxWidth: "277mm" }}
    >
      <CardHeader className="overflow-visible px-3 pb-0 pt-2 print:px-[10mm] print:pt-[6mm]">
        <div className="spc-header-banner relative -mx-3 mb-1 w-[calc(100%+1.5rem)] max-w-none print:-mx-[10mm] print:mb-[1mm] print:w-[calc(100%+20mm)] print:max-w-[297mm]">
          <img
            src={headerLogo}
            alt="Province of Apayao - General Services Office"
            className="block h-[22mm] max-h-[22mm] w-full object-fill object-bottom [object-position:center_bottom] print:h-[20mm] print:max-h-[20mm]"
          />
        </div>

        <div className="relative text-center">
          <span className="absolute right-0 top-0 text-[11px] italic">Annex A.1</span>
          <h2 className="text-[22px] font-bold" style={{ marginBottom: '2px' }}>SEMI-EXPENDABLE PROPERTY CARD</h2>
        </div>
      </CardHeader>

      <CardContent className="p-3 pt-1">
        {/* Entity Name and Fund Cluster - Outside main table */}
        <div className="flex gap-4" style={{ marginBottom: '2px' }}>
          <div className="flex items-baseline gap-1 flex-1">
            <span className="font-bold whitespace-nowrap text-[11px]">Entity Name:</span>
            <div className="flex-1 border-b border-black text-[11px] font-bold" style={{ padding: '0 2px' }}>{data.entityName}</div>
          </div>
          <div className="flex items-baseline gap-1" style={{ width: '300px' }}>
            <span className="font-bold whitespace-nowrap text-[11px]">Fund Cluster:</span>
            <div className="flex-1 border-b border-black text-[11px] font-bold" style={{ padding: '0 2px' }}>{data.fundCluster}</div>
          </div>
        </div>

        {/* Main table with form fields and data table */}
        <div className="border border-black">
          {/* Form fields - Two rows with 2 columns each */}
          <table className="border-collapse text-[11px]" style={{ width: '100%', tableLayout: 'fixed' }}>
            <tbody>
              {/* Row 1: Semi-expendable Property | Semi-expendable Property Number (spans 2 rows) */}
              <tr className="border-b border-black">
                <td className="border-r border-black" style={{ width: '738px', padding: '1px 1px 1px 3px' }}>
                  <span className="font-bold text-[11px]">Semi-expendable Property:</span>
                  <span className="ml-1 text-[11px] font-bold">{data.semiExpendableProperty}</span>
                </td>
                <td className="break-all" rowSpan={2} style={{ width: '276px', verticalAlign: 'top', wordBreak: 'break-all', padding: '1px 3px 1px 3px' }}>
                  <span className="font-bold text-[11px]">Semi-expendable Property Number:</span>
                  <div className="font-mono leading-tight text-[11px] font-bold" style={{ marginTop: '1px' }}>{data.propertyNumber}</div>
                </td>
              </tr>
              {/* Row 2: Description only (Property Number continues from row 1) */}
              <tr className="border-b border-black">
                <td className="border-r border-black" style={{ width: '738px', padding: '1px 1px 1px 3px' }}>
                  <span className="font-bold text-[11px]">Description:</span>
                  <DescriptionWithSN
                    description={data.description}
                    serialNumber={data.serialNumber}
                    className="ml-1 text-[11px] font-bold"
                  />
                </td>
              </tr>
            </tbody>
          </table>

          {/* Data table */}
          <table className="text-[11px] border-collapse" style={{ width: '100%', tableLayout: 'fixed' }}>
            <thead>
              <tr className="border-b border-black">
                <th className="border-r border-black text-center align-bottom font-bold" style={{ width: '74px', padding: '1px 2px' }} rowSpan={2}>Date</th>
                <th className="border-r border-black text-center align-bottom font-bold" style={{ width: '120px', padding: '1px 2px' }} rowSpan={2}>Reference</th>
                <th className="border-r border-black text-center font-bold" colSpan={3} style={{ padding: '1px 2px' }}>Receipt</th>
                <th className="border-r border-black text-center font-bold" colSpan={3} style={{ padding: '1px 2px' }}>Issue/Transfer/Disposal</th>
                <th className="border-r border-black text-center font-bold" style={{ width: '64px', padding: '1px 2px' }} rowSpan={2}>Balance<br />Qty.</th>
                <th className="border-r border-black text-center align-bottom font-bold" style={{ width: '101px', padding: '1px 2px' }} rowSpan={2}>Amount</th>
                <th className="text-center align-bottom font-bold" style={{ width: '111px', padding: '1px 2px' }} rowSpan={2}>Remarks</th>
              </tr>
              <tr className="border-b border-black">
                <th className="border-r border-black text-center font-bold" style={{ width: '56px', padding: '1px 2px' }}>Qty.</th>
                <th className="border-r border-black text-center font-bold" style={{ width: '92px', padding: '1px 2px' }}>Unit Cost</th>
                <th className="border-r border-black text-center font-bold" style={{ width: '101px', padding: '1px 2px' }}>Total Cost</th>
                <th className="border-r border-black text-center font-bold" style={{ width: '101px', padding: '1px 2px' }}>Item No.</th>
                <th className="border-r border-black text-center font-bold" style={{ width: '56px', padding: '1px 2px' }}>Qty.</th>
                <th className="border-r border-black text-center font-bold" style={{ width: '138px', padding: '1px 2px' }}>Office/Officer</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr key={index} className="border-b border-black h-[28px]">
                  <td className="border-r border-black text-center align-top font-bold" style={{ fontSize: '10px', padding: '2px 3px' }}>{formatDate(entry.date)}</td>
                  <td className="border-r border-black text-center align-top font-bold" style={{ fontSize: getDynamicFontSize(entry.reference, 15, 10), padding: '2px 3px' }}>{entry.reference}</td>
                  <td className="border-r border-black text-center align-top font-bold" style={{ padding: '2px 3px' }}>{entry.receiptQty != null ? entry.receiptQty : ''}</td>
                  <td className="border-r border-black text-right align-top font-bold" style={{ padding: '2px 3px' }}>{entry.unitCost != null ? Number(entry.unitCost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</td>
                  <td className="border-r border-black text-right align-top font-bold" style={{ padding: '2px 3px' }}>{entry.totalCost != null ? Number(entry.totalCost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</td>
                  <td className="border-r border-black text-center align-top font-bold" style={{ fontSize: getDynamicFontSize(entry.issueItemNo, 12, 10), padding: '2px 3px' }}>{entry.issueItemNo || ''}</td>
                  <td className="border-r border-black text-center align-top font-bold" style={{ padding: '2px 3px' }}>{entry.issueQty != null && entry.issueQty !== 0 ? entry.issueQty : ''}</td>
                  <td className="border-r border-black align-top font-bold" style={{ fontSize: getDynamicFontSize(entry.officeOfficer, 20, 9), padding: '2px 3px' }}>
                    {(entry as any).slipNumber ? (
                      <span 
                        className="cursor-pointer hover:underline text-blue-800 print:text-black print:no-underline"
                        onClick={() => navigate(`/custodian-slips?search=${(entry as any).slipNumber}`)}
                        title={`Click to view ICS ${(entry as any).slipNumber}`}
                      >
                        {entry.officeOfficer}
                      </span>
                    ) : (
                      entry.officeOfficer || ''
                    )}
                  </td>
                  <td className="border-r border-black text-center align-top font-bold" style={{ padding: '2px 3px' }}>{entry.balanceQty != null ? entry.balanceQty : ''}</td>
                  <td className="border-r border-black text-right align-top font-bold" style={{ padding: '2px 3px' }}>{entry.amount != null ? Number(entry.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</td>
                  <td className="align-top font-bold" style={{ fontSize: getDynamicFontSize(entry.remarks, 15, 9), padding: '2px 3px' }}>{entry.remarks || ''}</td>
                </tr>
              ))}
              {Array.from({ length: Math.max(0, 12 - data.entries.length) }).map((_, index) => (
                <tr key={`empty-${index}`} className="border-b border-black h-[28px]">
                  {Array.from({ length: 11 }).map((__, i) => (
                    <td key={i} className={`${i < 10 ? 'border-r border-black' : ''}`} style={{ padding: '2px 3px' }}>&nbsp;</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );

  const landscapePrintCss = `
    @media print {
      ${PRINT_LAYOUT_PAGE_CSS[PRINT_LAYOUT.A4_LANDSCAPE]}
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: white !important;
        width: 297mm !important;
        height: auto !important;
      }
      .property-card-print-root {
        width: 297mm !important;
        max-width: 297mm !important;
        min-height: auto !important;
        margin: 0 auto !important;
        padding: 8mm 10mm !important;
        box-sizing: border-box !important;
        page-break-after: avoid !important;
      }
      .property-card-print-root .property-card-print {
        width: 100% !important;
        max-width: 100% !important;
      }
      .spc-header-banner {
        width: calc(100% + 20mm) !important;
        max-width: 297mm !important;
        margin-left: -10mm !important;
        margin-right: -10mm !important;
        padding: 0 !important;
      }
      .spc-header-banner img {
        width: 100% !important;
        height: 20mm !important;
        max-height: 20mm !important;
        object-fit: fill !important;
        object-position: center bottom !important;
      }
    }
  `;

  return (
    <>
      <style>{landscapePrintCss}</style>
      {!embeddedPrint && (
        <style>{`
          @media print {
            body > *:not(.print-portal-root) {
              display: none !important;
            }
            .print-portal-root {
              display: block !important;
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 297mm !important;
              max-width: 297mm !important;
              height: auto !important;
              background: white !important;
            }
            .print\\:hidden {
              display: none !important;
            }
          }
        `}</style>
      )}

      {/* Normal View inside Dialog */}
      <div className={embeddedPrint ? "hidden" : "max-w-full mx-auto print:hidden"}>
        <div className="flex justify-between items-center mb-4 pr-12">
          <h2 className="text-2xl font-bold">Semi-Expendable Property Card</h2>
          <div className="flex items-center gap-2">
            <PrintLayoutHint layout={PRINT_LAYOUT.A4_LANDSCAPE} />
            <Button onClick={handlePrint} className="flex items-center gap-2">
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </div>
        </div>
        <div className="flex justify-center">
          <CardContentRender />
        </div>
      </div>

      {embeddedPrint ? (
        <div className="property-card-print-root print-doc-a4-landscape print-page-a4-landscape print-page-fit mx-auto bg-white shadow-2xl print:shadow-none" data-print-root>
          <CardContentRender />
        </div>
      ) : (
        createPortal(
          <PrintDocumentLayout layout={PRINT_LAYOUT.A4_LANDSCAPE} className="print-portal-root">
            <div className="property-card-print-root print-page-a4-landscape print-page-fit" data-print-root>
              <CardContentRender />
            </div>
          </PrintDocumentLayout>,
          document.body,
        )
      )}
    </>
  );
};