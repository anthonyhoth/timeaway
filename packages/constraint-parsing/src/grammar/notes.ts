/**
 * Opinions that matter to the group but aren't scheduling constraints:
 * "I just went Korea, don't want to go again", "budget's tight for me",
 * "I want to go Seoul".
 *
 * These are recorded and shown, never acted on. A disagreement about *where*
 * must not void a trip that is perfectly workable on *dates* — the engine
 * keeps computing, and the group decides what to do with the objection.
 *
 * The line against a destination edit is **first person**. "Drop Japan" is a
 * decision about the plan; "I don't want to go to Japan again" is one
 * person's view, and only the group can turn that into a change.
 */
export type NoteKind =
  | "DESTINATION_OBJECTION"
  | "DESTINATION_PREFERENCE"
  | "BUDGET";

/** First-person framing marks an opinion rather than an instruction. */
const FIRST_PERSON =
  /\b(?:i|i'?m|im|me|my|myself|idw|id|i'?d)\b/i;

const OBJECTION =
  /\b(?:don'?t want|dont want|idw|would rather not|'?d rather not|not keen|rather not|sick of|bored of|just (?:went|came back|did|was)|been there|already been|again)\b/i;

const PREFERENCE =
  /\b(?:want to go|wanna go|would like|'?d like|prefer|'?d prefer|hoping for|vote for|keen on|keen for|push for)\b/i;

const BUDGET_WORDS =
  /\b(?:budget|expensive|pricey|costly|afford|affordable|cheap(?:er)?|broke|too much|save (?:up|money)|money(?:'s)? tight|tight on (?:cash|money|budget))\b/i;

// Amounts are matched without a trailing word boundary: "\b" after "\d"
// fails on any multi-digit figure, so "under 1500" silently didn't match.
const BUDGET_AMOUNT = /(?:\$\s?\d+|\b(?:under|below|within|max)\s+\$?\d+)/i;

const BUDGET = {
  test: (text: string) => BUDGET_WORDS.test(text) || BUDGET_AMOUNT.test(text),
};

export interface ParticipantNote {
  kind: NoteKind;
  /** Their own words, kept verbatim for the card and for auditability. */
  text: string;
}

export function parseParticipantNote(rawText: string): ParticipantNote | null {
  const text = rawText.trim();
  if (!text) return null;

  // Budget talk is personal by nature and needs no first-person marker —
  // "too expensive" from anyone is worth recording.
  if (BUDGET.test(text)) return { kind: "BUDGET", text };

  if (!FIRST_PERSON.test(text)) return null;

  if (OBJECTION.test(text)) return { kind: "DESTINATION_OBJECTION", text };
  if (PREFERENCE.test(text)) return { kind: "DESTINATION_PREFERENCE", text };
  return null;
}
