import type { DeclaredAvailabilityState } from "@timeaway/shared";
import type { ExtractionContext, ExtractionResult } from "../types.js";
import { findMonthRange } from "./months.js";
import type { FoundPeriod } from "./periods.js";
import { findFuzzyPeriod, findRelativePeriod } from "./periods.js";

/**
 * Deterministic availability parsing for ambient group chat, tuned for how
 * Singaporeans in the 23–29 beachhead actually write: Singlish particles,
 * clipped forms, and local shorthand (AL = annual leave, ICT/reservist = NS
 * obligations, roster = shift schedule).
 *
 * Returns null when it will not claim the message — the caller then falls back
 * to the LLM. Declining is the safe outcome; a confident wrong parse silently
 * corrupts someone's availability (docs/DECISIONS.md).
 */

/** Trailing discourse particles carry no meaning for parsing. */
const PARTICLES =
  /\s*\b(?:lah|leh|lor|lorh|sia|meh|hor|hah|liao|already|sla|ah|ar|eh|ya|yah|man|bro|sis|guys?)\b\s*/gi;

/** Language whose meaning turns on a condition the grammar cannot model. */
const CONDITIONAL =
  /\b(?:if|unless|provided|as long as|depends on (?!my (?:roster|schedule|shift))|otherwise|but only|except|prefer|rather|maybe can|might be able)\b/i;

