/**
 * References only the speaker can resolve.
 *
 * "I can only go during my dec company closure" names a real, precise period —
 * and nothing outside that person's head can say when it is. Neither can the
 * LLM: the dates are not in the message, not in the chat, and not in the world
 * the model was trained on. Escalating costs a call and returns nothing.
 *
 * This is a third kind of parse failure, and it needs its own answer:
 *
 *   1. unfamiliar wording          → the LLM might genuinely help
 *   2. a value missing from the message but derivable ("2 weeks in Nov")
 *                                  → compute the options and ask
 *   3. a value only the speaker holds ("my company closure")
 *                                  → ask *them*, and never call the LLM
 *
 * The damage from treating (3) as (1) is not the wasted call. It is that the
 * surrounding grammar still fires: "only ... dec" was recorded as *available
 * all December*, turning a five-day closure into a month the group could plan
 * around.
 */

/**
 * A possessive followed by a personal event. The possessive is what makes it
 * opaque — "the school holidays" are public, "my block leave" is not.
 */
const OPAQUE_REFERENT =
  /\b(?:my|our|his|her|their|hubby'?s?|wife'?s?|gf'?s?|bf'?s?)\s+(?:\w+\s+){0,2}?(?:company|office|work|firm)?\s*(?:closure|shutdown|shut down|block leave|company leave|forced leave|plant shutdown|roster|shift|schedule|posting|attachment|ord|bto|appointment|reservist|ict|in-?camp|exams?|graduation|convocation|confinement|maternity|paternity|wedding|rom|honeymoon|mc|surgery|op|clearance|handover|notice period|probation|audit|peak period|busy period|closing|stocktake)\b/i;

/** The same events named without a possessive, which read as personal anyway. */
const PERSONAL_EVENT =
  /\b(?:company (?:closure|shutdown|leave)|office (?:closure|shutdown)|block leave|forced leave|shut ?down period|clearance leave|notice period)\b/i;

export function namesOpaquePeriod(text: string): boolean {
  return OPAQUE_REFERENT.test(text) || PERSONAL_EVENT.test(text);
}

/**
 * What to ask, phrased so the answer is a date range rather than a story.
 * Kept here beside the vocabulary so the two cannot drift.
 */
export function opaqueReferentLabel(text: string): string {
  const match =
    /\b(company (?:closure|shutdown|leave)|office (?:closure|shutdown)|block leave|forced leave|clearance leave|notice period|shut ?down period)\b/i.exec(
      text,
    ) ?? /\b(?:my|our)\s+([a-z]+(?:\s+[a-z]+)?)\b/i.exec(text);
  return (match?.[1] ?? "that").toLowerCase();
}
