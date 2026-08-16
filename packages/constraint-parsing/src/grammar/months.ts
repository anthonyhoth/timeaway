import type { ISODate } from "@timeaway/shared";
import type { FoundPeriod } from "./periods.js";

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

const MONTH_RE =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

const SEP = "(?:\\s*(?:to|until|till|through|[–—-])\\s*)";

function monthNumber(token: string): number | null {
  const t = token.toLowerCase();
  const index = MONTHS.findIndex((m) => m.startsWith(t.slice(0, 3)));
  return index === -1 ? null : index + 1;
}

function lastDay(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function iso(year: number, month: number, day: number): ISODate {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Find an explicit date or month range inside free text — "Sep–Nov",
 * "December", "2026-09-01 to 2026-11-30" — and resolve it against today.
 *
 * Bare months roll forward: a month already past resolves to next year, and a
 * range whose end month precedes its start wraps the year ("Nov–Feb").
 */
export function findMonthRange(text: string, today: ISODate): FoundPeriod | null {
  const currentYear = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7));

  const isoMatch = new RegExp(
    `\\b(\\d{4}-\\d{2}-\\d{2})${SEP}(\\d{4}-\\d{2}-\\d{2})\\b`,
  ).exec(text);
  if (isoMatch) {
    const [, start, end] = isoMatch;
    if (end! >= start!) {
      return {
        range: { start: start! < today ? today : start!, end: end! },
        note: "explicit dates",
        start: isoMatch.index,
        end: isoMatch.index + isoMatch[0].length,
      };
    }
  }

  const rangeMatch = new RegExp(
    `\\b(${MONTH_RE})(?:\\s+(\\d{4}))?${SEP}(${MONTH_RE})(?:\\s+(\\d{4}))?\\b`,
    "i",
  ).exec(text);
  const singleMatch = rangeMatch
    ? null
    : new RegExp(`\\b(${MONTH_RE})(?:\\s+(\\d{4}))?\\b`, "i").exec(text);

  const match = rangeMatch ?? singleMatch;
  if (!match) return null;

  const startMonth = monthNumber(match[1]!);
  const endMonth = rangeMatch ? monthNumber(rangeMatch[3]!) : startMonth;
  if (startMonth === null || endMonth === null) return null;

  const explicitStartYear = match[2];
  const explicitEndYear = rangeMatch?.[4];

  let startYear: number;
  if (explicitStartYear) startYear = Number(explicitStartYear);
  else if (explicitEndYear)
    startYear =
      endMonth >= startMonth
        ? Number(explicitEndYear)
        : Number(explicitEndYear) - 1;
  else startYear = startMonth >= currentMonth ? currentYear : currentYear + 1;

  const endYear = explicitEndYear
    ? Number(explicitEndYear)
    : endMonth >= startMonth
      ? startYear
      : startYear + 1;

  const start = iso(startYear, startMonth, 1);
  const end = iso(endYear, endMonth, lastDay(endYear, endMonth));
  if (end < today) return null;

  return {
    range: { start: start < today ? today : start, end },
    note: rangeMatch ? "month range" : "single month",
    start: match.index,
    end: match.index + match[0].length,
  };
}
