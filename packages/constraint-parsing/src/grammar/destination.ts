import type { ISODate } from "@timeaway/shared";
import {
  namesLikelyPlace,
  readProposal,
  stripProposalLanguage,
} from "./proposals.js";
import { parseTripRequest } from "./trip-request.js";

/**
 * Destination changes made in conversation — "let's try Korea too",
 * "let's go Korea instead", "drop Japan".
 *
 * Three guards keep this from misfiring, because a wrongly rewritten
 * destination is worse than a missed one:
 *  1. an explicit edit word is required, so plain chatter is ignored;
 *  2. temporal words are consumed first, so "let's go in June instead" edits
 *     nothing — the residue is a month, not a place;
 *  3. REPLACE and REMOVE must name a destination the trip already has, which
 *     stops "not sure" removing an imaginary place called "Sure".
 *
 * There is no gazetteer, so ADD still trusts the residue to be a place name.
 * That is deliberate — it lets unknown places work — and the card shows every
 * change so a wrong one is visible and correctable.
 */
export type DestinationEditOp = "ADD" | "REPLACE" | "REMOVE";

export interface DestinationEdit {
  op: DestinationEditOp;
  destinations: string[];
}

export const ADD_WORDS =
  /\b(?:also|too|as well|add|another|what about|how about|consider|include)\b/i;
export const REPLACE_WORDS =
  /\b(?:instead|rather than|change (?:it )?to|switch to|actually)\b/i;
/**
 * Taking a place off the list.
 *
 * First-person objections count. The earlier rule read "drop Japan" as a
 * decision about the plan and "I don't want Japan" as merely one person's
 * view, recording the second only as a note — so the card kept offering a
 * destination somebody had plainly rejected (founder-reported, reversing the
 * note-only decision).
 *
 * The safety that mattered is kept elsewhere: removal is destructive, so a
 * non-organiser still gets a confirm button rather than silently editing the
 * group's plan, and the objection is recorded as a note either way.
 */
export const REMOVE_WORDS =
  /\b(?:drop|remove|cross off|forget|scrap|is out|are out|no longer|not|idw|dw|dun want|do?n'?t want|dont wanna|don'?t wanna|no more|sick of|bored of|over it)\b/i;

function detectOp(text: string): DestinationEditOp | null {
  // Replace is checked first: "actually let's do Korea instead" carries both
  // an add-ish and a replace-ish word, and replace is the stronger claim.
  if (REPLACE_WORDS.test(text)) return "REPLACE";

  // Removal outranks addition, because the add vocabulary is weak words that
  // turn up everywhere. "Remove bangkok also" was read as an *addition* — the
  // exact opposite — and "drop japan too ex" vanished entirely, the "too" of
  // "too expensive" being taken for the additive "too".
  // The bare "not" in REMOVE_WORDS also sits inside two common *positive*
  // constructions — "why not Vietnam" proposes it, "hainan not bad" praises it
  // — and both were being read as removals, then silently dropped for naming a
  // place that was not on the list.
  const notIsPositive = /\bwhy\s+not\b|\bnot\s+bad\b|\bor\s+not\b/i.test(text);
  if (REMOVE_WORDS.test(text) && !notIsPositive) return "REMOVE";
  if (ADD_WORDS.test(text)) return "ADD";

  // Nobody talks in edit words. "Korea is fine too", "how about Taiwan",
  // "Bali can?" are how a destination actually gets suggested, and all of them
  // are additions: a proposal joins what is on the table, it does not clear it.
  // Adding is also the safest reading, since it discards nobody's suggestion.
  if (readProposal(text).proposes) return "ADD";
  return null;
}

const escapeName = (name: string) =>
  name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const sameName = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

