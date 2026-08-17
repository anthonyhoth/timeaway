import type { ISODate } from "./availability.js";

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

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function weekday(date: ISODate): string {
  return WEEKDAY_SHORT[new Date(`${date}T00:00:00Z`).getUTCDay()]!;
}

/**
 * "Wed 9 – Sun 13 Dec" — the same range, but readable as a *trip*.
 *
 * Nobody plans travel by date number. Whether a window is a long weekend or
 * five days off work is the first thing anyone wants to know, and "9–13 Dec"
 * hides it: the reader has to fetch a calendar to see that it is Wednesday to
 * Sunday. The weekday is also where the leave arithmetic becomes legible —
 * five days for three days of leave stops looking like a coincidence.
 *
 * The year is dropped when it matches the year in view, since repeating it on
 * every row of a shortlist is noise.
 */
export function formatTripDates(
  start: ISODate,
  end: ISODate,
  options: { showYear?: boolean } = {},
): string {
  const s = parts(start);
  const e = parts(end);
  const showYear = options.showYear ?? s.year !== e.year;
  const tail = showYear ? ` ${e.year}` : "";

  if (start === end) return `${weekday(start)} ${s.day} ${s.month}${tail}`;
  if (s.year !== e.year) {
    return `${weekday(start)} ${s.day} ${s.month} ${s.year} – ${weekday(end)} ${e.day} ${e.month} ${e.year}`;
  }
  if (s.month !== e.month) {
    return `${weekday(start)} ${s.day} ${s.month} – ${weekday(end)} ${e.day} ${e.month}${tail}`;
  }
  return `${weekday(start)} ${s.day} – ${weekday(end)} ${e.day} ${s.month}${tail}`;
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
