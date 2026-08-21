import type { ISODate } from "@timeaway/shared";
import { MONTH_RE, findMonthRange } from "./months.js";
import type { DateRange } from "./periods.js";
import { findSubPeriod } from "./subperiods.js";

/**
 * Several periods in one message.
 *
 * "free in oct last 2 weeks, nov 1st week and last week and dec 3rd week" is
 * four separate spans, and the single-reference parser took the first and
 * silently dropped the rest. That is an *under*-claim, which is in some ways
 * worse than over-claiming: the speaker watched their message get a ✍ and
 * reasonably believed all five weeks were recorded, while the card was built
 * from two.
 *
 * Two things make this work. Segments are split on the connectives people
 * actually use, and **the month carries** — "nov 1st week and last week" names
 * November once and means it twice.
 *
 * The safety rule is unchanged: a segment that looks like it holds a date but
 * cannot be resolved makes the whole message decline. Half a list is not a
 * safer answer than none, because nobody can see which half was kept.
 */
// "or" splits too: "free nov or dec" offers both, and dropping everything
// after the first segment lost half the answer while the sender saw a ✍.
const SEGMENT_SPLIT = /\s*(?:,|;|\band\b|\bor\b|&|\+|\/)\s*/i;

/** Tokens that mean a segment is making a claim about dates. */
const DATE_BEARING =
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|week|wk|weeks|wks|day|days|half|first|last|final|second|third|fourth|1st|2nd|3rd|4th|early|mid|middle|late|beginning|start|end)\b|\d/i;

export function parseMultiSpan(
  rawText: string,
  today: ISODate,
  yearHint?: number,
): DateRange[] | null {
  const segments = rawText
    .split(SEGMENT_SPLIT)
    .map((part) => part.trim())
    .filter(Boolean);
  if (segments.length < 2) return null;

  const ranges: DateRange[] = [];
  // The month most recently named, so a bare "last week" knows where it is.
  let carried: { start: string; end: string } | undefined;

  for (const segment of segments) {
    if (!DATE_BEARING.test(segment)) continue;

    const found =
      findSubPeriod(segment, today, yearHint, carried) ??
      findMonthRange(segment, today, yearHint) ??
      // The hint comes from the trip horizon, and a horizon opening in October
      // makes "june" mean June 2026 — already gone, so the matchers refuse it.
      // Every segment then failed, the whole list declined, and the caller's
      // single-reference path silently kept the first window. Falling back to
      // the matcher's own roll-forward keeps the list intact.
      findSubPeriod(segment, today, undefined, carried) ??
      findMonthRange(segment, today, undefined);

    // Date-shaped but unreadable — decline the message rather than record a
    // list with a hole in it.
    if (!found) return null;

    ranges.push(found.range);
    carried = monthAround(found.range.start);
  }

  // One span is the ordinary case and belongs to the single-reference path,
  // which knows about restrictions, roster-pending and the rest.
  return ranges.length >= 2 ? ranges : null;
}

function monthAround(date: string): { start: string; end: string } {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(last)}`,
  };
}

/**
 * A calendar written as a list: "mar: no. apr: yes. may: maybe."
 *
 * Distinct from `parseMultiSpan` because each entry carries **its own state**,
 * where a multi-span list shares one. It was the densest availability message
 * in three replays and recorded nothing at all — including the only naturally
 * occurring MAYBE, which is the state the five-value model exists for.
 *
 * The colon is what makes this safe to read: "shortlist: seoul, taipei" has one
 * too, but no month sits in front of it, so nothing matches.
 */
const CALENDAR_ENTRY = new RegExp(
  `\\b(${MONTH_RE})\\s*:\\s*` +
    `(yes|no|can|cannot|cant|can't|cmi|maybe|ok|okay|free|busy|open|tbc|dunno)\\b`,
  "gi",
);

const ENTRY_STATE: Record<string, "AVAILABLE" | "UNAVAILABLE" | "MAYBE" | "UNKNOWN"> = {
  yes: "AVAILABLE", can: "AVAILABLE", ok: "AVAILABLE", okay: "AVAILABLE",
  free: "AVAILABLE", open: "AVAILABLE",
  no: "UNAVAILABLE", cannot: "UNAVAILABLE", cant: "UNAVAILABLE",
  "can't": "UNAVAILABLE", cmi: "UNAVAILABLE", busy: "UNAVAILABLE",
  maybe: "MAYBE",
  tbc: "UNKNOWN", dunno: "UNKNOWN",
};

export interface CalendarEntry {
  state: "AVAILABLE" | "UNAVAILABLE" | "MAYBE" | "UNKNOWN";
  range: DateRange;
}

/** Null unless at least two months carry their own answer. */
export function parseMonthCalendar(
  rawText: string,
  today: ISODate,
  yearHint?: number,
): CalendarEntry[] | null {
  const entries: CalendarEntry[] = [];
  for (const match of rawText.matchAll(CALENDAR_ENTRY)) {
    const state = ENTRY_STATE[match[2]!.toLowerCase()];
    if (!state) return null;
    const found =
      findMonthRange(match[1]!, today, yearHint) ??
      findMonthRange(match[1]!, today, undefined);
    // Date-shaped but unreadable — decline rather than record a partial list,
    // for the same reason parseMultiSpan does.
    if (!found) return null;
    entries.push({ state, range: found.range });
  }
  return entries.length >= 2 ? entries : null;
}
