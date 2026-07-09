import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MS_PER_HOUR = 1000 * 60 * 60;

export const RECENT_LABEL_THRESHOLD_HOURS = 48;

export function isWithinRecentThreshold(
  dateValue?: string | Date | null,
  thresholdHours: number = RECENT_LABEL_THRESHOLD_HOURS
): boolean {
  if (!dateValue) return false;
  const timestamp = new Date(dateValue).getTime();
  if (Number.isNaN(timestamp)) return false;
  const now = Date.now();
  return now - timestamp <= thresholdHours * MS_PER_HOUR;
}

export function getNewestRecordId<T extends { id: string; createdAt?: string | null }>(
  records: T[]
): string | null {
  let newestId: string | null = null;
  let newestTimestamp = -Infinity;

  for (const record of records) {
    if (!record?.createdAt) continue;
    const timestamp = new Date(record.createdAt).getTime();
    if (Number.isNaN(timestamp)) continue;
    if (timestamp > newestTimestamp) {
      newestTimestamp = timestamp;
      newestId = record.id;
    }
  }

  return newestId;
}

/**
 * Strips any legacy embedded "SN: XXXXXXXX" text from a description string.
 * Older records had the serial number baked directly into the description field;
 * this ensures it never renders twice alongside the dedicated serialNumber field.
 */
export function cleanDescription(description?: string | null): string {
  return (description || '').replace(/,?\s*SN:\s*\S+/gi, '').trim();
}