export function parseDestinationEdit(
  rawText: string,
  today: ISODate,
  currentDestinations: readonly string[],
): DestinationEdit | null {
  const text = rawText.trim();
  if (!text) return null;

  const op = detectOp(text);
  if (!op) return null;

  // parseTripRequest consumes dates and durations, so whatever survives is a
  // candidate place — which is exactly what "in June instead" must not leave.
  // Strip the scaffolding we have already recognised, so what reaches the
  // extractor is the referent alone.
  const request = parseTripRequest(stripProposalLanguage(text), today);
  let named = request.destinations;
  if (named.length === 0) return null;

  // A proposal *frame* ("how about X", "let's do X") governs a noun, so the
  // residue is a place by grammar and needs no vetting — which is what keeps
  // unknown places working. A bare assessment ("X is fine too") constrains its
  // subject not at all, so there the name has to be plausible: otherwise "the
  // weather is fine too" books a trip to Weather.
  // Everything except REMOVE is vetted. REMOVE is safe unvetted because it can
  // only name a destination the trip already has; REPLACE is not, and exempting
  // it was a real hole — "actually only the last 2 weeks" carries the replace
  // word "actually", and its leftovers became a destination called **Only**
  // that wiped the group's actual choices. Replace is the destructive op; it
  // deserves the strictest check, not the loosest.
  const needsVetting = op !== "REMOVE";
  if (needsVetting) {
    named = named.filter((name) => namesLikelyPlace(name, rawText));
    if (named.length === 0) return null;
  }

  if (op === "ADD") {
    const fresh = named.filter(
      (n) => !currentDestinations.some((c) => sameName(c, n)),
    );
    return fresh.length > 0 ? { op, destinations: fresh } : null;
  }

  if (op === "REMOVE") {
    // Matched against the raw text rather than the extracted residue. A removal
    // names a place the trip already has, so we can look for it directly — and
    // extraction was mangling exactly the messages people actually send:
    // "drop japan too ex" left "Japan Ex", which matched nothing and dropped
    // nothing.
    const mentioned = currentDestinations.filter((c) =>
      new RegExp(`\\b${escapeName(c)}\\b`, "i").test(rawText),
    );
    if (mentioned.length > 0) return { op, destinations: mentioned };
    const known = named.filter((n) =>
      currentDestinations.some((c) => sameName(c, n)),
    );
    return known.length > 0 ? { op, destinations: known } : null;
  }

  return { op, destinations: named };
}

/**
 * Connectives that separate one destination decision from the next.
 *
 * "Let's go japan, idw philippines" is two decisions in one breath, and a
 * single-operation parser had to pick: it saw the removal word, found nothing
 * to remove, and returned nothing at all — losing the addition as well.
 */
const DECISION_SPLIT = /\s*(?:,|;|\band\b|\bbut\b|\bthough\b)\s*/i;

/**
 * Every destination decision in a message, in the order they were said.
 *
 * Segments are parsed independently and against the *same* starting list: a
 * message is one turn, so "drop japan, korea instead" should not have the
 * removal change what the replacement is judged against.
 */
export function parseDestinationEdits(
  rawText: string,
  today: ISODate,
  currentDestinations: readonly string[],
): DestinationEdit[] {
  const segments = rawText.split(DECISION_SPLIT).filter((part) => part.trim());

  const edits: DestinationEdit[] = [];
  for (const segment of segments) {
    const edit = parseDestinationEdit(segment, today, currentDestinations);
    if (edit) edits.push(edit);
  }
  if (edits.length > 0) return edits;

  // Unsegmented fallback: "korea or japan" is one decision naming two places,
  // and splitting it would be wrong even though it happens to merge correctly.
  const whole = parseDestinationEdit(rawText, today, currentDestinations);
  return whole ? [whole] : [];
}

/** Fold several edits over the list, in the order they were said. */
export function applyDestinationEdits(
  current: readonly string[],
  edits: readonly DestinationEdit[],
  max = 5,
): string[] {
  return edits.reduce<string[]>(
    (list, edit) => applyDestinationEdit(list, edit, max),
    [...current],
  );
}

/** Apply an edit to the current list, capped and de-duplicated. */
export function applyDestinationEdit(
  current: readonly string[],
  edit: DestinationEdit,
  max = 5,
): string[] {
  if (edit.op === "REPLACE") return edit.destinations.slice(0, max);
  if (edit.op === "REMOVE") {
    return current.filter(
      (c) => !edit.destinations.some((d) => sameName(c, d)),
    );
  }
  const merged = [...current];
  for (const d of edit.destinations) {
    if (!merged.some((c) => sameName(c, d))) merged.push(d);
  }
  return merged.slice(0, max);
}
