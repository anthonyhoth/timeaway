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

const ADD_WORDS =
  /\b(?:also|too|as well|add|another|what about|how about|consider|include)\b/i;
const REPLACE_WORDS =
  /\b(?:instead|rather than|change (?:it )?to|switch to|actually)\b/i;
const REMOVE_WORDS =
  /\b(?:drop|remove|cross off|forget|scrap|is out|are out|no longer|not)\b/i;

function detectOp(text: string): DestinationEditOp | null {
  // Replace is checked first: "actually let's do Korea instead" carries both
  // an add-ish and a replace-ish word, and replace is the stronger claim.
  if (REPLACE_WORDS.test(text)) return "REPLACE";
  if (ADD_WORDS.test(text)) return "ADD";
  // The bare "not" in REMOVE_WORDS also sits inside two common *positive*
  // constructions — "why not Vietnam" proposes it, "hainan not bad" praises it
  // — and both were being read as removals, then silently dropped for naming a
  // place that was not on the list.
  const notIsPositive = /\bwhy\s+not\b|\bnot\s+bad\b|\bor\s+not\b/i.test(text);
  if (REMOVE_WORDS.test(text) && !notIsPositive) return "REMOVE";

  // Nobody talks in edit words. "Korea is fine too", "how about Taiwan",
  // "Bali can?" are how a destination actually gets suggested, and all of them
  // are additions: a proposal joins what is on the table, it does not clear it.
  // Adding is also the safest reading, since it discards nobody's suggestion.
  if (readProposal(text).proposes) return "ADD";
  return null;
}

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
  // Every proposal is vetted, because most frames govern a *verb phrase* rather
  // than a noun: "let's" introduces a place in "let's do Batam" and a plan for
  // the evening in "let's eat later", which was becoming a trip to Eat Later.
  // Only an explicit replace or remove skips the check, and those must already
  // name a destination the trip has.
  const needsVetting = !REPLACE_WORDS.test(text) && !REMOVE_WORDS.test(text);
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
    const known = named.filter((n) =>
      currentDestinations.some((c) => sameName(c, n)),
    );
    return known.length > 0 ? { op, destinations: known } : null;
  }

  return { op, destinations: named };
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
