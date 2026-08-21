import type { DeclaredAvailabilityState } from "@timeaway/shared";
import type { ExtractionContext, ExtractionResult } from "../types.js";
import { namesClosedRange, widenOpenEndedFloor } from "./date-shape.js";
import { MONTH_RE, findMonthRange } from "./months.js";
import type { FoundPeriod } from "./periods.js";
import { findFuzzyPeriod, findRelativePeriod } from "./periods.js";
import { findChronoPeriod } from "./chrono.js";
import { parseMultiSpan } from "./multi-span.js";
import { namesOpaquePeriod } from "./opaque.js";
import { namesKnownDestination } from "./proposals.js";
import { namesLengthWithinPeriod } from "./span-shape.js";
import {
  rejectsNamedPeriod,
  statesThirdPartyConstraint,
  stripParticles,
} from "./stance.js";
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

/** Language whose meaning turns on a condition the grammar cannot model. */
const CONDITIONAL =
  /\b(?:if|unless|provided|as long as|depends on (?!my (?:roster|schedule|shift))|otherwise|but only|except|prefer|rather|maybe can|might be able)\b/i;

/**
 * Hokkien-derived negation is standard here: "buay" (cannot), "bo" (not have),
 * "buay tahan" (cannot stand it), "jialat" (in trouble). All were declining.
 */
