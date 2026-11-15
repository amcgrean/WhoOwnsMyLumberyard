import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a stored date (YYYY-MM-DD, YYYY-MM, or ISO) as "Nov 2020". Dates are
 * parsed as UTC so a YYYY-MM-DD value never shifts a day in US time zones.
 * Returns the input unchanged if it can't be parsed.
 */
export function formatMonthYear(value: string | null | undefined): string {
  if (!value) return "";
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(value);
  if (!m) return value;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3] ?? 1)));
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}
