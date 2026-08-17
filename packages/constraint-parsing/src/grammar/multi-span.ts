import type { ISODate } from "@timeaway/shared";
import { findMonthRange } from "./months.js";
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
      findMonthRange(segment, today, yearHint);

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
