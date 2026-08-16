import type { ISODate } from "@timeaway/shared";

export interface DateRange {
  start: ISODate;
  end: ISODate;
}

export interface FoundPeriod {
  range: DateRange;
  /** Human-readable note for the confirmation message. */
  note: string;
  /** Character span consumed from the input, so callers can subtract it. */
  start: number;
  end: number;
}

function iso(year: number, month: number, day: number): ISODate {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Fuzzy travel periods, resolved deterministically. Singapore-flavoured and
 * deliberately approximate: these set a *search horizon* (brief section 8's
 * "rough travel period"), not a hard constraint, so a few days either way
 * costs nothing — the ranking narrows it afterwards.
 *
 * "year end" spans into January by design: a trip departing 30 Dec is a
 * year-end trip (founder-decided, docs/DECISIONS.md).
 */
const PERIODS: {
  pattern: RegExp;
  label: string;
  resolve: (year: number, match: RegExpExecArray) => DateRange;
}[] = [
  {
    pattern: /\b(?:year[-\s]?end|end[-\s]of[-\s](?:the[-\s])?year|eoy)\b/i,
    label: "year end",
    resolve: (y) => ({ start: iso(y, 11, 15), end: iso(y + 1, 1, 5) }),
  },
  {
    pattern: /\bschool[-\s](?:holidays?|hols?)\b/i,
    label: "school holidays",
    // Resolved to the year-end block; the mid-year block is picked by the
    // next-occurrence logic below when that comes sooner.
    resolve: (y) => ({ start: iso(y, 11, 15), end: iso(y, 12, 31) }),
  },
  {
    pattern: /\bmid[-\s]?year\b/i,
    label: "mid-year",
    resolve: (y) => ({ start: iso(y, 5, 15), end: iso(y, 7, 15) }),
  },
  {
    pattern: /\bq([1-4])\b/i,
    label: "quarter",
    resolve: (y, m) => {
      const q = Number(m[1]);
      const startMonth = (q - 1) * 3 + 1;
      const endMonth = startMonth + 2;
      return {
        start: iso(y, startMonth, 1),
        end: iso(y, endMonth, lastDay(y, endMonth)),
      };
    },
  },
  {
    pattern: /\bearly\s+(?:next\s+year|this\s+year|20\d{2})\b/i,
    label: "early in the year",
    resolve: (y) => ({ start: iso(y, 1, 1), end: iso(y, 3, 31) }),
  },
  {
    pattern: /\blate\s+(?:next\s+year|this\s+year|20\d{2})\b/i,
    label: "late in the year",
    resolve: (y) => ({ start: iso(y, 10, 1), end: iso(y, 12, 31) }),
  },
  {
    pattern: /\bnext\s+year\b/i,
    label: "next year",
    resolve: (y) => ({ start: iso(y, 1, 1), end: iso(y, 12, 31) }),
  },
];

const MID_YEAR_SCHOOL_HOLIDAYS = (y: number): DateRange => ({
  start: iso(y, 5, 25),
  end: iso(y, 6, 30),
});

function lastDay(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Locate a fuzzy period term in free text and resolve it to concrete dates.
 *
 * Year resolution: an explicit year in the text wins ("2027 year end"); a bare
 * "next year" shifts forward one; otherwise the current year is used unless
 * that period has already ended, in which case it rolls to the next one.
 */
export function findFuzzyPeriod(
  text: string,
  today: ISODate,
): FoundPeriod | null {
  const currentYear = Number(today.slice(0, 4));

  for (const period of PERIODS) {
    const match = period.pattern.exec(text);
    if (!match) continue;

    const explicitYear = /\b(20\d{2})\b/.exec(text)?.[1];
    const saysNextYear = /\bnext\s+year\b/i.test(text);

    let year: number;
    if (explicitYear) year = Number(explicitYear);
    else if (saysNextYear) year = currentYear + 1;
    else year = currentYear;

    let range = period.resolve(year, match);

    // "school holidays" with no year: prefer whichever block comes next.
    if (period.label === "school holidays" && !explicitYear && !saysNextYear) {
      const mid = MID_YEAR_SCHOOL_HOLIDAYS(year);
      if (today <= mid.end) range = mid;
    }

    // Period already finished and no year was pinned — roll forward.
    if (!explicitYear && !saysNextYear && range.end < today) {
      range = period.resolve(year + 1, match);
    }

    // Consume the year token too when it sits adjacent to the term.
    let start = match.index;
    let end = match.index + match[0].length;
    if (explicitYear) {
      const yearIndex = text.indexOf(explicitYear);
      if (yearIndex >= 0 && Math.abs(yearIndex - end) <= 2) {
        end = yearIndex + explicitYear.length;
      } else if (yearIndex >= 0 && Math.abs(start - (yearIndex + 4)) <= 2) {
        start = yearIndex;
      }
    }

    return { range, note: period.label, start, end };
  }
  return null;
}
