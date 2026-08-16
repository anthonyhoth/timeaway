import type { ISODate } from "@timeaway/shared";

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function parts(date: ISODate): { day: number; month: string; year: number } {
  return {
    day: Number(date.slice(8, 10)),
    month: MONTH_SHORT[Number(date.slice(5, 7)) - 1]!,
    year: Number(date.slice(0, 4)),
  };
}

/** "7–11 Nov 2026", "1 Sep – 30 Nov 2026", "1 Nov 2026 – 28 Feb 2027". */
export function formatDateRange(start: ISODate, end: ISODate): string {
  const s = parts(start);
  const e = parts(end);
  if (s.year !== e.year) {
    return `${s.day} ${s.month} ${s.year} – ${e.day} ${e.month} ${e.year}`;
  }
  if (s.month !== e.month) {
    return `${s.day} ${s.month} – ${e.day} ${e.month} ${e.year}`;
  }
  if (s.day !== e.day) return `${s.day}–${e.day} ${s.month} ${s.year}`;
  return `${s.day} ${s.month} ${s.year}`;
}

/** "4–6 days" or "5 days" — always the range form when min ≠ max. */
export function formatDuration(min: number, max: number): string {
  return min === max ? `${min} days` : `${min}–${max} days`;
}

/** "Korea or Japan", "Japan", or the open-destination fallback. */
export function formatDestinations(candidates: readonly string[]): string {
  if (candidates.length === 0) return "Destination open";
  if (candidates.length === 1) return candidates[0]!;
  return `${candidates.slice(0, -1).join(", ")} or ${candidates.at(-1)}`;
}
