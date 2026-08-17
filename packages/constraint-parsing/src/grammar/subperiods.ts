import type { ISODate } from "@timeaway/shared";
import { findMonthRange } from "./months.js";
import type { FoundPeriod } from "./periods.js";

/**
 * Parts of a month — "first 3 weeks of Jan", "last week of Dec", "early Nov".
 *
 * These used to be declined outright: the month matcher would have returned
 * the *whole* month, which over-claims, so the grammar handed them to the LLM.
 * That was the right call while it was the only safe one, but the phrasings are
 * far too common to keep paying for — and when the extractor is unavailable,
 * declining means the constraint is simply lost.
 *
 * Counted spans ("first 3 weeks", "last half") are arithmetic and exact.
 * The vague ones are conventions, and we commit to them explicitly rather than
 * pretending to a precision nobody has:
 *
 *   early / start / beginning  →  1st – 10th
 *   mid / middle               →  11th – 20th
 *   late / end                 →  21st – end of month
 *
 * A qualifier we cannot place still declines, so the guard that sends the
 * remainder to the LLM stays intact.
 */
export function findSubPeriod(
  text: string,
  today: ISODate,
  yearHint?: number,
): FoundPeriod | null {
  // Reuse the month matcher for the month itself, so year roll-forward,
  // horizon hints and abbreviations behave identically everywhere.
  const month = findMonthRange(stripQualifiers(text), today, yearHint);
  if (!month) return null;

  // Only a single whole month can be narrowed. "First week of Nov–Jan" is
  // ambiguous about which month it narrows, so it is left alone.
  const start = month.range.start;
  const [year, mon] = [Number(start.slice(0, 4)), Number(start.slice(5, 7))];
  if (month.range.end.slice(0, 7) !== start.slice(0, 7)) return null;

  const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const at = (day: number): ISODate =>
    `${year}-${String(mon).padStart(2, "0")}-${String(Math.min(day, last)).padStart(2, "0")}`;

  const span = resolveSpan(text, last);
  if (!span) return null;

  const range = { start: at(span[0]), end: at(span[1]) };
  if (range.end < today) return null;

  return {
    range: { start: range.start < today ? today : range.start, end: range.end },
    note: span[2],
    start: month.start,
    end: month.end,
  };
}

type Span = [from: number, to: number, note: string];

function resolveSpan(text: string, last: number): Span | null {
  const counted = /\b(first|last)\s+(\d{1,2}|one|two|three|four)\s*(?:weeks?|wks?)\b/i.exec(text);
  if (counted) {
    const n = wordNumber(counted[2]!);
    if (n === null || n < 1 || n > 5) return null;
    const days = n * 7;
    return counted[1]!.toLowerCase() === "first"
      ? [1, Math.min(days, last), `first ${n} weeks`]
      : [Math.max(1, last - days + 1), last, `last ${n} weeks`];
  }

  if (/\b(first|1st)\s+(?:week|wk)\b/i.test(text)) return [1, 7, "first week"];
  if (/\b(last|final)\s+(?:week|wk)\b/i.test(text)) return [last - 6, last, "last week"];
  if (/\b(?:second|2nd)\s+(?:week|wk)\b/i.test(text)) return [8, 14, "second week"];
  if (/\b(?:third|3rd)\s+(?:week|wk)\b/i.test(text)) return [15, 21, "third week"];

  if (/\b(?:first|1st)\s+half\b/i.test(text)) return [1, Math.ceil(last / 2), "first half"];
  if (/\b(?:second|2nd|last|latter)\s+half\b/i.test(text)) {
    return [Math.ceil(last / 2) + 1, last, "second half"];
  }

  if (/\b(?:early|start|beginning)\b/i.test(text)) return [1, 10, "early"];
  if (/\b(?:mid|middle)\b/i.test(text)) return [11, 20, "mid"];
  if (/\b(?:late|end)\b/i.test(text)) return [21, last, "late"];

  return null;
}

/**
 * Remove the qualifier before handing the text to the month matcher, so its
 * own day-range guard doesn't see "3 wks" as an unresolved day and decline.
 */
function stripQualifiers(text: string): string {
  return text
    .replace(
      /\b(?:first|last|final|second|third|1st|2nd|3rd|early|earlier|mid|middle|late|later|beginning|start|end|half|latter)\b/gi,
      " ",
    )
    .replace(/\b\d{1,2}\s*(?:weeks?|wks?)\b/gi, " ")
    .replace(/\b(?:one|two|three|four)\s*(?:weeks?|wks?)\b/gi, " ")
    .replace(/\b(?:of|the)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordNumber(token: string): number | null {
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4 };
  const lower = token.toLowerCase();
  if (lower in words) return words[lower]!;
  const n = Number(token);
  return Number.isFinite(n) ? n : null;
}