const NEGATIVE =
  /\b(?:cannot|can'?t|cant|cmi|cbb|no can do|not free|bo eng|bo hong|buay|bway|buay tahan|jialat|not avail(?:able)?|unavailable|busy|got (?:plans|thing|something)|away|overseas?|out of town|clash(?:es|ing)?|no leave|out for|miss(?:ing)? this|skip|pang seh|siao ah)\b/i;

/**
 * Agreement in Singapore English is short and often carries no verb at all —
 * "steady", "on lah", "okok". These were declining while their standard-English
 * equivalents parsed.
 */
const POSITIVE =
  /\b(?:can(?:\s+make\s+it)?|free|avail(?:able)?|ok(?:ay|ok)?|works? for me|fine (?:with|for) me|fine lah|count me in|i'?m in|im in|on for|all good|no (?:prob(?:lem)?|issue)|sure|good for me|up for|steady|shiok|game|chill|fine|jio me|no issue|why not|will try|try to make|idm|dun mind|don'?t mind|no preference|fine by me|either can|both can)\b|(?:i'?m|im|i)\s+on\b|\bon\s*$/i;

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
  // Same reasoning for a written-out range: "mid yr exam 10-21 may" gives both
  // edges, and the "mid" belongs to the exam rather than to the dates. Without
  // this the message was declined outright once the qualifier stopped being
  // allowed to move them.
  "explicit day range",
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
 *
 * It has to *govern the date* to mean that. Matched as a bare word anywhere in
 * the message, it ruled out the entire horizon on the strength of an unrelated
 * clause: "now go also just sit in cafe" — where "just" means merely — blocked
 * out nine months, and "23/2-28/2 is 6 days, i can only do 5 remember" applied
 * the exclusive reading to a range the "only" had nothing to do with, since
 * there the word governs a headcount of leave days.
 */
const RESTRICTED_TARGET =
  `(?:${MONTH_RE}` +
  String.raw`|\d{1,2}\s*[/-]\s*\d{1,2}` +
  String.raw`|\d{1,2}(?:st|nd|rd|th)` +
  String.raw`|during|school\s*hol\w*|holidays?|hols?|closure|shutdown|break` +
  String.raw`|weekends?|weekdays?|term\s*break|long\s*weekend` +
  ")";
const RESTRICTIVE = new RegExp(
  String.raw`\b(?:only|just|nothing but)\b(?:\s+\S+){0,3}?\s+` + RESTRICTED_TARGET,
  "i",
);

/**
 * "Roster only out next week" names when they will *know*, not the dates
 * they are unsure about. Reading the date literally marked next week itself
 * UNKNOWN, which is about a different month entirely.
 */
const KNOWS_LATER =
  /\b(?:out|release[ds]?|released|confirm(?:ed)?|know|fixed|available)\b[^.]{0,20}\b(?:next|by|after|in|on)\b/i;

/**
 * Particles that make an utterance a *question* rather than an assertion.
 *
 * Singapore English carries in particles what spoken English carries in
 * intonation (Gupta; Lim), and the assertive and interrogative sets look
 * identical to a matcher that only sees "can". "Can lah" asserts; "can meh"
 * challenges the very possibility. Both were being recorded as the speaker
 * declaring themselves free.
 *
 *   meh      — challenges a presupposition. "Can meh?" doubts that it can.
 *   hor      — seeks agreement. "Can hor?" is a tag question, not a claim.
 *   bo       — Hokkien 無, the "or not" of an alternative question.
 *   or not   — the same, in English.
 *   izzit    — tag question.
 *   ah + ?   — interrogative when it closes a question.
 *
 * "Nov cannot meh" is the sharpest: it argues that November *is* possible, and
 * was being recorded as the speaker blocking November out — the opposite of
 * what they said.
 *
 * Asking the group a question is not answering it, so these decline. The
 * question is still a real signal, but it belongs to whoever answers.
 */
const INTERROGATIVE_PARTICLE =
  /\b(?:meh|bo|izzit|is ?it|or not|or nt)\s*\??\s*$|\bhor\s*\??\s*$|\bah\s*\?\s*$|\?\s*$/i;

/**
 * Hedged positives. "Should be can" and "probably can" are agreements with the
 * commitment removed, and recording them as a firm yes is how a group ends up
 * with a date half of them never actually agreed to.
 */
const HEDGED_POSITIVE =
  /\b(?:should be|probably|most likely|likely|i think can|think can|quite sure|fairly sure|shd be|prob|maybe|might|possibly|try(?:ing)? to|will try|see how)\b/i;

/**
 * Open-ended availability — "free whenever", "anytime works".
 *
 * Note the collision with the wizard: answering "whenever" to *"how many
 * days?"* means "I don't know", but saying "free whenever" in chat means the
 * opposite — fully available. The two live in different code paths for
 * exactly this reason; this one only ever sees ambient conversation.
 */
const OPEN_ENDED =
  /\b(?:when ?ever|any ?time|any day|any dates?|all dates?|all good|flexible|no preference|idm|dun ?mind|don'?t mind|up to (?:you|u|yall|the group)|chin chai|anything (?:also )?can|any(?:thing)? can)\b/i;

/**
 * "I don't mind" with something after it is about *that thing*, not about the
 * calendar.
 *
 * Bare, it means fully flexible — the open-ended reading below is right. Given
 * an object it is assent to whatever was named, and "i dont mind japan" was
 * being recorded as **available across the entire horizon**: nine months of
 * availability inferred from a remark about a destination.
 *
 * Particles are not objects. "I dun mind lah" is still the bare form.
 */
const MIND_HAS_OBJECT =
  /\b(?:idm|i\s*dun\s*mind|i\s*don'?t\s*mind|dun\s*mind|don'?t\s*mind|no preference (?:for|on))\s+(?!lah\b|leh\b|lor\b|sia\b|ah\b|one\b|really\b|actually\b|too\b|also\b)\S/i;

/**
 * Bare assent — and only bare assent — means "any dates at all".
 *
 * MIND_HAS_OBJECT catches the object sitting *after* the phrase ("idm japan").
 * A second replay found it in front of it ("taiwan i dun mind"), behind a word
 * its own lookahead excused ("idm either"), and trailing a sentence about
 * something else entirely ("3 days i can unpaid also, idm") — each one booking
 * nine months of availability from a remark about a destination or a leave
 * figure.
 *
 * Rather than chase word order, ask what else is in the message: a place or a
 * number means the assent is about that, not about the calendar.
 */
const AMBIGUOUS_ASSENT =
  /\b(?:idm|dun ?mind|don'?t mind|chin ?chai|anything (?:also )?can|any(?:thing)? can|up to (?:you|u|yall|the group)|no preference)\b/i;

function assentIsBare(text: string): boolean {
  // "Anytime", "whenever", "flexible" can only be about the calendar, so they
  // stand however much else is in the message: "got 12 days leave, anytime
  // works" is a leave cap *and* full availability, and requiring bareness of it
  // would drop the availability on account of the "12".
  if (!AMBIGUOUS_ASSENT.test(text)) return true;
  if (/\d/.test(text)) return false;
  return !namesKnownDestination(text);
}

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
    // A ceiling stated without the word "leave" anywhere — "i can only take 5
    // days max at one go". This is how a cap usually reaches the chat, and
    // matching nothing here meant it fell through to parseTripEdit, which read
    // it as the *trip's* length and capped it for all six travellers.
    /\b(?:can|able to)?\s*(?:only|just)\s+take\s+(\d{1,2})\s*days?\b/i,
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
    //
    // Unless the speaker already gave both ends. "Mid yr exam 10-21 may" is a
    // range with a qualifier belonging to a different noun, and applying it
    // trimmed a day off each side of dates that were stated exactly.
    (namesClosedRange(text)
      ? null
      : findSubPeriod(text, today, yearHint, within)) ??
    findMonthRange(text, today, yearHint);

  if (!scope) {
    // Last stop before the LLM, and only when nothing else read the message.
    // Chrono is eager: it reads "next week" as a single day, which is nested
    // inside the correct week and would otherwise win the specificity test by
    // being wrong in the right direction.
    return narrower ?? findChronoPeriod(text, today);
  }
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
  const raw = resolveBySpecificity(text, today);
  // "Dec 12 onwards" names a floor, not the 12th.
  const found = raw
    ? { ...raw, range: widenOpenEndedFloor(raw.range, text) }
    : raw;
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
  // The bare-pronoun check stays as the wide net; the shared rule adds the
  // possessive form ("my gf can only do weekends") that it never caught.
  if (/\b(?:he|she|they|his|her)\b/i.test(text)) return null;
  if (statesThirdPartyConstraint(text)) return null;

  // A period the *group* has ruled out is nobody's availability. Without this,
  // a leading "ok" made messageIntent positive and "ok sept dead" recorded the
  // speaker as free for the whole of the month just killed. Personal refusals
  // ("dec cannot", "feb cmi") are deliberately not rejections — they are
  // declarations, and NEGATIVE below still reads them as UNAVAILABLE.
  if (rejectsNamedPeriod(text)) return null;

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
    !MIND_HAS_OBJECT.test(text) &&
    assentIsBare(text) &&
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

  // Asking is not answering. A question about a date belongs to whoever
  // replies to it, not to the person who raised it.
  if (INTERROGATIVE_PARTICLE.test(rawText.trim())) return null;

  let state: DeclaredAvailabilityState | null = null;
  if (isUnknown) state = "UNKNOWN";
  else if (isBlocked || isNegative) state = "UNAVAILABLE";
  else if (isPositive) {
    // A hedge is an agreement with the commitment taken out. MAYBE keeps the
    // signal without letting it count as a yes the group can plan around.
    state = HEDGED_POSITIVE.test(text) ? "MAYBE" : "AVAILABLE";
  }

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

    // "Only during my dec company closure" names December as the *anchor*, not
    // the permitted window: the closure might be five days of it. Marking the
    // month AVAILABLE handed the group thirty-one days nobody offered. The
    // complement is still certain and still worth recording — everything
    // outside is ruled out — but inside, the honest state is UNKNOWN, which is
    // the same thing a roster-pending nurse gets and reads the same on the card.
    const opaque = namesOpaquePeriod(text);

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
      state: opaque ? "UNKNOWN" : "AVAILABLE",
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
