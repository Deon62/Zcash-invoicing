import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn/ui className combiner. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a ZEC amount with the ⓩ marker, trimmed to 8 dp. */
export function formatZec(zec: number): string {
  const v = Number(zec.toFixed(8)).toString();
  return `${v} ZEC`;
}

/** Format a KES amount as a credible local currency string. */
export function formatKes(kes: number): string {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(kes);
}

/** Human date, e.g. "3 Jun 2026". */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Truncate a long address/txid for display: u1abcd…wxyz */
export function truncateMiddle(value: string, head = 10, tail = 6): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}
