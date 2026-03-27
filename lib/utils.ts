import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines class names using clsx and tailwind-merge.
 * This ensures Tailwind classes are properly merged without conflicts.
 *
 * Usage:
 * ```tsx
 * cn("px-4 py-2", isActive && "bg-primary", className)
 * ```
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Returns a local-timezone YYYY-MM-DD date string for the given date (or today).
 * Use this instead of new Date().toISOString().split('T')[0] to avoid UTC offset
 * issues for users in non-UTC timezones (e.g., Dubai UTC+4 at midnight shows wrong day).
 *
 * Usage:
 * ```ts
 * localDateStr()           // today in local time
 * localDateStr(someDate)   // specific date in local time
 * ```
 */
export function localDateStr(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
