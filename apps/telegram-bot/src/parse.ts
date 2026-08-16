import type { ISODate } from "@timeaway/shared";
import { isValidIsoDate } from "@timeaway/trip-engine";

/**
 * Deterministic parsing of the organiser's structured wizard replies — month
 * ranges, explicit dates, duration ranges. This is NOT the natural-language
 * constraint layer (brief section 28, task 8, LLM-backed); nothing here
 * guesses. Unparseable input returns null and the bot re-asks.
 */

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
] as const;

/** Match a month by prefix of at least 3 characters ("sep", "sept", …). */
function matchMonth(token: string): number | null {
  const t = token.toLowerCase();
  if (t.length < 3) return null;
  const index = MONTHS.findIndex((m) => m.startsWith(t));
  return index === -1 ? null : index + 1;
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function iso(year: number, month: number, day: number): ISODate {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export interface DateRange {
  start: ISODate;
  end: ISODate;
}

const RANGE_SEP = /\s*(?:to|until|till|through|[–—-])\s*/;

/**
 * Parse a rough travel period: "Sep–Nov", "December", "Sep–Nov 2027",
 * "Nov–Feb" (wraps the year), or explicit "2026-09-01 to 2026-11-30".
 *
 * Year inference picks the next occurrence relative to `today`; a start month
 * already underway begins today, not on the 1st. Periods entirely in the past
 * return null.
 */
export function parseHorizon(input: string, today: ISODate): DateRange | null {
  const text = input.trim();
  const currentYear = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7));

  const isoMatch = text.match(
    new RegExp(`^(\\d{4}-\\d{2}-\\d{2})${RANGE_SEP.source}(\\d{4}-\\d{2}-\\d{2})$`),
  );
  if (isoMatch) {
    const [, rawStart, rawEnd] = isoMatch;
    if (!isValidIsoDate(rawStart!) || !isValidIsoDate(rawEnd!)) return null;
    if (rawEnd! < rawStart! || rawEnd! < today) return null;
    return { start: rawStart! < today ? today : rawStart!, end: rawEnd! };
  }

  const monthToken = "([a-zA-Z]{3,9})(?:\\s+(\\d{4}))?";
  const rangeMatch = text.match(
    new RegExp(`^${monthToken}${RANGE_SEP.source}${monthToken}$`),
  );
  const singleMatch = rangeMatch
    ? null
    : text.match(new RegExp(`^${monthToken}$`));
  if (!rangeMatch && !singleMatch) return null;

  const startMonth = matchMonth((rangeMatch ?? singleMatch)![1]!);
  const endMonth = rangeMatch ? matchMonth(rangeMatch[3]!) : startMonth;
  if (startMonth === null || endMonth === null) return null;

  const explicitStartYear = (rangeMatch ?? singleMatch)![2];
  // A trailing year on the end month ("Sep–Nov 2027") anchors the range end.
  const explicitEndYear = rangeMatch?.[4];

  let startYear: number;
  if (explicitStartYear) {
    startYear = Number(explicitStartYear);
  } else if (explicitEndYear) {
    // End-year given ("Sep–Nov 2027"): start shares it unless the range
    // wraps backwards ("Nov–Feb 2027" starts Nov 2026).
    startYear =
      endMonth >= startMonth
        ? Number(explicitEndYear)
        : Number(explicitEndYear) - 1;
  } else {
    startYear = startMonth >= currentMonth ? currentYear : currentYear + 1;
  }

  const endYear = explicitEndYear
    ? Number(explicitEndYear)
    : endMonth >= startMonth
      ? startYear
      : startYear + 1;

  const start = iso(startYear, startMonth, 1);
  const end = iso(endYear, endMonth, lastDayOfMonth(endYear, endMonth));
  if (end < start || end < today) return null;
  return { start: start < today ? today : start, end };
}

export interface DurationRange {
  min: number;
  max: number;
}

/** Parse "4-6", "4 – 6 days", "5", "5 days". Bounds: 1–30 days. */
export function parseDurationRange(input: string): DurationRange | null {
  const text = input
    .trim()
    .toLowerCase()
    .replace(/\s*days?$/, "");
  const range = text.match(new RegExp(`^(\\d{1,2})${RANGE_SEP.source}(\\d{1,2})$`));
  const single = range ? null : text.match(/^(\d{1,2})$/);
  if (!range && !single) return null;

  const min = Number((range ?? single)![1]);
  const max = range ? Number(range[2]) : min;
  if (min < 1 || max < min || max > 30) return null;
  return { min, max };
}
