import type { ISODate } from "@timeaway/shared";
import { findMonthRange } from "./months.js";
import type { DateRange } from "./periods.js";
import { findFuzzyPeriod, findRelativePeriod } from "./periods.js";

/**
 * The single entry point for "roughly when could this trip happen?".
 *
 * The wizard and `/newtrip` arguments both resolve horizons through here, so
 * a phrase understood in one place is understood in the other. Keeping two
 * parsers is what made the bot reject "next year" in the wizard while
 * accepting it as a command argument.
 */
export function resolveHorizon(
  input: string,
  today: ISODate,
): DateRange | null {
  const text = input.trim();
  if (!text) return null;

  const currentYear = Number(today.slice(0, 4));

  // A year phrase can sit alongside a month range — "next year around
  // June–July" means June to July of next year, not all of next year — so the
  // year is extracted first and handed to the month matcher as a hint.
  let yearHint: number | undefined;
  const explicitYear = /\b(20\d{2})\b/.exec(text)?.[1];
  if (explicitYear) yearHint = Number(explicitYear);
  else if (/\bnext\s+year\b/i.test(text)) yearHint = currentYear + 1;
  else if (/\bthis\s+year\b/i.test(text)) yearHint = currentYear;

  // Months are the most specific signal, so they win when present.
  const months = findMonthRange(text, today, yearHint);
  if (months) return months.range;

  const fuzzy = findFuzzyPeriod(text, today);
  if (fuzzy) return fuzzy.range;

  const relative = findRelativePeriod(text, today);
  if (relative) return relative.range;

  return null;
}

/**
 * "I don't know yet" in the forms people actually type. Recognising these
 * matters at every wizard step: without it, "idk yet" typed at the
 * destination question becomes a trip to a place called "Idk Yet", and typed
 * at the duration question it just loops.
 */
const UNKNOWN_ANSWER =
  /^(?:idk|dk|dunno|dun ?know|don'?t know|no idea|not sure|unsure|nil|nothing|any(?:thing)?|whatever|up to (?:you|u|yall)|flexible|open|tbc|tbd|not decided|undecided|haven'?t decided|no pref(?:erence)?)\b/i;

export function isUnknownAnswer(input: string): boolean {
  const text = input
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/, "")
    .replace(/\s*\b(?:yet|leh|lah|lor|sia|hor|ah)\b\s*/g, " ")
    .trim();
  return text.length > 0 && UNKNOWN_ANSWER.test(text);
}

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fourteen: 14,
};

/** Durations people name rather than count. */
const NAMED_DURATIONS: { pattern: RegExp; min: number; max: number }[] = [
  { pattern: /\blong weekend\b/i, min: 3, max: 4 },
  { pattern: /\b(?:a |one )?fortnight\b/i, min: 14, max: 14 },
  { pattern: /\btwo weeks?\b/i, min: 14, max: 14 },
  { pattern: /\b(?:a|one)\s+week\b/i, min: 7, max: 7 },
  { pattern: /\bweekend\b/i, min: 2, max: 3 },
  { pattern: /\bweek\b/i, min: 7, max: 7 },
];

/**
 * Duration in days, for the wizard's "how many days?" step where a bare
 * "4-6" is unambiguous. Freeform `/newtrip` arguments use a stricter rule
 * that requires the word "days", so a date range is never mistaken for one.
 */
export function parseDurationRange(
  input: string,
): { min: number; max: number } | null {
  const raw = input.trim().toLowerCase();

  for (const named of NAMED_DURATIONS) {
    if (named.pattern.test(raw)) return { min: named.min, max: named.max };
  }

  // Strip hedges and units — "about 5 days or so", "5ish" are all just 5.
  let text = raw
    .replace(/\b(?:about|around|roughly|approx(?:imately)?|maybe|like|prob(?:ably)?|say)\b/g, " ")
    .replace(/\bor so\b/g, " ")
    .replace(/(\d)\s*ish\b/g, "$1")
    .replace(/\bdays?\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const [word, value] of Object.entries(WORD_NUMBERS)) {
    text = text.replace(new RegExp(`\\b${word}\\b`, "g"), String(value));
  }

  const range = /(\d{1,2})\s*(?:-|–|—|to|until|or)\s*(\d{1,2})/.exec(text);
  const single = range ? null : /^(\d{1,2})$/.exec(text);
  if (!range && !single) return null;

  const min = Number((range ?? single)![1]);
  const max = range ? Number(range[2]) : min;
  if (min < 1 || max < min || max > 30) return null;
  return { min, max };
}
