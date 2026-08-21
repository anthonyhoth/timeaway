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

/**
 * "Again" used to sit here on its own, which read willingness as its opposite:
 * "i dun mind going again actually, bali damn relaxing" was recorded as an
 * objection to Bali. Every genuine use of it is already covered by the framing
 * around it — "don't want ... again", "been there", "just went" — so it only
 * needs the negated form.
 */
const OBJECTION =
  /\b(?:don'?t want|dont want|idw|would rather not|'?d rather not|not keen|rather not|sick of|bored of|just (?:went|came back|did|was)|been there|already been|not again|no more)\b/i;

/**
 * Assent, not objection. "Dun mind" and "idm" are how agreement is written
 * here, and they carry none of the vocabulary above — but they routinely share
 * a sentence with a place name, so an objection pattern that fires loosely
 * lands on exactly the wrong reading.
 */
const ASSENT = /\b(?:idm|dun ?mind|don'?t mind|chin ?chai|anything (?:also )?can|up to (?:you|u|yall|y'all))\b/i;

const PREFERENCE =
  /\b(?:want to go|wanna go|would like|'?d like|prefer|'?d prefer|hoping for|vote for|keen on|keen for|push for)\b/i;

// "Ex" is how Singaporeans say expensive, and was missing entirely — probably
// the highest-frequency budget word in this market. "1k" shorthand and bare
// figures ("flight alone already 800") were also invisible.
//
// "Broke" needs the lookahead: without it "no they broke up in may" — gossip
// about a breakup — was filed as a budget opinion.
const BUDGET_WORDS_STRONG =
  /\b(?:budget|expensive|pricey|costly|afford|affordable|broke(?!\s*(?:up|down|even|into|through))|too much|save (?:up|money)|money(?:'s)? tight|tight on (?:cash|money|budget)|too ex|damn ex|so ex|ex lah|atas|burn a hole|cheapest)\b/i;

/**
 * Words that only mean *budget* when someone is talking about their own
 * position. "Cheap" and "price" appear constantly in a chat about travel
 * without stating any constraint at all — "airbnb cheaper if 6 pax" and
 * "u want cheap flight or not" were both being recorded as budget opinions,
 * and so was a bare "cheap".
 */
const BUDGET_WORDS_WEAK = /\b(?:cheap(?:er)?|price|prices|fare|fares)\b/i;

// Amounts are matched without a trailing word boundary: "\b" after "\d"
// fails on any multi-digit figure, so "under 1500" silently didn't match.
//
// The bare "30k" shape needs a money cue beside it — a marathon distance
// ("ya 30k this sat") and a renovation quote ("quoted me 68k") were both
// reading as the trip's budget.
const BUDGET_AMOUNT =
  /(?:\$\s?\d+|\b(?:under|below|within|around|about|roughly|max)\s+\$?\d+(?:\s*k)?\b(?!\s*[/-]\s*\d)|\b\d+(?:\.\d+)?\s*k\s*(?:max|budget|each|pp|per pax|only|or so)\b|\b(?:budget|spend|max|under|below|within|around|about|roughly|cost|costs)\s*\$?\s*\d+(?:\.\d+)?\s*k\b)/i;

const BUDGET = {
  /** Weak vocabulary needs the speaker to be talking about themselves. */
  test: (text: string, firstPerson: boolean) =>
    BUDGET_WORDS_STRONG.test(text) ||
    BUDGET_AMOUNT.test(text) ||
    (firstPerson && BUDGET_WORDS_WEAK.test(text)),
};

export interface ParticipantNote {
  kind: NoteKind;
  /** Their own words, kept verbatim for the card and for auditability. */
  text: string;
}

export function parseParticipantNote(rawText: string): ParticipantNote | null {
  const text = rawText.trim();
  if (!text) return null;

  const firstPerson = FIRST_PERSON.test(text);

  // Budget talk is personal by nature and needs no first-person marker —
  // "too expensive" from anyone is worth recording.
  if (BUDGET.test(text, firstPerson)) return { kind: "BUDGET", text };

  if (!firstPerson) return null;

  // Agreeing to a place is never an objection to it.
  if (ASSENT.test(text)) return null;

  if (OBJECTION.test(text)) return { kind: "DESTINATION_OBJECTION", text };
  if (PREFERENCE.test(text)) return { kind: "DESTINATION_PREFERENCE", text };
  return null;
}
