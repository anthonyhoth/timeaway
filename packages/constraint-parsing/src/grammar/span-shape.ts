/**
 * The shape "a length, somewhere inside a period" — "2 weeks in Nov",
 * "a week in Dec", "3 days sometime in Jan".
 *
 * Lives on its own because two parsers need exactly the same definition and
 * must not drift: the availability grammar uses it to *decline* (the position
 * is missing, so claiming the whole month would over-claim), and the
 * underspecified-span parser uses it to *ask*. Importing one from the other
 * would make a cycle, and two copies would eventually disagree about which
 * messages are ambiguous.
 */
export const LENGTH_IN_PERIOD =
  /\b(?:(\d{1,2})|a|an|one|two|three|four|couple(?: of)?)\s*(weeks?|wks?|days?)\s+(?:in|of|during|sometime\s+in|somewhere\s+in|around)\b/i;

/** Anything that already says *where* in the period the span sits. */
export const ALREADY_POSITIONED =
  /\b(?:first|last|final|second|third|1st|2nd|3rd|early|mid|middle|late|beginning|start|end|half)\b/i;

/**
 * True when the text names how long but not when.
 *
 * Note what this deliberately does not match: "got 5 days leave" has no
 * period after it, so a leave cap stated alongside plain availability
 * ("12 days leave, anytime works") is untouched.
 */
export function namesLengthWithinPeriod(text: string): boolean {
  return !ALREADY_POSITIONED.test(text) && LENGTH_IN_PERIOD.test(text);
}
