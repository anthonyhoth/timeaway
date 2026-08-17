import type { ISODate } from "@timeaway/shared";
import { findMonthRange } from "./months.js";
import type { DateRange } from "./periods.js";
import { findFuzzyPeriod } from "./periods.js";

export interface TripRequest {
  /** Places on the table — "Korea/Japan" yields two candidates. */
  destinations: string[];
  horizon: DateRange | null;
  duration: { min: number; max: number } | null;
  /** Notes on what was inferred, shown back for confirmation (brief §11). */
  interpretations: string[];
  /**
   * True when the grammar can't claim the input confidently — conditionals,
   * junk residue, or nothing recognised. Only then is the LLM worth calling.
   */
  needsLlm: boolean;
}

/** Language that implies conditional constraints the grammar won't model. */
const CONDITIONAL_RE =
  /\b(?:if|unless|depends|as long as|provided|except|but not|avoid|instead of|rather than|prefer(?:ably)?)\b/i;

const FILLER = new Set([
  "a", "an", "the", "our", "my", "we", "us", "i", "im", "lets",
  "trip", "trips", "holiday", "holidays", "vacation", "getaway", "break",
  "travel", "travelling", "traveling", "go", "going", "visit", "fly",
  "to", "in", "on", "at", "around", "during", "for", "with", "of", "about",
  "sometime", "somewhere", "maybe", "plan", "planning", "thinking",
  "want", "wanna", "guys", "please", "some", "day", "days",
  // Edit vocabulary — otherwise "let's go in June instead" yields a place
  // called "Instead", and "not sure" one called "Sure".
  "also", "too", "well", "add", "another", "consider", "include", "instead",
  "rather", "than", "change", "switch", "actually", "drop", "remove", "cross",
  "off", "forget", "scrap", "no", "not", "longer", "out", "is", "are", "it",
  "what", "how", "about", "list", "sure", "try", "trying", "lets", "let",
  // Period words: without these "Hainan this year end" yields a place called
  // "Hainan This", and a bare "whole of December" one called "Whole".
  "this", "that", "these", "those", "whole", "end", "start", "year", "years",
  "month", "months", "week", "weeks", "next", "last", "coming", "can", "do",
  "doing", "done", "there", "here", "then", "when", "aim", "aiming", "look",
  "looking", "hoping", "hope",
  "can", "cannot", "cant", "do", "does", "doing", "done", "shall", "should",
  "push", "move", "moving", "make", "making", "long", "short", "shorter",
  "longer", "extend", "shorten",
  // Time nouns that survive the temporal pass but are never places.
  "today", "tomorrow", "tonight", "weekend", "week", "month", "year", "date",
  "dates", "time", "period",
]);

const CANDIDATE_RE = /^[\p{L}][\p{L}\s'’.-]{0,39}$/u;

function smartCase(value: string): string {
  if (value !== value.toLowerCase()) return value;
  return value.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

function maskSpan(text: string, start: number, end: number): string {
  return text.slice(0, start) + " ".repeat(end - start) + text.slice(end);
}

/**
 * Parse the free text after `/newtrip` deterministically, by consuming what it
 * recognises and treating the residue as destination candidates. No LLM unless
 * `needsLlm` comes back true.
 *
 *   "a Korea/Japan trip in 2027 year end"
 *     → destinations ["Korea", "Japan"], horizon 2027-11-15 … 2028-01-05
 */
export function parseTripRequest(args: string, today: ISODate): TripRequest {
  const empty: TripRequest = {
    destinations: [],
    horizon: null,
    duration: null,
    interpretations: [],
    needsLlm: false,
  };
  const input = args.trim();
  if (!input) return empty;

  let remaining = input;
  const interpretations: string[] = [];

  // Duration must name days explicitly here, so a bare "4-6" is never mistaken
  // for a date range in free text.
  let duration: TripRequest["duration"] = null;
  const durationMatch =
    /\b(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\s*days?\b/i.exec(remaining) ??
    /\b(\d{1,2})\s*days?\b/i.exec(remaining);
  if (durationMatch) {
    const min = Number(durationMatch[1]);
    const max = durationMatch[2] ? Number(durationMatch[2]) : min;
    if (min >= 1 && max >= min && max <= 30) {
      duration = { min, max };
      remaining = maskSpan(
        remaining,
        durationMatch.index,
        durationMatch.index + durationMatch[0].length,
      );
    }
  }

  // Fuzzy period first — "year end" would otherwise be missed entirely, and
  // month scanning could grab a stray "may"/"march" out of a place name.
  let horizon: DateRange | null = null;
  const fuzzy = findFuzzyPeriod(remaining, today);
  if (fuzzy) {
    horizon = fuzzy.range;
    interpretations.push(fuzzy.note);
    remaining = maskSpan(remaining, fuzzy.start, fuzzy.end);
  } else {
    const months = findMonthRange(remaining, today);
    if (months) {
      horizon = months.range;
      if (months.note !== "explicit dates") interpretations.push(months.note);
      remaining = maskSpan(remaining, months.start, months.end);
    }
  }

  // Whatever survives is the destination.
  const rawTokens = remaining.split(/\s+/).filter((t) => t.trim().length > 0);

  // Dates and durations are masked out by now, so a leftover digit is junk the
  // grammar failed to claim — a signal to escalate rather than guess.
  const junkTokens = rawTokens.filter((t) => /\d/.test(t));

  const residueTokens = rawTokens
    // Strip surrounding punctuation but keep candidate separators intact.
    .map((t) => t.replace(/^[^\p{L}/,&]+|[^\p{L}/,&]+$/gu, ""))
    .filter((t) => t.length > 0);

  const kept = residueTokens.filter(
    (t) => !FILLER.has(t.toLowerCase().replace(/[^\p{L}]/gu, "")),
  );
  const rebuilt = kept.join(" ");

  const destinations = rebuilt
    .split(/\s*(?:\/|,|\bor\b|\band\b|&)\s*/i)
    .map((c) => c.trim())
    .filter((c) => c.length > 0 && CANDIDATE_RE.test(c))
    .map(smartCase)
    .slice(0, 5);

  const unclaimed = rebuilt
    .split(/\s*(?:\/|,|\bor\b|\band\b|&)\s*/i)
    .map((c) => c.trim())
    .filter((c) => c.length > 0 && !CANDIDATE_RE.test(c));

  if (destinations.length > 0 && input.trim() !== destinations.join(" ")) {
    interpretations.push("destination");
  }

  const nothingFound =
    destinations.length === 0 && horizon === null && duration === null;

  return {
    destinations,
    horizon,
    duration,
    interpretations,
    needsLlm:
      CONDITIONAL_RE.test(input) ||
      unclaimed.length > 0 ||
      junkTokens.length > 0 ||
      nothingFound,
  };
}
