import type { DeclaredAvailabilityState } from "@timeaway/shared";
import type { ExtractionContext, ExtractionResult } from "../types.js";
import { findMonthRange } from "./months.js";
import type { FoundPeriod } from "./periods.js";
import { findFuzzyPeriod, findRelativePeriod } from "./periods.js";
import { findChronoPeriod } from "./chrono.js";
import { findSubPeriod } from "./subperiods.js";

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

/** Notes from findSubPeriod — a reference already narrowed to part of a month. */
const SUB_PERIOD_NOTES = new Set([
  "first week",
  "second week",
  "third week",
  "last week",
  "first half",
  "second half",
  "early",
  "mid",
  "late",
  ...[1, 2, 3, 4, 5].flatMap((n) => [`first ${n} weeks`, `last ${n} weeks`]),
  // A two-ended chrono span states both edges outright ("dec 20th till jan
  // 2nd"), so the narrowing word it contains has already been honoured.
  "chrono range",
]);

/**
 * Qualifiers that narrow a period to part of it — "first two weeks of Nov",
 * "end of December", "mid-Sep". The month matcher would happily return the
 * whole month here, silently over-claiming someone's unavailability.
 *
 * findSubPeriod now resolves the common shapes exactly; this guard catches
 * what it could not place ("before the 20th", "from Nov onwards") and hands
 * those to the LLM instead.
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

/**
 * Open-ended availability — "free whenever", "anytime works".
 *
 * Note the collision with the wizard: answering "whenever" to *"how many
 * days?"* means "I don't know", but saying "free whenever" in chat means the
 * opposite — fully available. The two live in different code paths for
 * exactly this reason; this one only ever sees ambient conversation.
 */
