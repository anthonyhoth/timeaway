/**
 * One thought, sent as two messages.
 *
 * People type the way they speak, in installments — a statement, then the
 * qualifier that was always part of it:
 *
 *     anthony:  i can do december
 *     anthony:  but only the first half
 *
 * Each parser sees one message at a time, so the second is a fragment with no
 * referent and is declined. The first has already been recorded *unqualified*,
 * which is the damaging half: the group now has December when the speaker
 * meant a fortnight of it, and nothing looks wrong.
 *
 * The fix reuses every parser rather than adding a new one — the two messages
 * are joined and re-read as the sentence they would have been. If that reading
 * succeeds, it replaces what the first message recorded; if it does not, the
 * fragment is left alone.
 *
 * Only the *same speaker* continues themselves, and only within a short
 * window: someone else's reply in between is a different turn, not a
 * continuation, and an hour later is a new thought.
 */

import type { ExtractedDeclaration } from "../types.js";
import { MONTH_RE } from "./months.js";

/**
 * Words that begin a continuation rather than a new statement. Not required —
 * "december" following "korea" is a continuation with no marker at all — but
 * their presence is what makes a bare fragment safe to attach.
 */
const CONTINUATION_MARKER =
  /^(?:but|and|or|also|though|although|actually|except|just|only|oh|oh ya|oh yeah|plus|as well|either|maybe|prefer(?:ably)?|ideally|specifically|i mean|well)\b/i;

/**
 * A fragment is short and carries no independent claim. The length cap is one
 * guard: a long message that failed to parse is not a fragment, it is something
 * we do not understand, and gluing it to the previous message would invent a
 * sentence nobody wrote.
 */
const MAX_FRAGMENT_WORDS = 8;

/**
 * What a qualifier is made of. A continuation of a dates statement is itself
 * about dates — that is the whole point of joining them — so a fragment
 * carrying none of this vocabulary cannot be one.
 *
 * The length cap alone used to be the entire test, which meant *any* message of
 * eight words or fewer attached to the sender's last dated statement. A replay
 * of three simulated group chats found "porridge or fishball" merged into a
 * reservist block, an aside about a flat flipping a whole month from AVAILABLE
 * to UNAVAILABLE, and "ya feb is aunties n pineapple tarts" widening one month
 * of leave into a full year. tryContinuation deletes the previous declarations
 * before writing the merged reading, so each of those rewrote what was said.
 */
const PERIOD_CONTENT = new RegExp(
  `\\b(?:${MONTH_RE}` +
    `|first|last|second|third|early|earlier|later?|mid|middle|half|rest` +
    `|week|weeks|weekend|weekends|weekday|weekdays|day|days|month|months|year` +
    `|onwards?|until|till|through|thru|before|after|from|start(?:ing)?|end(?:ing)?` +
    `|begin(?:ning)?|cny|ph|holidays?|weekdays?` +
    `|\\d{1,2}(?:st|nd|rd|th)?|\\d{4}-\\d{2}-\\d{2}` +
    `)\\b`,
  "i",
);

/**
 * Whether the fragment is *nothing but* a period — "december", "20-25 nov".
 * These continue a previous statement with no connective at all ("korea",
 * then "december"), which is why a marker cannot be required outright.
 */
/**
 * Filler that carries no content of its own, including hedges: "9-20 march i
 * think" is a bare period wearing a qualifier, and treating "think" as content
 * lost the narrowing the fragment existed to apply — the speaker's whole month
 * stayed blocked instead of only the fortnight of it.
 */
const CONNECTIVE_NOISE =
  /\b(?:the|a|an|in|on|at|of|for|is|are|i|im|i'm|can|ok|okay|lah|leh|lor|sia|ah|hor|only|just|also|too|as well|think|thk|guess|reckon|maybe|probably|prob|roughly|approx|about|abt|around|ya|yah|yeah|confirm|confirmed)\b/gi;

/**
 * A global twin of PERIOD_CONTENT, for stripping rather than testing. `.test()`
 * on a global regex carries `lastIndex` between calls and returns alternating
 * answers, so the two cannot be the same object — and `.replace()` with the
 * non-global one removed only the first match, which left "march" behind in
 * "9-20 march i think" and rejected a fragment that should have joined.
 */
const PERIOD_CONTENT_ALL = new RegExp(PERIOD_CONTENT.source, "gi");

function isBarePeriod(text: string): boolean {
  const residue = text
    .replace(PERIOD_CONTENT_ALL, " ")
    .replace(CONNECTIVE_NOISE, " ")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim();
  return residue.length === 0;
}

/**
 * A fragment earns the join by looking like one: it opens with a connective and
 * says something about time, or it is a bare period. Being short is necessary
 * and never sufficient.
 */
export function looksLikeContinuation(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.split(/\s+/).length > MAX_FRAGMENT_WORDS) return false;
  if (!PERIOD_CONTENT.test(trimmed)) return false;
  return hasContinuationMarker(trimmed) || isBarePeriod(trimmed);
}

/**
 * Join two messages into the sentence they were meant to be.
 *
 * A leading connective is kept — "i can do december" + "but only the first
 * half" reads correctly as one sentence — because the parsers already handle
 * "only" and "but" as the qualifiers they are.
 */
export function joinUtterances(previous: string, next: string): string {
  const first = previous.trim().replace(/[.,;!?]+$/, "");
  const second = next.trim();
  return `${first} ${second}`;
}

/** Whether the follow-up opens with an explicit continuation word. */
export function hasContinuationMarker(text: string): boolean {
  return CONTINUATION_MARKER.test(text.trim());
}

/**
 * Did joining actually change the reading?
 *
 * `tryContinuation` deletes the previous declarations and rewrites them from the
 * joined text. When the join reproduces exactly what was already recorded, the
 * fragment contributed nothing — it was not understood — and absorbing it
 * discards whatever it did say. "ICT 9-20 mar" followed by "12-19 can" rewrote
 * 9–20 March with itself and lost the window being offered; a smell for this
 * found eight of them across four corpora, three in chats that had already been
 * through three rounds of fixes.
 *
 * A fragment that changes nothing should fall through to the LLM, which is what
 * happens to every other message the grammar cannot read.
 */
export function sameReading(
  before: readonly ExtractedDeclaration[],
  after: readonly ExtractedDeclaration[],
): boolean {
  if (before.length !== after.length) return false;
  return before.every((d, i) => {
    const other = after[i]!;
    return d.state === other.state && d.start === other.start && d.end === other.end;
  });
}
