import type { ISODate } from "@timeaway/shared";
import { findMonthRange } from "./months.js";
import type { DateRange } from "./periods.js";
import { findFuzzyPeriod, findRelativePeriod } from "./periods.js";

/**
 * The single entry point for "roughly when could this trip happen?".
 *
 * The wizard and `/newtrip` arguments both resolve horizons through here, so
 * a phrase understood in one place is understood in the other. Keeping two
 * parsers is what made the bot reject "next year" in the wizard while
 * accepting it as a command argument.
 */
export function resolveHorizon(
  input: string,
  today: ISODate,
): DateRange | null {
  const text = input.trim();
  if (!text) return null;

  const currentYear = Number(today.slice(0, 4));

  // A year phrase can sit alongside a month range — "next year around
  // June–July" means June to July of next year, not all of next year — so the
  // year is extracted first and handed to the month matcher as a hint.
  let yearHint: number | undefined;
  const explicitYear = /\b(20\d{2})\b/.exec(text)?.[1];
  if (explicitYear) yearHint = Number(explicitYear);
  else if (/\bnext\s+year\b/i.test(text)) yearHint = currentYear + 1;
  else if (/\bthis\s+year\b/i.test(text)) yearHint = currentYear;

  // Months are the most specific signal, so they win when present.
  const months = findMonthRange(text, today, yearHint);
  if (months) return months.range;

  const fuzzy = findFuzzyPeriod(text, today);
  if (fuzzy) return fuzzy.range;

  const relative = findRelativePeriod(text, today);
  if (relative) return relative.range;

  return null;
}

/**
 * Duration in days, for the wizard's "how many days?" step where a bare
 * "4-6" is unambiguous. Freeform `/newtrip` arguments use a stricter rule
 * that requires the word "days", so a date range is never mistaken for one.
 */
export function parseDurationRange(
  input: string,
): { min: number; max: number } | null {
  const text = input
    .trim()
    .toLowerCase()
    .replace(/\s*days?$/, "");
  const range = /^(\d{1,2})\s*(?:-|–|—|to|until)\s*(\d{1,2})$/.exec(text);
  const single = range ? null : /^(\d{1,2})$/.exec(text);
  if (!range && !single) return null;

  const min = Number((range ?? single)![1]);
  const max = range ? Number(range[2]) : min;
  if (min < 1 || max < min || max > 30) return null;
  return { min, max };
}
