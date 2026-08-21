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

/**
 * A period that recurs several times a year, named without saying which one.
 *
 * "The school holidays" are public, which is why they were treated as
 * resolvable — but a teacher has four of them, and picking the year-end one
 * while ruling out the rest of the horizon is not a partial answer. It is a
 * wrong one, and it silently deletes the March and June windows she goes on to
 * name. Naming the instance ("the june school holidays") makes it resolvable
 * again.
 */
const RECURRING_PERIOD =
  /\b(?:school\s*hol\w*|term\s*break|semester\s*break|term\s*time|hols?)\b/i;

/**
 * Naming the instance rescues it: "school holidays in dec" is a period anyone
 * can look up, and the codebase already treats it as public. It is the bare
 * form that cannot be resolved — a teacher has four a year, and picking the
 * year-end one while ruling out the rest of the horizon deletes the March and
 * June windows she goes on to name.
 */
/**
 * Only the instance we actually hold. The period table has a single
 * school-holiday window — the year-end one — so naming December resolves and
 * naming anything else does not: "cmi during the march school hols" was being
 * recorded as 15 Nov – 31 Dec, the March holidays filed as the year-end ones.
 * Two stated readings that disagree are not resolved here by preferring one.
 */
const NAMES_INSTANCE = /\b(?:dec(?:ember)?|year[- ]?end)\b/i;

export function namesRecurringPeriod(text: string): boolean {
  return RECURRING_PERIOD.test(text) && !NAMES_INSTANCE.test(text);
}

export function namesOpaquePeriod(text: string): boolean {
  return (
    OPAQUE_REFERENT.test(text) ||
    PERSONAL_EVENT.test(text) ||
    namesRecurringPeriod(text)
  );
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
