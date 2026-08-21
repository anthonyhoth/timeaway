import type { ISODate } from "@timeaway/shared";
import type { DestinationEdit } from "./destination.js";
import { parseDestinationEdits } from "./destination.js";
import { MONTH_RE } from "./months.js";
import { parseReversal } from "./reversal.js";
import {
  statesPersonalConstraint,
  statesThirdPartyConstraint,
} from "./availability.js";
import { readProposal } from "./proposals.js";
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
export interface DurationEdit {
  min?: number;
  max?: number;
}

export interface TripEdit {
  /** Several, because one message can add a place and rule out another. */
  destinations?: DestinationEdit[];
  horizon?: DateRange;
  /** Either end may be absent: "minimum 5 days" states a floor only. */
  duration?: DurationEdit;
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

/**
 * A month named in order to *rule it out*.
 *
 * simulation.test.ts already guards the "nov too rainy" shape. A replay of
 * three simulated group chats found the same failure under a vocabulary none of
 * those patterns cover — out, dead, die — because "not" and "out" are edit
 * words, so a rejection read as a request and pointed the trip at exactly the
 * month being refused:
 *
 *     "so nov out?"                     -> horizon November
 *     "n cny is feb so feb also dead"   -> horizon February
 *     "ok so not nov. dec?"             -> horizon November
 *
 * The last one is the sharpest: it took the rejected month and discarded the
 * one actually proposed. Vetoing the whole edit loses that proposal, which is
 * the safe direction to be wrong in — a month nobody chose is worse than no
 * change, and someone will say "december" again.
 */
const REJECTS_PERIOD = new RegExp(
  `\\b(?:not|no)\\s+(?:${MONTH_RE})\\b` +
    `|\\b(?:${MONTH_RE})\\b[^.!?]{0,24}?\\b(?:out|dead|die|died|gone|cancelled|scrapped|cmi|sian|jialat|no good)\\b`,
  "i",
);

/**
 * `states` marks a phrase that is a trip length *by itself*. A bare "weekend"
 * is not: it is one of the most common words in a chat about dates, and
 * "1 day is weekend what" — an aside about which days fall on a weekend —
 * was silently capping the trip at three days. It still resolves a length once
 * something else has established that the trip's shape is under discussion.
 */
const NAMED_DURATIONS: {
  pattern: RegExp;
  min: number;
  max: number;
  states: boolean;
}[] = [
  { pattern: /\blong weekend\b/i, min: 3, max: 4, states: true },
  { pattern: /\b(?:a |one )?fortnight\b/i, min: 14, max: 14, states: true },
  { pattern: /\btwo weeks?\b/i, min: 14, max: 14, states: true },
  { pattern: /\b(?:a|one)\s+week\b/i, min: 7, max: 7, states: true },
  { pattern: /\bweekend\b/i, min: 2, max: 3, states: false },
];

/** Unlike the wizard's parser this searches mid-sentence: "make it 5 days". */
/**
 * How long the trip should be — possibly only one end of it.
 *
 * "Minimum 5 days" states a floor and says nothing about the ceiling, so it
 * must not collapse a 3–7 day trip to exactly 5. It was matching nothing at
 * all, and the bare-number fallback would have pinned both ends.
 */
function findDuration(text: string): DurationEdit | null {
  // Checked first, not last. It used to guard only the bare-number fallback at
  // the bottom, so "i can only take 5 days max at one go" matched the ceiling
  // pattern above it and became a five-day cap on the whole trip. A number of
  // days that belongs to someone's leave is never the trip's length, whichever
  // shape it is written in.
  if (LEAVE_CONTEXT.test(text)) return null;

  for (const named of NAMED_DURATIONS) {
    if (named.pattern.test(text)) return { min: named.min, max: named.max };
  }

  const range = /\b(\d{1,2})\s*(?:-|–|—|to)\s*(\d{1,2})\s*days?\b/i.exec(text);
  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);
    if (valid(min) && valid(max) && max >= min) return { min, max };
  }

  // Negated comparatives first: "no more than 4 days" contains "more than",
  // and reading it as a floor inverted the constraint exactly.
  const negatedCeiling = /\bno (?:more|longer) than\s+(\d{1,2})\s*days?\b/i.exec(text);
  if (negatedCeiling && valid(Number(negatedCeiling[1]))) {
    return { max: Number(negatedCeiling[1]) };
  }
  const negatedFloor = /\bno (?:less|shorter|fewer) than\s+(\d{1,2})\s*days?\b/i.exec(text);
  if (negatedFloor && valid(Number(negatedFloor[1]))) {
    return { min: Number(negatedFloor[1]) };
  }

  // A floor: "at least 5 days", "minimum 5 days", "5 days minimum", "5 days+".
  const floor =
    /\b(?:at least|minimum(?: of)?|min(?:imum)?|no less than|no shorter than|more than|longer than|over)\s+(\d{1,2})\s*days?\b/i.exec(text) ??
    /\b(\d{1,2})\s*days?\s*(?:\+|or more|or longer|minimum|min|at least|upwards)\b/i.exec(text);
  if (floor) {
    const min = Number(floor[1]);
    if (valid(min)) return { min };
  }

  // A ceiling: "at most 5 days", "max 5 days", "no more than 5 days".
  const ceiling =
    /\b(?:at most|maximum(?: of)?|max(?:imum)?|no more than|no longer than|under|less than|up to|within)\s+(\d{1,2})\s*days?\b/i.exec(text) ??
    /\b(\d{1,2})\s*days?\s*(?:or less|or fewer|or shorter|max(?:imum)?|tops)\b/i.exec(text);
  if (ceiling) {
    const max = Number(ceiling[1]);
    if (valid(max)) return { max };
  }

  // A bare number pins both ends. "Got 5 days leave" is a budget, not a trip
  // length — already refused at the top of this function.
  const single = /\b(\d{1,2})\s*days?\b/i.exec(text);
  if (single) {
    const value = Number(single[1]);
    if (valid(value)) return { min: value, max: value };
  }
  return null;
}

