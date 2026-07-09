import { useCallback, useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { printDocument, setActivePrintLayout } from "@/lib/printDocument";
import {
  getPrintDocClass,
  getPrintLayoutHint,
  getPrintLayoutInstructions,
  type PrintLayoutId,
} from "@/lib/printLayouts";

type PrintDocumentLayoutProps = {
  layout: PrintLayoutId;
  children: ReactNode;
  className?: string;
};

/** Wraps printable content and registers the paper layout on `documentElement` for print. */
export function PrintDocumentLayout({
  layout,
  children,
  className,
}: PrintDocumentLayoutProps) {
  useEffect(() => {
    setActivePrintLayout(layout);
    return () => {
      document.documentElement.removeAttribute("data-print-layout");
    };
  }, [layout]);

  return (
    <div
      className={cn(getPrintDocClass(layout), className)}
      data-print-layout={layout}
      data-print-root
    >
      {children}
    </div>
  );
}

/** Call from Print buttons — opens dialog with the correct paper size when possible. */
export function usePrintWithLayout(layout: PrintLayoutId) {
  return useCallback(() => {
    void printDocument(layout);
  }, [layout]);
}

type PrintLayoutHintProps = {
  layout: PrintLayoutId;
  className?: string;
};

/** Screen-only badge: shows which paper size/margins CSS will request when printing. */
export function PrintLayoutHint({ layout, className }: PrintLayoutHintProps) {
  return (
    <span
      title={getPrintLayoutInstructions(layout)}
      className={cn(
        "inline-flex max-w-xs items-center rounded-md border border-amber-600/40 bg-amber-50 px-2 py-1 font-sans text-xs font-medium text-amber-900 shadow-sm",
        className,
      )}
    >
      {getPrintLayoutHint(layout)}
    </span>
  );
}
