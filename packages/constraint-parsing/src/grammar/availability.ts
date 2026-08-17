import type { DeclaredAvailabilityState } from "@timeaway/shared";
import type { ExtractionContext, ExtractionResult } from "../types.js";
import { findMonthRange } from "./months.js";
import type { FoundPeriod } from "./periods.js";
import { findFuzzyPeriod, findRelativePeriod } from "./periods.js";
import { findChronoPeriod } from "./chrono.js";
import { parseMultiSpan } from "./multi-span.js";
import { namesLengthWithinPeriod } from "./span-shape.js";
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
 * Resolve a date reference by **specificity, not by parser order**.
 *
 * The chain used to be a plain `??` cascade, so whichever parser ran first won
 * — and the broadest parser ran first. "next year dec" matched "next year" and
 * returned the whole of 2027, never looking at "dec"; "next month first week"
 * returned all of September. In both the two readings are not rivals at all:
 * the broad one says *which year or month* and the narrow one says *where
 * inside it*.
 *
 * So a broad match is treated as **context** rather than an answer. It supplies
 * the year (and, when it is itself a single month, the month) to the narrower
 * parsers, and is used as the answer only when nothing narrower is found.
 *
 * The narrower reading must fall **inside** the broad one to win. "next week
 * nov" is contradictory rather than nested, and there the stated scope stands
 * — preferring the fragment would be inventing a resolution to a conflict the
 * speaker will have to settle anyway.
 */
function resolveBySpecificity(text: string, today: string): FoundPeriod | null {
  const scope = findFuzzyPeriod(text, today) ?? findRelativePeriod(text, today);

  const yearHint = scope ? Number(scope.range.start.slice(0, 4)) : undefined;
  // Only a single month can host a "first week" — a whole year cannot.
  const within =
    scope && scope.range.start.slice(0, 7) === scope.range.end.slice(0, 7)
      ? scope.range
      : undefined;

  const narrower =
    // Ahead of the whole-month matcher: "first 3 weeks of Jan" must narrow to
    // those days, not widen to all of January.
    findSubPeriod(text, today, yearHint, within) ??
    findMonthRange(text, today, yearHint);

  if (!scope) {
    // Last stop before the LLM, and only when nothing else read the message.
    // Chrono is eager: it reads "next week" as a single day, which is nested
    // inside the correct week and would otherwise win the specificity test by
    // being wrong in the right direction.
    return narrower ?? findChronoPeriod(text, today);
  }
  if (!narrower) return scope;
  if (!narrower) return scope;

  const nested =
    narrower.range.start >= scope.range.start &&
    narrower.range.end <= scope.range.end;
  return nested ? narrower : scope;
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
  const found = resolveBySpecificity(text, today);
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
 * The year the group is planning in, so a bare month in a multi-span list
 * lands inside the trip rather than against today.
 */
function yearHintFor(ctx: ExtractionContext): number | undefined {
  return ctx.horizonStart ? Number(ctx.horizonStart.slice(0, 4)) : undefined;
}

/**
 * Is this message about a constraint on *the speaker*?
 *
 * Broader than `ABOUT_THEMSELVES` in trip-edit, which needed a pronoun sitting
 * next to an availability word. Real obligations rarely look like that, and
 * every one of these was being read as a request to **move the trip to the
 * dates being blocked out**:
 *
 *   "renovation starting dec i very tied up"   → move the trip to December
 *   "blackout period nov to jan for my dept"   → make the trip Nov–Jan
 *   "working shift dec 1 to 7"                 → make the trip those 7 days
 *   "just started new job cannot take leave until dec" → move it to December
 *
 * The last is the sharpest: December is the first month they *can* travel, and
 * the trip was being pointed at the one month they had ruled out.
 *
 * Used as a veto, not a claim: a message about the speaker is never a change to
 * the group's plan, whatever dates it happens to mention.
 */
export function statesPersonalConstraint(rawText: string): boolean {
  const text = stripParticles(rawText);
  return (
    NEGATIVE.test(text) ||
    BLOCKING_COMMITMENT.test(text) ||
    OBLIGATION.test(text) ||
    OBJECTION.test(text)
  );
}

/**
 * Work and life commitments that block travel without using the word "can't":
 * a roster, a leave freeze, a renovation, a posting.
 */
const OBLIGATION =
  /\b(?:tied up|blackout|black out|on shift|night shift|shift work|working|work(?:ing)? on|on duty|on call|oncall|standby|stand by|probation|posted|renovation|reno|moving house|confinement|got stuff|got things|busy period|peak period|year end closing|audit|deadline|apply(?:ing)? (?:for )?(?:al|leave)|applied (?:for )?(?:al|leave)|take leave|taking leave|broke|no money|no budget|retract)\b/i;

/**
 * Arguing against a period rather than proposing one. "Nov too rainy" was
 * being read as a request to move the trip *to* November.
 */
const OBJECTION =
  /\b(?:disagree|too (?:rainy|hot|cold|wet|crowded|peak|ex|expensive|pricey|far|short|long)|rainy season|monsoon|peak season|not keen|sian)\b/i;

/**
 * Which way a message leans, with no date attached.
 *
 * Exported so the underspecified-span path can reuse exactly this reading:
 * "not free 2 weeks in Nov" and "free 2 weeks in Nov" ask the same question but
 * record opposite answers, and a second copy of this logic would drift.
 */
export function messageIntent(
  rawText: string,
): DeclaredAvailabilityState | null {
  const text = stripParticles(rawText);
  if (UNKNOWN.test(text)) return "UNKNOWN";
  const negative = NEGATIVE.test(text) || BLOCKING_COMMITMENT.test(text);
  const positive = POSITIVE.test(text);
  // Negation wins when both appear — "can't make it" contains "can".
  if (negative) return "UNAVAILABLE";
  if (positive) return "AVAILABLE";
  return null;
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

  // "a week in Dec" names how long but not when, so the month matcher's answer
  // is the whole of December — thirty-one days claimed from a statement about
  // seven. Decline; the caller asks which week instead.
  if (namesLengthWithinPeriod(text)) return null;

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

  // Several periods in one message — "oct last 2 weeks, nov 1st week and last
  // week and dec 3rd week". Taking only the first and acknowledging the whole
  // message was the worst of both: the speaker saw it land, and four fifths of
  // it had not. Restrictions and roster-pending stay on the single-reference
  // path below, which knows how to complement and how to hedge.
  if (!RESTRICTIVE.test(text) && !isUnknown) {
    const spans = parseMultiSpan(text, ctx.today, yearHintFor(ctx));
    if (spans) {
      // Captured so the narrowing survives into the closure below.
      const settled = state;
      return {
        relevant: true,
        subjectName: null,
        declarations: spans.map((range) => ({
          state: settled,
          start: range.start,
          end: range.end,
        })),
        maxLeaveDays: leaveCap,
      };
    }
  }

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
