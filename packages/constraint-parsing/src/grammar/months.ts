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

// A bare space also separates months ("June July 2028") — people write it,
// and requiring a dash or "to" made the bot look stupid for no benefit.
const SEP = "(?:\\s*(?:to|until|till|through|[–—-])\\s*|\\s+)";

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
export function findMonthRange(
  text: string,
  today: ISODate,
  /** Year to assume when the text names months but no year — e.g. "next year
   *  around June–July" supplies 2027 from elsewhere in the sentence. */
  yearHint?: number,
): FoundPeriod | null {
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

  // Numeric ranges: "12/12-15/12", "5/12 to 8/12". Written without spaces this
  // is how most people type dates, and it was reaching chrono, which returned
  // *one* of the two dates — sometimes the start, sometimes the end — so a
  // four-day block was silently recorded as a single day.
  const numeric = new RegExp(
    `\\b(\\d{1,2})[/.](\\d{1,2})\\s*(?:to|till|until|-|–|—)\\s*(\\d{1,2})[/.](\\d{1,2})\\b`,
    "i",
  ).exec(text);
  if (numeric) {
    const range = resolveNumericRange(numeric, currentYear, today);
    if (range) {
      return {
        range,
        note: "numeric range",
        start: numeric.index,
        end: numeric.index + numeric[0].length,
      };
    }
  }

  // Named days come first: "20-25 Nov" must resolve to those six days. Falling
  // through to the bare-month matcher turned a long-weekend constraint into a
  // whole-month one — the exact over-claim the grammar exists to avoid.
  const days = findDayRange(text, currentYear, currentMonth, yearHint);
  if (days) return days.range.end < today ? null : clampToToday(days, today);

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
  else if (yearHint !== undefined) startYear = yearHint;
  else startYear = startMonth >= currentMonth ? currentYear : currentYear + 1;

  const endYear = explicitEndYear
    ? Number(explicitEndYear)
    : endMonth >= startMonth
      ? startYear
      : startYear + 1;

  // A day we could see but could not resolve ("Nov 20, 22 and 25", "20th-ish
  // Nov") must not silently become the whole month. Decline and let the LLM
  // take it — one extra call is cheaper than a wrong month.
  if (namesUnresolvedDay(text, match.index, match.index + match[0].length)) {
    return null;
  }

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

/**
 * Day-first, because Singapore writes DD/MM — the same reason chrono is
 * configured to en.GB. Reading 12/12–15/12 the other way would be invisible
 * until it landed in the wrong month.
 */
function resolveNumericRange(
  match: RegExpExecArray,
  currentYear: number,
  today: ISODate,
): { start: ISODate; end: ISODate } | null {
  const [d1, m1, d2, m2] = match.slice(1, 5).map(Number) as [number, number, number, number];
  if ([m1, m2].some((m) => m < 1 || m > 12)) return null;

  const build = (day: number, month: number, year: number) => {
    if (day < 1 || day > lastDay(year, month)) return null;
    return iso(year, month, day);
  };

  // The range may cross a new year: 28/12–3/1 is one trip, not a backwards one.
  const startYear = m1 >= Number(today.slice(5, 7)) ? currentYear : currentYear + 1;
  const start = build(d1, m1, startYear);
  if (!start) return null;
  const endYear = m2 >= m1 ? startYear : startYear + 1;
  const end = build(d2, m2, endYear);
  if (!end || end < start) return null;
  return { start, end: end };
}

const DAY = "(\\d{1,2})(?:st|nd|rd|th)?";
const DAY_SEP = "\\s*(?:to|till|until|through|[–—-])\\s*";

/**
 * Explicit days against a month, in either order: "20-25 Nov", "Nov 20 to 25",
 * "5 Dec". Deliberately requires the day to sit directly against the month
 * name — "3-4 days in Dec" is a duration, and the intervening words keep it
 * from matching here.
 */
function findDayRange(
  text: string,
  currentYear: number,
  currentMonth: number,
  yearHint?: number,
): FoundPeriod | null {
  const patterns: { re: RegExp; d1: number; d2: number | null; m: number; y: number }[] = [
    // "20-25 Nov 2026"
    { re: new RegExp(`\\b${DAY}${DAY_SEP}${DAY}\\s+(${MONTH_RE})(?:\\s+(\\d{4}))?\\b`, "i"), d1: 1, d2: 2, m: 3, y: 4 },
    // "Nov 20-25 2026"
    { re: new RegExp(`\\b(${MONTH_RE})\\s+${DAY}${DAY_SEP}${DAY}(?:\\s+(\\d{4}))?\\b`, "i"), d1: 2, d2: 3, m: 1, y: 4 },
    // "25 Nov 2026"
    { re: new RegExp(`\\b${DAY}\\s+(${MONTH_RE})(?:\\s+(\\d{4}))?\\b`, "i"), d1: 1, d2: null, m: 2, y: 3 },
    // "Nov 25 2026"
    { re: new RegExp(`\\b(${MONTH_RE})\\s+${DAY}(?:\\s+(\\d{4}))?\\b`, "i"), d1: 2, d2: null, m: 1, y: 3 },
  ];

  for (const p of patterns) {
    const match = p.re.exec(text);
    if (!match) continue;

    const month = monthNumber(match[p.m]!);
    if (month === null) continue;

    const from = Number(match[p.d1]);
    const to = p.d2 === null ? from : Number(match[p.d2]);
    const explicitYear = match[p.y];
    const year = explicitYear
      ? Number(explicitYear)
      : (yearHint ?? (month >= currentMonth ? currentYear : currentYear + 1));

    // Out-of-range or inverted days mean we have misread the sentence.
    // Declining is the only safe answer.
    const limit = lastDay(year, month);
    if (from < 1 || to < 1 || from > limit || to > limit || to < from) continue;

    // "Nov 20, 22 and 25" is three separate days. Taking the first and
    // discarding the rest is quieter than claiming the month but no more
    // truthful — decline, and let the LLM read the whole list.
    if (continuesDayList(text, match.index + match[0].length)) return null;

    // "Dec 20th till Jan 2nd" is one span across two months. Claiming just the
    // "Dec 20" half would quietly shrink someone's unavailability, so stand
    // aside and let the general parser read the whole thing.
    if (continuesToAnotherDate(text, match.index + match[0].length)) return null;

    return {
      range: { start: iso(year, month, from), end: iso(year, month, to) },
      note: p.d2 === null ? "explicit day" : "explicit day range",
      start: match.index,
      end: match.index + match[0].length,
    };
  }
  return null;
}

function clampToToday(found: FoundPeriod, today: ISODate): FoundPeriod {
  return found.range.start >= today
    ? found
    : { ...found, range: { ...found.range, start: today } };
}

/** ", 22 and 25" trailing a day we already read — more days we have not. */
function continuesDayList(text: string, from: number): boolean {
  return /^\s*(?:,|and|&|\+|\/)\s*\d{1,2}\b/i.test(text.slice(from, from + 14));
}

/** A range separator leading into a second date — the span continues. */
function continuesToAnotherDate(text: string, from: number): boolean {
  return new RegExp(
    `^\\s*(?:to|till|until|through|[–—-])\\s*(?:\\d{1,2}|${MONTH_RE})`,
    "i",
  ).test(text.slice(from, from + 20));
}

/** A day-shaped number pressed up against the month we just matched. */
function namesUnresolvedDay(text: string, from: number, to: number): boolean {
  const before = text.slice(Math.max(0, from - 14), from);
  const after = text.slice(to, to + 14);
  return (
    /\d{1,2}(?:st|nd|rd|th)?\s*$/.test(before) ||
    /^\s*\d{1,2}(?:st|nd|rd|th)?\b/.test(after)
  );
}
