import type { ISODate } from "@timeaway/shared";
import type { DestinationEdit } from "./destination.js";
import { parseDestinationEdit } from "./destination.js";
import { parseTripRequest } from "./trip-request.js";
import { resolveHorizon } from "./horizon.js";
import type { DateRange } from "./periods.js";

/**
 * Changes to the trip's own shape, said in conversation: where, when, and how
 * long. Destination edits carry an operation; horizon and duration are always
 * replacements, since there is no additive version of "make it December".
 *
 * Availability is parsed *before* this by the caller. That ordering is what
 * keeps "can also do december" an availability statement rather than a request
 * to move the trip — the speaker is describing themselves, not the plan.
 */
export interface TripEdit {
  destination?: DestinationEdit;
  horizon?: DateRange;
  duration?: { min: number; max: number };
  /** True when nothing here is purely additive, so it needs the organiser. */
  destructive: boolean;
}

/**
 * Someone describing *themselves*, not the plan.
 *
 * The caller parses availability first, which handles "can also do December".
 * That ordering is not enough on its own: when availability *declines* — and it
 * declines whenever a statement is ambiguous — the message falls through to
 * here, where "not" is an edit word. "I'm not free 2 weeks in Nov" was
 * therefore read as *move the whole trip to November*, and from an organiser
 * that applied silently.
 *
 * A first-person availability statement can never be a change to the trip's
 * shape, however ambiguous the dates in it are.
 */
const ABOUT_THEMSELVES =
  /\b(?:i|i'?m|im|my|me|myself|i'?ve|ive)\b[^.!?]{0,32}?\b(?:free|avail(?:able)?|can'?t|cannot|cant|cmi|cbb|bo eng|busy|unavailable|no leave|leave|off|away|overseas?)\b/i;

/**
 * Planning the trip out loud — "we want to go Hainan this year end", "planning
 * on this year end", "we can do December".
 *
 * These carry no edit verb, so nothing matched them, and a group stating their
 * window in the most natural way possible was met with silence. The tell is
 * that they are about *the trip*: first-person plural, or an impersonal
 * planning verb. First-person singular is someone's own availability and is
 * excluded by ABOUT_THEMSELVES above.
 */
const GROUP_PLAN =
  /\b(?:we|us|let'?s|lets)\b|\b(?:planning|plan on|planning on|thinking of|thinking about|looking at|aiming for|aim for|hoping for)\b/i;

const EDIT_WORD =
  /\b(?:also|too|as well|add|another|what about|how about|consider|include|instead|rather than|change (?:it )?to|switch to|actually|make it|push (?:it )?to|move (?:it )?to|drop|remove|cross off|forget|scrap|is out|are out|no longer|not)\b/i;

const NAMED_DURATIONS: { pattern: RegExp; min: number; max: number }[] = [
  { pattern: /\blong weekend\b/i, min: 3, max: 4 },
  { pattern: /\b(?:a |one )?fortnight\b/i, min: 14, max: 14 },
  { pattern: /\btwo weeks?\b/i, min: 14, max: 14 },
  { pattern: /\b(?:a|one)\s+week\b/i, min: 7, max: 7 },
  { pattern: /\bweekend\b/i, min: 2, max: 3 },
];

/** Unlike the wizard's parser this searches mid-sentence: "make it 5 days". */
function findDuration(text: string): { min: number; max: number } | null {
  for (const named of NAMED_DURATIONS) {
    if (named.pattern.test(text)) return { min: named.min, max: named.max };
  }
  const range = /\b(\d{1,2})\s*(?:-|–|—|to)\s*(\d{1,2})\s*days?\b/i.exec(text);
  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);
    if (min >= 1 && max >= min && max <= 30) return { min, max };
  }
  const single = /\b(\d{1,2})\s*days?\b/i.exec(text);
  if (single) {
    const value = Number(single[1]);
    if (value >= 1 && value <= 30) return { min: value, max: value };
  }
  return null;
}

export function parseTripEdit(
  rawText: string,
  today: ISODate,
  currentDestinations: readonly string[],
  options: {
    /**
     * True while the trip has no window at all. A bare period is then almost
     * certainly the answer to "when?" — the group has just been asked, and
     * there is nothing for it to contradict. Once a window exists, changing it
     * needs clearer intent than a passing mention of a month.
     */
     horizonUnset?: boolean;
  } = {},
): TripEdit | null {
  const text = rawText.trim();
  if (ABOUT_THEMSELVES.test(text)) return null;

  const stated =
    EDIT_WORD.test(text) ||
    GROUP_PLAN.test(text) ||
    (options.horizonUnset === true && resolveHorizon(text, today) !== null);
  if (!stated) return null;

  const planning = GROUP_PLAN.test(text);

  let destination = parseDestinationEdit(text, today, currentDestinations);

  // "We want to go Hainan this year end" names a place with no edit word, so
  // the op detector finds nothing. Planning aloud with no destination yet is
  // an ADD, not a rewrite — the weakest claim that fits, so it needs no
  // organiser approval and cannot silently discard an existing choice.
  if (!destination && planning && currentDestinations.length === 0) {
    const named = parseTripRequest(text, today).destinations;
    if (named.length > 0) destination = { op: "ADD", destinations: named };
  }

  const duration = findDuration(text);

  // A place and a period in one sentence is the normal shape of planning
  // aloud, so both are taken. For a terse edit the older rule still holds:
  // "Korea instead" moves the destination, not the dates, and reading a
  // horizon out of it would be inventing one.
  const horizon =
    planning || (!destination && !duration)
      ? (resolveHorizon(text, today) ?? undefined)
      : undefined;

  if (!destination && !duration && !horizon) return null;

  const destructive =
    (destination !== null && destination.op !== "ADD") ||
    duration !== null ||
    horizon !== undefined;

  return {
    destination: destination ?? undefined,
    duration: duration ?? undefined,
    horizon,
    destructive,
  };
}

/** One-line summary for the approval prompt and the log. */
export function describeTripEdit(edit: TripEdit): string {
  const parts: string[] = [];
  if (edit.destination) {
    const names = edit.destination.destinations.join(", ");
    parts.push(
      edit.destination.op === "ADD"
        ? `add ${names}`
        : edit.destination.op === "REMOVE"
          ? `drop ${names}`
          : `switch to ${names}`,
    );
  }
  if (edit.horizon) parts.push(`move dates to ${edit.horizon.start} – ${edit.horizon.end}`);
  if (edit.duration) {
    parts.push(
      edit.duration.min === edit.duration.max
        ? `make it ${edit.duration.min} days`
        : `make it ${edit.duration.min}–${edit.duration.max} days`,
    );
  }
  return parts.join(", ");
}
