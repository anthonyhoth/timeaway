import type { DeclaredAvailabilityState } from "@timeaway/shared";
import type { ExtractionContext } from "../types.js";
import { messageIntent } from "./availability.js";
import { findMonthRange } from "./months.js";
import {
  ALREADY_POSITIONED,
  LENGTH_IN_PERIOD,
} from "./span-shape.js";

/**
 * "I'm not free 2 weeks in Nov" — a length and a period, but not a position.
 *
 * The grammar is right to decline this: the speaker has named *how long* and
 * *roughly when*, and nothing at all about which fortnight. Guessing would put
 * a two-week block on dates they never mentioned, and claiming the whole month
 * would be worse still.
 *
 * But declining is not the end of it. The missing piece is one question with
 * three obvious answers, and asking is far better than losing the constraint —
 * particularly since the answer usually arrives as "the middle one", which
 * means nothing without remembering what was asked.
 *
 * Deliberately narrow: a *qualified* span ("first two weeks of Nov") is not
 * underspecified and is resolved by findSubPeriod long before this.
 */
export interface UnderspecifiedSpan {
  state: DeclaredAvailabilityState;
  /** How long, in days. */
  days: number;
  /** The period it sits somewhere inside. */
  within: { start: string; end: string };
  /** How the speaker said the length, for echoing back: "2 weeks". */
  lengthLabel: string;
}

const WORD_COUNTS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  couple: 2,
  "couple of": 2,
};

export function parseUnderspecifiedSpan(
  rawText: string,
  ctx: ExtractionContext,
): UnderspecifiedSpan | null {
  const text = rawText.trim();
  if (!text || ALREADY_POSITIONED.test(text)) return null;

  const match = LENGTH_IN_PERIOD.exec(text);
  if (!match) return null;

  const state = messageIntent(text);
  // UNKNOWN is about not knowing yet, which no amount of positioning fixes.
  if (state !== "AVAILABLE" && state !== "UNAVAILABLE") return null;

  const count = match[1]
    ? Number(match[1])
    : (WORD_COUNTS[match[0].trim().split(/\s+/)[0]!.toLowerCase()] ?? null);
  if (count === null || !Number.isInteger(count) || count < 1) return null;

  const isWeeks = /^w/i.test(match[2]!);
  const days = isWeeks ? count * 7 : count;

  const within = findMonthRange(
    // Strip the length so the month matcher does not read "2 weeks" as a day.
    text.replace(match[0], " "),
    ctx.today,
  );
  if (!within) return null;

  const span = daysBetween(within.range.start, within.range.end);
  // Nothing to position if the span fills the period, and nothing sensible to
  // offer if it does not fit at all.
  if (days >= span) return null;

  const unit = isWeeks ? (count === 1 ? "week" : "weeks") : count === 1 ? "day" : "days";
  return {
    state,
    days,
    within: within.range,
    lengthLabel: `${count} ${unit}`,
  };
}

function daysBetween(start: string, end: string): number {
  const ms = Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
  return Math.round(ms / 86_400_000) + 1;
}