const NEGATIVE =
  /\b(?:cannot|can'?t|cant|cmi|cbb|no can do|not free|bo eng|not avail(?:able)?|unavailable|busy|got (?:plans|thing|something)|away|overseas?|out of town|clash(?:es|ing)?|no leave|out for|miss(?:ing)? this|skip)\b/i;

const POSITIVE =
  /\b(?:can(?:\s+make\s+it)?|free|avail(?:able)?|ok(?:ay)?|works? for me|fine (?:with|for) me|count me in|i'?m in|im in|on for|all good|no (?:prob(?:lem)?|issue)|sure|good for me|up for)\b/i;

/** Explicitly cannot forecast yet — distinct from silence (UNANSWERED). */
const UNKNOWN =
  /\b(?:roster(?! is out)|shift(?:s)? (?:not|nt)|not (?:out|released|confirmed|fixed|sure)|dunno|dun know|don'?t know|no idea|tbc|tbd|let (?:you|u|yall) know|lyk|confirm(?:ing)? later|pending|waiting (?:for|on)|not yet (?:confirm|out|sure))\b/i;

/**
 * Qualifiers that narrow a period to part of it — "first two weeks of Nov",
 * "end of December", "mid-Sep". The month matcher would happily return the
 * whole month here, silently over-claiming someone's unavailability, so the
 * grammar declines and lets the LLM resolve the narrower span instead.
 */
const SUB_PERIOD_QUALIFIER =
  /\b(?:first|last|early|earlier|mid|middle|late|later|beginning|start|end|half|before|after|until|till|from)\b|\b\d{1,2}\s*(?:weeks?|wks?)\b/i;

/**
 * "Only" flips the meaning: "can only join during school holidays" is a
 * restriction, not a plain availability. Dropping the word made the parser
 * mark that period AVAILABLE while leaving every other date UNANSWERED, so
 * the person was never excluded from dates they had just ruled out.
 */
const RESTRICTIVE = /\b(?:only|nothing but|just)\b/i;

/**
 * "Roster only out next week" names when they will *know*, not the dates
 * they are unsure about. Reading the date literally marked next week itself
 * UNKNOWN, which is about a different month entirely.
 */
const KNOWS_LATER =
  /\b(?:out|release[ds]?|released|confirm(?:ed)?|know|fixed|available)\b[^.]{0,20}\b(?:next|by|after|in|on)\b/i;

/** Obligations that read as hard unavailability in this segment. */
const BLOCKING_COMMITMENT =
  /\b(?:reservist|ict|in ?camp|ns\b|exam(?:s)?|wedding|work trip|bto|attachment)\b/i;

function stripParticles(text: string): string {
  return text.replace(PARTICLES, " ").replace(/\s+/g, " ").trim();
}

/** "max 2 days leave", "only got 2 days AL", "2 day leave left". */
function findLeaveCap(text: string): number | null {
  if (/\b(?:no|zero) (?:more )?(?:leave|al)\b/i.test(text)) return 0;
  const patterns = [
    /\b(?:max(?:imum)?|only|just|got|left|have)\s+(\d{1,2})\s*(?:days?|d)\s*(?:of\s*)?(?:leave|al|annual leave|off)\b/i,
    /\b(\d{1,2})\s*(?:days?|d)\s*(?:of\s*)?(?:leave|al|annual leave)\s*(?:left|only|max)?\b/i,
    /\b(?:leave|al)\s*(?:only|left)?\s*(\d{1,2})\s*days?\b/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) {
      const value = Number(match[1]);
      if (value >= 0 && value <= 60) return value;
    }
  }
  return null;
}

function findDateReference(text: string, today: string): FoundPeriod | null {
  return (
    findFuzzyPeriod(text, today) ??
    findRelativePeriod(text, today) ??
    findMonthRange(text, today)
  );
}

/**
 * Parse one chat message. Null means "not confident — escalate to the LLM".
 */
export function parseAvailabilityMessage(
  rawText: string,
  ctx: ExtractionContext,
): ExtractionResult | null {
  const text = stripParticles(rawText);
  if (text.length === 0) return null;

  // Anything conditional is the LLM's job, not the grammar's.
  if (CONDITIONAL.test(text)) return null;

  // Someone speaking for a third party needs identity resolution we don't do.
  if (/\b(?:he|she|they|his|her)\b/i.test(text)) return null;

  const leaveCap = findLeaveCap(text);
  const dateRef = findDateReference(text, ctx.today);

  // A leave cap stands alone — it constrains every window, not a date range.
  if (leaveCap !== null && !dateRef) {
    return {
      relevant: true,
      subjectName: null,
      declarations: [],
      maxLeaveDays: leaveCap,
    };
  }

  if (!dateRef) return null;

  // A narrowing qualifier means the matched period is wider than what was
  // actually said — decline rather than over-claim.
  if (SUB_PERIOD_QUALIFIER.test(text)) return null;

  const isUnknown = UNKNOWN.test(text);

  // Roster-pending with a "when I'll know" date: the uncertainty covers the
  // trip, not the date they mentioned. Without a horizon there is nothing
  // sensible to mark, so decline rather than guess.
  if (isUnknown && KNOWS_LATER.test(text)) {
    if (!ctx.horizonStart || !ctx.horizonEnd) return null;
    return {
      relevant: true,
      subjectName: null,
      declarations: [
        { state: "UNKNOWN", start: ctx.horizonStart, end: ctx.horizonEnd },
      ],
      maxLeaveDays: leaveCap,
    };
  }
  const isBlocked = BLOCKING_COMMITMENT.test(text);
  const isNegative = NEGATIVE.test(text);
  const isPositive = POSITIVE.test(text);

  let state: DeclaredAvailabilityState | null = null;
  if (isUnknown) state = "UNKNOWN";
  else if (isBlocked || isNegative) state = "UNAVAILABLE";
  else if (isPositive) state = "AVAILABLE";

  if (state === null) return null;

  // A restriction means everything else in the trip window is ruled out, so
  // the complement has to be stated too. Without a horizon the complement is
  // unbounded — decline instead of half-applying it.
  if (RESTRICTIVE.test(text) && state === "AVAILABLE") {
    if (!ctx.horizonStart || !ctx.horizonEnd) return null;
    const declarations: ExtractionResult["declarations"] = [];
    const from = dateRef.range.start > ctx.horizonStart ? dateRef.range.start : ctx.horizonStart;
    const to = dateRef.range.end < ctx.horizonEnd ? dateRef.range.end : ctx.horizonEnd;

    // Rule out the horizon first, then carve the stated window back in —
    // latest-declaration-wins makes the ordering do the work.
    declarations.push({
      state: "UNAVAILABLE",
      start: ctx.horizonStart,
      end: ctx.horizonEnd,
    });
    // Record the stated window as given, even when it falls outside the trip.
    // "I can only travel in June" against a November trip must still remember
    // *June*, so the group can weigh moving the dates.
    declarations.push({
      state: "AVAILABLE",
      start: dateRef.range.start,
      end: dateRef.range.end,
    });
    void from;
    void to;

    return { relevant: true, subjectName: null, declarations, maxLeaveDays: leaveCap };
  }

  // "cannot" and "can" both match the positive pattern's `can` — negation wins.
  if (isNegative && isPositive && !isUnknown) state = "UNAVAILABLE";

  return {
    relevant: true,
    subjectName: null,
    declarations: [
      { state, start: dateRef.range.start, end: dateRef.range.end },
    ],
    maxLeaveDays: leaveCap,
  };
}