const OPEN_ENDED =
  /\b(?:when ?ever|any ?time|any day|any dates?|all dates?|all good|flexible|no preference|dun ?mind|don'?t mind|up to (?:you|u|yall|the group))\b/i;

/**
 * Obligations that read as hard unavailability in this segment.
 *
 * National Service is the sharpest case and deserves its own vocabulary: an
 * NSman on mobilisation manning or in-camp training is not merely busy, he is
 * barred from leaving the country. Getting this wrong is worse than a normal
 * misread — the trip would be built around a date he legally cannot travel on.
 * "Mob manning" is written a dozen ways in chat ("mob mannin", "mobilisation
 * manning", "ops manning"), so all of them resolve here.
 */
const BLOCKING_COMMITMENT =
  /\b(?:reservist|ict|in ?camp|ns\b|ns ?duty|mob(?:ilisation|ilization)?[ -]?mann?in[g']?|ops? ?mann?in[g']?|mob ?ex|high[ -]?key|low[ -]?key|recall(?:ed)?|exam(?:s)?|wedding|work trip|bto|attachment)\b/i;

/**
 * No leave left at all — a zero cap, which is a hard constraint rather than an
 * absent one. "Burnt", "used up" and "habis" are how people actually say it.
 */
const EXHAUSTED_LEAVE =
  /\b(?:no|zero)\s+(?:more\s+)?(?:al|leave|annual leave)\b|\b(?:al|leave|annual leave)\b[^.]{0,24}\b(?:all used up|used up|used finish|finished|habis|gone|none left|no more)\b|\b(?:burnt|burned|used up|finished|cleared|habis)\b[^.]{0,24}\b(?:al|leave|annual leave)\b/i;

function stripParticles(text: string): string {
  return text.replace(PARTICLES, " ").replace(/\s+/g, " ").trim();
}

/**
 * "max 2 days leave", "only got 2 days AL", "2 day leave left".
 *
 * "AL" is the ordinary Singaporean word for annual leave, and it is usually
 * written *without* the unit — "got 12 AL", "still got 8 al", "AL left 6".
 * Requiring "days" meant the most natural phrasings were the ones that failed.
 */
function findLeaveCap(text: string): number | null {
  if (EXHAUSTED_LEAVE.test(text)) return 0;
  const patterns = [
    /\b(?:max(?:imum)?|only|just|got|left|have)\s+(\d{1,2})\s*(?:days?|d)\s*(?:of\s*)?(?:leave|al|annual leave|off)\b/i,
    /\b(\d{1,2})\s*(?:days?|d)\s*(?:of\s*)?(?:leave|al|annual leave)\s*(?:left|only|max)?\b/i,
    /\b(?:leave|al)\s*(?:only|left)?\s*(\d{1,2})\s*days?\b/i,
    // Bare unit: "12 al", "14 annual leave", "12 days al".
    /\b(\d{1,2})\s*(?:days?\s*)?(?:of\s+)?(?:al|annual leave)\b/i,
    // Reversed: "AL left 6", "my AL is 14", "AL balance 9". The connective is
    // required, not optional — "Al" is also a name, and a bare "Al 5" should
    // not silently become a five-day leave cap.
    /\b(?:al|annual leave)\s*(?:balance|left|remaining|only|is|:)\s*(\d{1,2})\b/i,
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

function shiftYears(period: FoundPeriod, years: number): FoundPeriod {
  const bump = (d: string) => `${Number(d.slice(0, 4)) + years}${d.slice(4)}`;
  return { ...period, range: { start: bump(period.range.start), end: bump(period.range.end) } };
}

/**
 * Resolve the date a message refers to, preferring an answer that lands
 * inside the trip's own window.
 *
 * Bare months are otherwise anchored to today: on a 2026 date, "december"
 * means Dec 2026 even when the group is planning across 2027, which silently
 * files the answer outside the trip. When a year shift lands inside the
 * horizon, that reading is almost certainly what was meant.
 */
function findDateReference(
  text: string,
  today: string,
  horizonStart?: string | null,
  horizonEnd?: string | null,
): FoundPeriod | null {
  const found =
    findFuzzyPeriod(text, today) ??
    findRelativePeriod(text, today) ??
    // Ahead of the whole-month matcher: "first 3 weeks of Jan" must narrow to
    // those days, not widen to all of January.
    findSubPeriod(text, today) ??
    findMonthRange(text, today) ??
    // Last stop before the LLM. Every Singapore-specific reading has already
    // had its turn, so this only sees the general shapes our grammar has no
    // opinion about — "dec 20th till jan 2nd", "3/11", "next fri to sun".
    findChronoPeriod(text, today);
  if (!found || !horizonStart || !horizonEnd) return found;

  const overlaps = (p: FoundPeriod) =>
    p.range.start <= horizonEnd && p.range.end >= horizonStart;
  if (overlaps(found)) return found;

  // An explicit year in the text is a deliberate statement — never override it.
  if (/\b20\d{2}\b/.test(text)) return found;

  for (const years of [1, 2]) {
    const shifted = shiftYears(found, years);
    if (overlaps(shifted)) return shifted;
  }
  return found;
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
  const dateRef = findDateReference(
    text,
    ctx.today,
    ctx.horizonStart,
    ctx.horizonEnd,
  );

  // "Free whenever" names no date but says a great deal: available across the
  // whole trip window.
  // "Anytime works" carries no separate positive word — the open-ended phrase
  // is itself the affirmation. Negation or uncertainty still veto it.
  if (
    !dateRef &&
    OPEN_ENDED.test(text) &&
    !NEGATIVE.test(text) &&
    !UNKNOWN.test(text)
  ) {
    if (!ctx.horizonStart || !ctx.horizonEnd) return null;
    return {
      relevant: true,
      subjectName: null,
      declarations: [
        { state: "AVAILABLE", start: ctx.horizonStart, end: ctx.horizonEnd },
      ],
      maxLeaveDays: leaveCap,
    };
  }

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

  // A narrowing qualifier means the matched period may be wider than what was
  // actually said. If findSubPeriod already resolved the narrower span, the
  // reference is exact and safe; otherwise decline rather than over-claim.
  const narrowed = SUB_PERIOD_NOTES.has(dateRef.note);
  if (!narrowed && SUB_PERIOD_QUALIFIER.test(text)) return null;

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
