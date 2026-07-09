import headerLogo from "@/assets/HEADERLOGO.png";
import { AnnexReturnSlip, AnnexReturnSlipItem } from "@/types/annex";
import { format } from "date-fns";

/** Long bond portrait (8.5" × 13") — not US Legal (8.5" × 14"). */
export const RRSP_PAGE_WIDTH_MM = 215.9;
export const RRSP_PAGE_HEIGHT_MM = 330.2;
export const RRSP_HALF_HEIGHT_MM = RRSP_PAGE_HEIGHT_MM / 2;

/** Blank form row count (official RRSP has ~12 lines). */
const FORM_STANDARD_ROWS = 9;
/** Max item rows that fit in one half-page without breaking signatures. */
const MAX_ITEMS_PER_COPY = 11;

type TableLayout = {
  totalRows: number;
  rowHeightClass: string;
  cellTextClass: string;
  descriptionClass: string;
};

function getTableLayout(itemCount: number): TableLayout {
  if (itemCount === 0) {
    return {
      totalRows: FORM_STANDARD_ROWS,
      rowHeightClass: "h-[5.2mm]",
      cellTextClass: "text-[9pt]",
      descriptionClass: "text-[9pt]",
    };
  }
  if (itemCount <= FORM_STANDARD_ROWS) {
    return {
      totalRows: FORM_STANDARD_ROWS,
      rowHeightClass: "h-[5.2mm]",
      cellTextClass: "text-[9pt]",
      descriptionClass: "text-[9pt]",
    };
  }
  return {
    totalRows: itemCount,
    rowHeightClass: "h-[3.6mm]",
    cellTextClass: "text-[7.5pt]",
    descriptionClass: "text-[7.5pt] leading-[1.05]",
  };
}

