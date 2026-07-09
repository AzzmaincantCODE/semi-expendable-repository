import {
  PRINT_LAYOUT,
  PRINT_LAYOUT_PAGE_CSS,
  type PrintLayoutId,
} from "@/lib/printLayouts";

const ACTIVE_PRINT_STYLE_ID = "semi-property-active-print-page";

/** Register once — reinforces @page on the main document when not using iframe print. */
export function initPrintLayoutListeners(): void {
  if (typeof window === "undefined") return;
  if ((window as Window & { __printLayoutInit?: boolean }).__printLayoutInit) return;
  (window as Window & { __printLayoutInit?: boolean }).__printLayoutInit = true;

  window.addEventListener("beforeprint", () => {
    const layout = document.documentElement.getAttribute(
      "data-print-layout",
    ) as PrintLayoutId | null;
    if (layout) applyActivePrintPageLayout(layout);
  });
}

export function setActivePrintLayout(layout: PrintLayoutId): void {
  document.documentElement.setAttribute("data-print-layout", layout);
  applyActivePrintPageLayout(layout);
}

export function clearActivePrintLayout(): void {
  document.documentElement.removeAttribute("data-print-layout");
  document.getElementById(ACTIVE_PRINT_STYLE_ID)?.remove();
}

export function applyActivePrintPageLayout(layout: PrintLayoutId): void {
  let style = document.getElementById(ACTIVE_PRINT_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = ACTIVE_PRINT_STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = `
    @media print {
      ${PRINT_LAYOUT_PAGE_CSS[layout]}
    }
  `;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForImages(root: ParentNode): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"));
  if (images.length === 0) return Promise.resolve();
  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) resolve();
          else {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          }
        }),
    ),
  ).then(() => undefined);
}

function cloneStylesInto(targetDoc: Document): void {
  document.querySelectorAll('link[rel="stylesheet"]').forEach((node) => {
    const link = node as HTMLLinkElement;
    if (!link.href) return;
    const clone = targetDoc.createElement("link");
    clone.rel = "stylesheet";
    clone.href = link.href;
    targetDoc.head.appendChild(clone);
  });

  document.querySelectorAll("style").forEach((node) => {
    if (node.id === ACTIVE_PRINT_STYLE_ID) return;
    targetDoc.head.appendChild(node.cloneNode(true));
  });
}

function clonePrintableSubtree(source: HTMLElement): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".no-print").forEach((el) => el.remove());
  return clone;
}

/** Best-effort: find the element that should be sent to the printer. */
export function findPrintableElement(): HTMLElement | null {
  const selectors = [
    "[data-print-root]",
    ".print-portal-root [data-print-layout]",
    ".print-portal-root > div:not(.no-print)",
    ".rrsp-print-root [data-print-layout]",
    ".rrsp-print-root .rrsp-longbond-sheet",
    ".property-card-print-root",
    "#rspi-print-area",
    "[data-print-layout]",
    ".ics-slip-print",
    ".print-page-a4-landscape",
    ".print-page-a4",
  ];

  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el instanceof HTMLElement && el.innerText.trim().length > 0) {
      return el;
    }
  }

  const portal = document.querySelector(".print-portal-root, .rrsp-print-root");
  if (portal instanceof HTMLElement) {
    const child = Array.from(portal.children).find(
      (c) => c instanceof HTMLElement && !c.classList.contains("no-print"),
    );
    if (child instanceof HTMLElement) return child;
  }

  return null;
}

/**
 * Print using an isolated iframe with a single @page rule.
 * Browsers apply paper size/margins more reliably than printing the full app shell.
 */
export async function printDocument(layout: PrintLayoutId): Promise<void> {
  setActivePrintLayout(layout);

  const source = findPrintableElement();
  if (!source) {
    window.print();
    return;
  }

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "none",
    visibility: "hidden",
  });
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    document.body.removeChild(iframe);
    window.print();
    return;
  }

  doc.open();
  doc.write("<!DOCTYPE html><html><head></head><body></body></html>");
  doc.close();

  cloneStylesInto(doc);

  const pageStyle = doc.createElement("style");
  pageStyle.textContent = `
    ${PRINT_LAYOUT_PAGE_CSS[layout]}
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .no-print { display: none !important; }
  `;
  doc.head.appendChild(pageStyle);

  doc.body.appendChild(clonePrintableSubtree(source));

  await waitForImages(doc.body);
  await wait(300);

  const cleanup = () => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    win.removeEventListener("afterprint", cleanup);
  };
  win.addEventListener("afterprint", cleanup);

  win.focus();
  win.print();

  setTimeout(cleanup, 60_000);
}

export function printDocumentSync(layout: PrintLayoutId): void {
  void printDocument(layout);
}
