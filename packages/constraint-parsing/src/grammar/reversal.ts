/**
 * Taking something back — "actually nvm", "can't do that anymore", "scratch
 * that", "cannot liao".
 *
 * This is the one thing the rest of the grammar structurally cannot do. Every
 * other parser turns a message into a *new* fact, and the engine's
 * latest-declaration-wins rule then settles conflicts by overlapping dates. A
 * bare retraction carries no date, so there is nothing to overlap and nothing
 * to overwrite: the withdrawn constraint just stays, silently wrong, and keeps
 * shaping the shortlist.
 *
 * Resolving *what* is being withdrawn is deliberately not done here — that
 * needs the speaker's own recent history, which lives in the database. This
 * function answers only "is this a retraction, and does it carry a replacement
 * fact?". Callers must run availability parsing first: "actually I can't do
 * 28-30 June" is a new declaration, not a bare retraction, and the ordinary
 * path already handles it correctly.
 */
import { MONTH_RE } from "./months.js";

export type Reversal = { kind: "BARE" };

/** Explicit undo language. */
const RETRACTION =
  /\b(?:n[ve]?vm|nvmd|never ?mind|scratch that|ignore (?:that|me|what i)|forget (?:that|it|what i)|disregard|cancel that|undo|retract|my bad|as you were)\b/i;

/**
 * The same verbs with a named object rather than a bare "that".
 *
 * People say what they are taking back — "scratch my march thing", "ignore my
 * nov" — and every pattern above required the literal word "that", so the
 * retraction was missed entirely. The message then fell through to the
 * trip-edit parser, which read the month in it as a request and pointed the
 * whole trip at the dates the speaker was in the middle of correcting.
 *
 * The object has to be a month or a word meaning "what I said". Without that
 * restriction "forget my passport" would read as a retraction.
 */
const RETRACTION_QUALIFIED = new RegExp(
  `\\b(?:scratch|retract|ignore|disregard|cancel|forget)\\s+(?:my|the|that|this)\\s+(?:\\w+\\s+){0,2}?` +
    `(?:${MONTH_RE}|thing|one|msg|message|dates?|entry|reply|answer|comment|earlier|previous)\\b`,
  "i",
);

/**
 * A change of plans, stated without naming what changed. "Anymore" and "liao"
 * are the tell: both mark a state that *used* to hold and no longer does.
 */
const NO_LONGER =
  /\b(?:(?:can'?t|cannot|cant|cmi|bo eng|not free|unavailable)\s+(?:\w+\s+){0,3}?(?:any ?more|no more|already|liao)|no longer (?:can|free|avail(?:able)?|able)|changed? (?:my )?mind|change of plans?|plans? (?:have )?changed|something came up|got something on)\b/i;

/**
 * "Actually" alone is not a retraction — "actually I'm free in Nov" is a plain
 * declaration. It only signals one when paired with a negation and no new
 * information, which the caller establishes by parsing availability first.
 */
const ACTUALLY_NEGATIVE =
  /\bactually\b[^.!?]{0,40}?\b(?:can'?t|cannot|cant|cmi|bo eng|not free|unavailable|no|nope|dun|don'?t)\b/i;

export function parseReversal(rawText: string): Reversal | null {
  const text = rawText.trim();
  if (!text) return null;
  if (
    RETRACTION.test(text) ||
    RETRACTION_QUALIFIED.test(text) ||
    NO_LONGER.test(text) ||
    ACTUALLY_NEGATIVE.test(text)
  ) {
    return { kind: "BARE" };
  }
  return null;
}
