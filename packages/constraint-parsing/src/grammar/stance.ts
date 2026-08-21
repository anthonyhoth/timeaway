/**
 * Whose statement is this, and is it a claim at all?
 *
 * Two questions that every layer of the pipeline needs and none of them owns.
 * They lived in whichever parser last had a bug: the rejection rule went into
 * `parseTripEdit`, the third-party rule into `availability`, and each was
 * invisible to the other. Since availability is parsed *first*, a rejection fix
 * that only trip-edit knew about did not remove the defect — it moved it. "Ok
 * sept dead" stopped pointing the trip at September and started recording the
 * speaker as free for all of it.
 *
 * This is the fourth time this repo has split one rule across two lists that
 * were supposed to agree (see the header of prefilter.ts). Answering both
 * questions in one place, consulted by everyone, is the point of this module.
 */

import { MONTH_RE } from "./months.js";

/**
 * Discourse particles carry no meaning for any parser, and every one of them
 * can sit between a date and the word that qualifies it. Shared rather than
 * redefined because the stance rules below and the availability grammar have
 * to agree on what a sentence says once the noise is gone.
 */
const PARTICLES =
  /\s*\b(?:lah|leh|lor|lorh|sia|meh|hor|hah|liao|already|sla|ah|ar|eh|ya|yah|man|bro|sis|guys?)\b\s*/gi;

export function stripParticles(text: string): string {
  return text.replace(PARTICLES, " ").replace(/\s+/g, " ").trim();
}

/** A date range written any of the ways people write one, plus a month. */
const RANGE = String.raw`\d{1,2}(?:\/\d{1,2})?\s*(?:-|–|—|to)\s*\d{1,2}(?:\/\d{1,2})?`;

/**
 * Words that take a period *off the table for the group*.
 *
 * Deliberately narrow. "Cmi", "cannot" and "jialat" sit beside a month just as
 * often and mean something entirely different — one person is busy, which is a
 * declaration worth recording, not a rejection to discard. Collapsing the two
 * would silently delete real availability, so the personal vocabulary stays in
 * availability.ts's NEGATIVE where it belongs.
 */
const GROUP_REJECTION =
  String.raw`out|dead|die|died|gone|cancelled|canceled|scrapped|scrap|no good|off the table|write off`;

/**
 * A period named in order to rule it out — "so nov out?", "ok sept dead",
 * "but not 3-9 nov".
 *
 * Both directions are covered: a negator before the period, or a rejection word
 * after it. The range form matters as much as the month form — "not 3-9 nov"
 * puts the month after the numbers, which is why the first version of this rule
 * missed it and pointed the trip at the speaker's in-camp week.
 */
const REJECTS_PERIOD = new RegExp(
  // "not nov", "no 3-9 nov", "not 12-15 dec"
  String.raw`\b(?:not|no)\s+(?:${RANGE}\s*)?(?:${MONTH_RE})\b` +
    String.raw`|\b(?:not|no)\s+(?:${RANGE})\b` +
    // "nov out", "sept also dead", "feb is gone"
    String.raw`|\b(?:${MONTH_RE})\b[^.!?]{0,24}?\b(?:${GROUP_REJECTION})\b` +
    String.raw`|\b(?:${RANGE})\s*(?:${MONTH_RE})?\b[^.!?]{0,16}?\b(?:${GROUP_REJECTION})\b`,
  "i",
);

export function rejectsNamedPeriod(rawText: string): boolean {
  return REJECTS_PERIOD.test(stripParticles(rawText));
}

/**
 * Someone relaying a constraint that belongs to a person who is not speaking.
 *
 * Identity resolution does not exist yet, so these are refused rather than
 * guessed at — but only the availability path was refusing them, and the same
 * sentence reached the trip through `parseTripEdit` instead.
 */
const THIRD_PARTY_REPORTED =
  /\b(?:asked if|says? (?:he|she|they)|said (?:he|she|they))\b|\b(?:he|she|they)\s+(?:can(?:'?t|not)?|cannot|only|says?|said|wants?|needs?|prefers?|will|would|might|got|has|have)\b/i;

/**
 * The possessive form — "my gf can only do weekends".
 *
 * Family are deliberately absent. "My sister getting married in june" and "my
 * mom operation in feb" are the *speaker's* blockers — they have to be there —
 * and refusing those would throw away exactly the obligations this market is
 * full of. The people listed here are ones who might join the trip and speak
 * for themselves, which is what makes their dates unresolvable.
 */
const THIRD_PARTY_POSSESSIVE =
  /\bmy\s+(?:gf|bf|girlfriend|boyfriend|wife|husband|partner|colleague|classmate|friend|cousin)\s+(?:can(?:'?t|not)?|cannot|only|will|would|prefers?|wants?|needs?)\b/i;

export function statesThirdPartyConstraint(rawText: string): boolean {
  const text = stripParticles(rawText);
  return THIRD_PARTY_REPORTED.test(text) || THIRD_PARTY_POSSESSIVE.test(text);
}
