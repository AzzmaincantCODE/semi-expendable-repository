/** Paper layouts applied via CSS @page (browser print dialog follows when possible). */

export const PRINT_LAYOUT = {
  LONG_BOND_PORTRAIT_ZERO: "longbond-portrait-zero",
  LONG_BOND_LANDSCAPE_ZERO: "longbond-landscape-zero",
  A4_PORTRAIT: "a4-portrait",
  A4_LANDSCAPE: "a4-landscape",
} as const;

export type PrintLayoutId = (typeof PRINT_LAYOUT)[keyof typeof PRINT_LAYOUT];

export type PrintLayoutMeta = {
  label: string;
  paper: string;
  margins: string;
  /** CSS class on the printable root — selects named @page in index.css */
  docClass: string;
};

export const PRINT_LAYOUT_META: Record<PrintLayoutId, PrintLayoutMeta> = {
  [PRINT_LAYOUT.LONG_BOND_PORTRAIT_ZERO]: {
    label: "Long Bond (8.5″ × 13″) Portrait",
    paper: '8.5" × 13" long bond',
    margins: "None (0)",
    docClass: "print-doc-longbond-portrait-zero",
  },
  [PRINT_LAYOUT.LONG_BOND_LANDSCAPE_ZERO]: {
    label: "Long Bond (13″ × 8.5″) Landscape",
    paper: '13" × 8.5" long bond',
    margins: "None (0)",
    docClass: "print-doc-longbond-landscape-zero",
  },
  [PRINT_LAYOUT.A4_PORTRAIT]: {
    label: "A4 Portrait",
    paper: "A4",
    margins: "None — content padding applies",
    docClass: "print-doc-a4-portrait",
  },
  [PRINT_LAYOUT.A4_LANDSCAPE]: {
    label: "A4 Landscape",
    paper: "A4 landscape",
    margins: "None — content padding applies",
    docClass: "print-doc-a4-landscape",
  },
};

export function getPrintDocClass(layout: PrintLayoutId): string {
  return PRINT_LAYOUT_META[layout].docClass;
}

export function getPrintLayoutHint(layout: PrintLayoutId): string {
  const m = PRINT_LAYOUT_META[layout];
  return `Print setup: ${m.label} · ${m.margins}`;
}

export function getPrintLayoutInstructions(layout: PrintLayoutId): string {
  const m = PRINT_LAYOUT_META[layout];
  return `Paper: ${m.paper}. Margins: ${m.margins}. If the dialog differs, match these once and save as default.`;
}

/** Inline @page override — browsers honor this more reliably than named pages alone. */
export const PRINT_LAYOUT_PAGE_CSS: Record<PrintLayoutId, string> = {
  [PRINT_LAYOUT.LONG_BOND_PORTRAIT_ZERO]: `
    @page { size: 8.5in 13in; margin: 0; }
  `,
  [PRINT_LAYOUT.LONG_BOND_LANDSCAPE_ZERO]: `
    @page { size: 13in 8.5in; margin: 0; }
  `,
  [PRINT_LAYOUT.A4_PORTRAIT]: `
    @page { size: 210mm 297mm; margin: 0; }
  `,
  [PRINT_LAYOUT.A4_LANDSCAPE]: `
    @page { size: 297mm 210mm; margin: 0; }
  `,
};