function chunkItems<T>(items: T[], chunkSize: number): T[][] {
  if (items.length === 0) return [[]];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

const getOfficerFontSize = (name: string) => {
  if (!name) return "text-[10pt]";
  const words = name.trim().split(/\s+/);
  if (words.length > 3 || name.length > 20) {
    return "text-[8.5pt] leading-tight";
  }
  return "text-[10pt]";
};

export const RRSP_PRINT_STYLES = `
  @media print {
    body > *:not(.print-portal-root):not(.rrsp-print-root) {
      display: none !important;
    }
    html, body {
      background: white !important;
      padding: 0 !important;
      margin: 0 !important;
      overflow: visible !important;
      height: auto !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .print-portal-root,
    .rrsp-print-root {
      display: block !important;
      position: static !important;
      left: auto !important;
      top: auto !important;
      width: 100% !important;
      height: auto !important;
      min-height: 0 !important;
      background: white !important;
      padding: 0 !important;
      margin: 0 !important;
      overflow: visible !important;
      box-sizing: border-box !important;
    }
    .print-portal-root > div:not(.no-print),
    .rrsp-print-root > div:not(.no-print) {
      padding: 0 !important;
      margin: 0 !important;
      display: block !important;
    }
    .no-print,
    .print-portal-root .no-print,
    .rrsp-print-root .no-print,
    .print-portal-root button,
    .rrsp-print-root button {
      display: none !important;
      visibility: hidden !important;
    }
    .rrsp-longbond-sheet {
      display: grid !important;
      grid-template-rows: 165.1mm 165.1mm !important;
      height: 330.2mm !important;
      width: 215.9mm !important;
      max-height: 330.2mm !important;
      min-height: 330.2mm !important;
      overflow: hidden !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      box-sizing: border-box !important;
    }
    .rrsp-longbond-sheet.rrsp-sheet-continued {
      page-break-before: always !important;
      break-before: page !important;
    }
    .rrsp-half-top,
    .rrsp-half-bottom {
      height: 165.1mm !important;
      min-height: 165.1mm !important;
      max-height: 165.1mm !important;
      overflow: hidden !important;
      box-sizing: border-box !important;
    }
    .rrsp-copy-half {
      height: 100% !important;
      max-height: 100% !important;
      min-height: 0 !important;
      overflow: hidden !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: flex-start !important;
      box-sizing: border-box !important;
    }
    .rrsp-table-area {
      overflow: hidden !important;
      min-height: 0 !important;
    }
    .rrsp-signatures {
      overflow: visible !important;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    .rrsp-header-banner {
      width: 100% !important;
      max-width: 215.9mm !important;
      margin-left: 0 !important;
      margin-right: 0 !important;
      padding: 0 !important;
    }
    .rrsp-header-banner img {
      width: 100% !important;
      height: 26mm !important;
      max-height: 26mm !important;
      object-fit: fill !important;
      object-position: center bottom !important;
    }
  }
`;

type ReturnRRSPPrintCopyProps = {
  slip: AnnexReturnSlip;
  copyLabel?: string;
  /** When items span multiple legal sheets. */
  sheetInfo?: { index: number; total: number };
  compactHeader?: boolean;
};

export const ReturnRRSPPrintCopy = ({ slip, copyLabel, sheetInfo, compactHeader }: ReturnRRSPPrintCopyProps) => {
  const displayItems = slip.items || [];
  const tableLayout = getTableLayout(displayItems.length);
  const isContinuation = sheetInfo && sheetInfo.index > 0;

  return (
    <div className="rrsp-copy-half relative box-border flex flex-col justify-start h-full min-h-0 px-[2.5mm] py-[1mm] font-serif text-black">
      {isContinuation && sheetInfo && (
        <div className="mb-[1mm] shrink-0 border border-black bg-gray-50 py-[0.5mm] text-center text-[8pt] font-bold uppercase">
          Continued — Page {sheetInfo.index + 1} of {sheetInfo.total} — RRSP {slip.rrspNumber}
        </div>
      )}

      {/* Header — full paper width so the rule line reaches both edges; copy tag on the line */}
      <div className="rrsp-header-banner relative -mx-[2.5mm] mb-[0.5mm] w-[calc(100%+5mm)] shrink-0 overflow-visible">
        <img
          src={headerLogo}
          alt="Province of Apayao - General Services Office"
          className={`block w-full object-fill object-bottom [object-position:center_bottom] ${
            compactHeader || isContinuation ? "h-[22mm] max-h-[22mm]" : "h-[28mm] max-h-[28mm]"
          }`}
        />
        {copyLabel && (
          <span className="absolute bottom-[0.5mm] right-[3mm] z-10 bg-white px-1 font-mono text-[6.5pt] font-bold uppercase leading-none tracking-wide text-black">
            {copyLabel}
          </span>
        )}
      </div>

      <div className="mb-[0.5mm] flex shrink-0 items-baseline justify-end pr-[1mm] text-[8pt] italic font-bold">
        Annex A.6
      </div>

      <div className="mb-[0.5mm] shrink-0 text-center text-[11pt] font-bold uppercase tracking-wide leading-tight">
        Receipt of Returned Semi-Expendable Property
        {isContinuation ? " (Continued)" : ""}
      </div>

      {/* Single table: entity/date/RRSP + items (no separate bordered blocks) */}
      <div className="rrsp-table-area shrink-0 flex min-h-0 flex-col overflow-hidden">
        <table className="rrsp-items-table w-full table-fixed border-collapse border border-black">
          <tbody>
            <tr className="shrink-0">
              <td
                colSpan={3}
                className="border border-black px-[1mm] py-0 align-middle text-[9pt] leading-none"
              >
                <span className="mr-[1mm] font-bold uppercase">Entity Name:</span>
                <span className="font-bold uppercase">
                  {slip.entityName || "PROVINCIAL GOVERNMENT OF APAYAO"}
                </span>
              </td>
              <td colSpan={2} className="border border-black p-0 align-middle text-[9pt] leading-none">
                <div className="flex items-center border-b border-black px-[1mm] py-0">
                  <span className="mr-[2mm] whitespace-nowrap shrink-0 font-bold uppercase">Date:</span>
                  <span className="font-semibold">
                    {slip.date ? format(new Date(slip.date), "MMMM d, yyyy") : ""}
                  </span>
                </div>
                <div className="flex items-center px-[1mm] py-0">
                  <span className="mr-[2mm] whitespace-nowrap shrink-0 font-bold uppercase">RRSP No.:</span>
                  <span className="font-mono font-bold text-red-700">{slip.rrspNumber?.replace(/^RRSP-/, '')}</span>
                </div>
              </td>
            </tr>
            <tr>
              <td
                colSpan={5}
                className="border border-black bg-white px-1 py-[0.8mm] text-center text-[8pt] font-normal italic"
              >
                This is to acknowledge receipt of the returned Semi-expendable Property
              </td>
            </tr>
            <tr className="bg-gray-100/90">
              <th className="w-[38%] border border-black px-1 py-[0.4mm] text-center text-[7.5pt] font-bold uppercase">
                Item Description
              </th>
              <th className="w-[10%] border border-black px-1 py-[0.4mm] text-center text-[7.5pt] font-bold uppercase">
                Qty
              </th>
              <th className="w-[14%] border border-black px-1 py-[0.4mm] text-center text-[7.5pt] font-bold uppercase">
                ICS No.
              </th>
              <th className="w-[18%] border border-black px-1 py-[0.4mm] text-center text-[7.5pt] font-bold uppercase">
                End-user
              </th>
              <th className="w-[20%] border border-black px-1 py-[0.4mm] text-center text-[7.5pt] font-bold uppercase">
                Remarks
              </th>
            </tr>
            {Array.from({ length: tableLayout.totalRows }).map((_, i) => {
              const item: AnnexReturnSlipItem | null =
                i < displayItems.length ? displayItems[i] : null;
              return (
                <tr key={i} className={tableLayout.rowHeightClass}>
                  <td
                    className={`border border-black px-1 align-top ${tableLayout.descriptionClass} break-words`}
                  >
                    {item?.itemDescription || "\u00A0"}
                  </td>
                  <td
                    className={`border border-black px-1 text-center align-middle font-semibold ${tableLayout.cellTextClass}`}
                  >
                    {item?.quantity ?? "\u00A0"}
                  </td>
                  <td
                    className={`border border-black px-1 text-center align-middle font-mono ${tableLayout.cellTextClass}`}
                  >
                    {item?.icsNumber || "\u00A0"}
                  </td>
                  <td
                    className={`border border-black px-1 text-center align-middle ${tableLayout.cellTextClass}`}
                  >
                    {item?.endUser || "\u00A0"}
                  </td>
                  <td
                    className={`border border-black px-1 align-top italic ${tableLayout.cellTextClass} break-words`}
                  >
                    {item?.remarks || "\u00A0"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Signatures — fixed last grid row so print never clips Returned/Received by */}
      <div className="rrsp-signatures mt-[0.5mm] grid shrink-0 grid-cols-2 gap-[4mm] px-[1mm] text-[9pt]">
        <div>
          <div className="mb-[1mm] text-[9pt] font-bold uppercase">Returned by:</div>
          <div className="mx-auto w-[88%] text-center">
            <div
              className={`mb-[0.5mm] flex h-[5mm] items-end justify-center border-b-2 border-black font-bold ${getOfficerFontSize(slip.returnedBy || "")}`}
            >
              {slip.returnedBy}
            </div>
            <div className="text-[8pt] font-medium uppercase leading-tight text-gray-800">
              {slip.returnedByDesignation || "End User"}
            </div>
            <div className="mx-auto mt-[3mm] h-[4mm] w-2/3 border-b border-black flex items-end justify-center font-bold text-[8pt]">
              {slip.date ? format(new Date(slip.date), "MMMM d, yyyy") : ""}
            </div>
            <div className="mt-[0.5mm] text-[7pt] uppercase text-gray-600">Date</div>
          </div>
        </div>
        <div>
          <div className="mb-[1mm] text-[9pt] font-bold uppercase">Received by:</div>
          <div className="mx-auto w-[88%] text-center">
            <div
              className={`mb-[0.5mm] flex h-[5mm] items-end justify-center border-b-2 border-black font-bold ${getOfficerFontSize(slip.receivedBy || "")}`}
            >
              {slip.receivedBy}
            </div>
            <div className="text-[8pt] font-medium uppercase leading-tight text-gray-800">
              {slip.receivedByDesignation || "Head, Property and/or Supply Division/Unit"}
            </div>
            <div className="mx-auto mt-[3mm] h-[4mm] w-2/3 border-b border-black flex items-end justify-center font-bold text-[8pt]">
              {slip.date ? format(new Date(slip.date), "MMMM d, yyyy") : ""}
            </div>
            <div className="mt-[0.5mm] text-[7pt] uppercase text-gray-600">Date</div>
          </div>
        </div>
      </div>
    </div>
  );
};

type ReturnRRSPPrintPageProps = {
  slip: AnnexReturnSlip;
  className?: string;
};

type ReturnRRSPPrintSheetProps = {
  slip: AnnexReturnSlip;
  items: AnnexReturnSlipItem[];
  sheetInfo?: { index: number; total: number };
  className?: string;
};

const ReturnRRSPPrintSheet = ({ slip, items, sheetInfo, className = "" }: ReturnRRSPPrintSheetProps) => {
  const slipSlice: AnnexReturnSlip = { ...slip, items };
  const isContinuation = sheetInfo && sheetInfo.index > 0;

  return (
    <div
      data-print-root
      className={`rrsp-longbond-sheet print-doc-longbond-portrait-zero relative mx-auto box-border grid h-[330.2mm] w-[215.9mm] grid-rows-[minmax(0,1fr)_minmax(0,1fr)] overflow-hidden bg-white print:overflow-hidden ${
        isContinuation ? "rrsp-sheet-continued mt-8 print:mt-0" : ""
      } ${className}`}
      style={{
        fontFamily: "'Times New Roman', serif",
        gridTemplateRows: `${RRSP_HALF_HEIGHT_MM}mm ${RRSP_HALF_HEIGHT_MM}mm`,
      }}
    >
      {/* Screen-only cut guide (not in document flow — avoids stealing space from bottom copy on print) */}
      <div className="no-print pointer-events-none absolute left-0 right-0 top-1/2 z-20 -translate-y-1/2">
        <div className="border-t border-dashed border-black/40" />
        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded border border-dashed border-gray-400 bg-gray-100 px-2 font-mono text-[6pt] uppercase tracking-wider text-gray-500">
          ✂ Cut here — Original &amp; Supply Division copy
        </div>
      </div>

      <div className="rrsp-half-top min-h-0 overflow-hidden border-b border-dashed border-black/40 print:border-black/30">
        <ReturnRRSPPrintCopy
          slip={slipSlice}
          copyLabel="ORIGINAL COPY"
          sheetInfo={sheetInfo}
          compactHeader={isContinuation}
        />
      </div>

      <div className="rrsp-half-bottom min-h-0 overflow-hidden">
        <ReturnRRSPPrintCopy
          slip={slipSlice}
          copyLabel="SUPPLY DIVISION COPY"
          sheetInfo={sheetInfo}
          compactHeader={isContinuation}
        />
      </div>
    </div>
  );
};

/** Two RRSP forms per long bond page (8.5" × 13", exact 50% / 50%). Extra items flow to continuation pages. */
export const ReturnRRSPPrintPage = ({ slip, className = "" }: ReturnRRSPPrintPageProps) => {
  const itemChunks = chunkItems(slip.items || [], MAX_ITEMS_PER_COPY);
  const totalSheets = itemChunks.length;

  return (
    <div className={className}>
      {itemChunks.map((items, index) => (
        <ReturnRRSPPrintSheet
          key={index}
          slip={slip}
          items={items}
          sheetInfo={totalSheets > 1 ? { index, total: totalSheets } : undefined}
          className={index > 0 ? "mt-8 print:mt-0" : ""}
        />
      ))}
      {totalSheets > 1 && (
        <p className="no-print mx-auto mt-2 max-w-[215.9mm] text-center font-sans text-xs text-amber-800">
          {slip.items?.length} items — printing {totalSheets} long bond sheet(s) (8.5&quot; × 13&quot;,{" "}
          {MAX_ITEMS_PER_COPY} items max per form). Signatures repeat on each sheet.
        </p>
      )}
    </div>
  );
};
