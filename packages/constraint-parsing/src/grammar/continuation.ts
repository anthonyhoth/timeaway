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

/**
 * Words that begin a continuation rather than a new statement. Not required —
 * "december" following "korea" is a continuation with no marker at all — but
 * their presence is what makes a bare fragment safe to attach.
 */
const CONTINUATION_MARKER =
  /^(?:but|and|or|also|though|although|actually|except|just|only|oh|oh ya|oh yeah|plus|as well|either|maybe|prefer(?:ably)?|ideally|specifically|i mean|well)\b/i;

/**
 * A fragment is short and carries no independent claim. The length cap is the
 * real guard: a long message that failed to parse is not a fragment, it is
 * something we do not understand, and gluing it to the previous message would
 * invent a sentence nobody wrote.
 */
const MAX_FRAGMENT_WORDS = 8;

export function looksLikeContinuation(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const words = trimmed.split(/\s+/);
  if (words.length > MAX_FRAGMENT_WORDS) return false;
  return true;
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
