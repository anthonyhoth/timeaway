/**
 * The shape of a date reference: where it starts, where it ends, and whether
 * anything is allowed to move those edges.
 *
 * `resolveHorizon` and `parseAvailabilityMessage` each resolve dates their own
 * way, and each has held its own answer to these questions. The first sweep
 * taught the horizon path that "after the 13th" names a floor rather than a
 * day; the third sweep found availability still reading "dec 12 onwards" as the
 * 12th of December — three weeks of offered availability recorded as one day,
 * with the message acknowledged.
 *
 * That is the third time in three sweeps that a rule has been fixed in one
 * parser and missed in another. The answers live here now, for the same reason
 * stance.ts exists: nine parsers read the same message, and any rule only one
 * of them knows is a defect waiting for the next corpus.
 */

import type { DateRange } from "./periods.js";

/**
 * A range with both ends written out — "10-21 may", "12/12-15/12".
 *
 * The point of recognising it is that it is *finished*: the speaker gave both
 * edges, so nothing in the rest of the sentence may move them.
 */
const CLOSED_RANGE =
  /\b\d{1,2}(?:\/\d{1,2})?\s*(?:-|–|—)\s*\d{1,2}(?:\/\d{1,2})?\b|\b\d{1,2}(?:st|nd|rd|th)?\s+(?:to|till|until|through)\s+(?:the\s+)?\d{1,2}\b/i;

export function namesClosedRange(text: string): boolean {
  return CLOSED_RANGE.test(text);
}

/**
 * A floor with no ceiling — "after the 13th", "dec 12 onwards", "from June".
 *
 * A closed range disqualifies it: "from 12 to 15 dec" states its own end, and
 * the "from" there is the start of a range rather than an open bound.
 */
const OPEN_ENDED_FLOOR = /\b(?:after|onwards?|from)\b/i;
const CLOSING_WORD = /\b(?:to|till|until|through)\b|[–—-]\s*\d/i;

export function statesOpenEndedFloor(text: string): boolean {
  if (namesClosedRange(text)) return false;
  return OPEN_ENDED_FLOOR.test(text) && !CLOSING_WORD.test(text);
}

/**
 * Widen a single-day reading to the end of its month when the text named a
 * floor rather than a day.
 *
 * The end of the month is the smallest reading that is not simply wrong: it
 * keeps the month the speaker named and invents no others. Recorded in
 * docs/DECISIONS.md, 2026-08-21.
 */
export function widenOpenEndedFloor(range: DateRange, text: string): DateRange {
  if (range.start !== range.end) return range;
  if (!statesOpenEndedFloor(text)) return range;
  const [year, month] = range.start.split("-").map(Number) as [number, number];
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    start: range.start,
    end: `${year}-${pad(month)}-${pad(lastDay)}` as DateRange["end"],
  };
}