/**
 * Words that mark a number of days as *leave* rather than trip length. The
 * "take N days" shape carries no leave word at all — "i can only take 5 days
 * max at one go" — and was being read as a request to cap the trip at five
 * days for everyone.
 */
const LEAVE_CONTEXT =
  /\b(?:leave|al|annual leave|days? off|off days?)\b|\b(?:only|just)\s+take\s+\d{1,2}\s*days?\b/i;

/**
 * Whether the text *states* a trip length, as opposed to mentioning a number
 * of days in passing. A stated length licenses an edit on its own; a bare
 * number needs some other licence, because "5 days" alone is as likely to be
 * about leave as about the trip.
 */
function statesDuration(text: string): boolean {
  if (LEAVE_CONTEXT.test(text)) return false;
  if (NAMED_DURATIONS.some((named) => named.states && named.pattern.test(text)))
    return true;
  if (/\b\d{1,2}\s*(?:-|–|—|to)\s*\d{1,2}\s*days?\b/i.test(text)) return true;
  return /\b(?:at least|minimum|min|at most|maximum|max|no more than|no less than|no longer than|no shorter than|up to|or more|or less|or longer|or shorter)\b/i.test(
    text,
  );
}

const valid = (days: number) => Number.isInteger(days) && days >= 1 && days <= 30;

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
  // A message about the speaker is never a change to the group's plan, however
  // many dates it names. ABOUT_THEMSELVES caught only pronoun-adjacent phrasing;
  // this catches the obligations people actually describe.
  if (ABOUT_THEMSELVES.test(text) || statesPersonalConstraint(text)) return null;
  // Dates belonging to someone who is not on the trip are not the trip's dates.
  if (statesThirdPartyConstraint(text)) return null;
  // Someone withdrawing what they said is not proposing anything. The caller
  // already checks reversals first, so this is belt and braces — but every
  // recurrence of this bug has come from a message reaching this parser by a
  // route nobody expected.
  if (parseReversal(text)) return null;
  // Only *sceptical* questions are vetoed, not every question. "December can?"
  // and "taiwan can anot" are how a proposal is phrased here — the question is
  // the suggestion. "Meh" is different: it challenges the premise rather than
  // offering one, so it proposes nothing to apply.
  if (/\b(?:meh|izzit|is ?it)\s*\??\s*$/i.test(text)) return null;
  // A month named to refuse it is not a request for it.
  if (REJECTS_PERIOD.test(text)) return null;
  // A hypothetical describes a scenario rather than asking for one: "if korea
  // in feb its snow season also" is an argument against February, and was
  // moving the trip there. Only a leading "if" — "we go feb if flight cheap"
  // is a real proposal with a condition attached.
  if (/^\s*if\b/i.test(text)) return null;

  // Dates get proposed exactly the way destinations do — "how about December",
  // "December can?", "year end works", "why not next June" — so the same
  // proposal grammar decides whether the trip's shape is being discussed.
  // Naming a destination change *is* a statement about the trip. Without this,
  // "idw japan" produced a removal that nothing ever asked for — the parser
  // declined before looking, so the fix that taught it to read objections never
  // reached the bot.
  const destinations = parseDestinationEdits(text, today, currentDestinations);

  const proposal = readProposal(text);
  const stated =
    destinations.length > 0 ||
    EDIT_WORD.test(text) ||
    GROUP_PLAN.test(text) ||
    proposal.proposes ||
    // "Minimum 5 days" and "4-6 days" need no other licence: naming a trip
    // length *is* a statement about the trip, and both fell through every
    // branch.
    statesDuration(text) ||
    (options.horizonUnset === true && resolveHorizon(text, today) !== null);
  if (!stated) return null;

  const planning = GROUP_PLAN.test(text) || readProposal(text).proposes;

  // A fallback used to sit here, reading any leftover words as a place when a
  // planning phrase was present. parseDestinationEdit now recognises proposals
  // itself *and* vets the name, so the fallback only survived to turn "ok lah"
  // into a trip to Ok Lah — it bypassed the very check that makes this safe.

  const duration = findDuration(text);

  // A place and a period in one sentence is the normal shape of planning
  // aloud, so both are taken. For a terse edit the older rule still holds:
  // "Korea instead" moves the destination, not the dates, and reading a
  // horizon out of it would be inventing one.
  const horizon =
    planning || (destinations.length === 0 && !duration)
      ? (resolveHorizon(text, today) ?? undefined)
      : undefined;

  if (destinations.length === 0 && !duration && !horizon) return null;

  const destructive =
    destinations.some((d) => d.op !== "ADD") ||
    duration !== null ||
    horizon !== undefined;

  return {
    destinations: destinations.length > 0 ? destinations : undefined,
    duration: duration ?? undefined,
    horizon,
    destructive,
  };
}

/** One-line summary for the approval prompt and the log. */
export function describeTripEdit(edit: TripEdit): string {
  const parts: string[] = [];
  for (const change of edit.destinations ?? []) {
    const names = change.destinations.join(", ");
    parts.push(
      change.op === "ADD"
        ? `add ${names}`
        : change.op === "REMOVE"
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
