import { format } from "date-fns";

export const formatReturnCurrency = (value?: number | null): string => {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return "";
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(value));
};

export type ReturnItemDescriptionInput = {
  description?: string | null;
  date_acquired?: string | null;
  unit_cost?: number | null;
  total_cost?: number | null;
  quantity?: number | null;
};

/** Item description for RRSP: name + date acquired + amount (total or unit × qty). */
export function formatReturnItemDescription(item: ReturnItemDescriptionInput): string {
  const base = (item.description || "No description").trim();
  const segments: string[] = [base];

  if (item.date_acquired) {
    const acquired = new Date(item.date_acquired);
    if (!Number.isNaN(acquired.getTime())) {
      segments.push(`Acq: ${format(acquired, "MMM d, yyyy")}`);
    }
  }

  const qty = item.quantity ?? 1;
  const unitCost = item.unit_cost != null ? Number(item.unit_cost) : null;
  const totalCost = item.total_cost != null ? Number(item.total_cost) : null;
  const amount =
    totalCost != null && totalCost > 0
      ? totalCost
      : unitCost != null && unitCost > 0
        ? unitCost * qty
        : null;

  if (amount != null && amount > 0) {
    segments.push(`Amount: ${formatReturnCurrency(amount)}`);
  }

  return segments.join(" | ");
}
