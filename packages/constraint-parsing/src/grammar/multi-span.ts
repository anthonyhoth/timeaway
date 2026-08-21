import type { DeclaredAvailabilityState, ISODate } from "@timeaway/shared";
import { findMonthRange } from "./months.js";
import type { DateRange } from "./periods.js";
import { findSubPeriod } from "./subperiods.js";

/**
 * Several periods in one message.
 *
 * "free in oct last 2 weeks, nov 1st week and last week and dec 3rd week" is
 * four separate spans, and the single-reference parser took the first and
 * silently dropped the rest. That is an *under*-claim, which is in some ways
 * worse than over-claiming: the speaker watched their message get a ✍ and
 * reasonably believed all five weeks were recorded, while the card was built
 * from two.
 *
 * Three things make this work. Segments are split on the connectives people
 * actually use, **the month carries** — "nov 1st week and last week" names
 * November once and means it twice — and **each segment may state its own
 * direction**. That last one arrived late: the reader used to resolve every
 * segment's dates separately and then stamp one state across all of them, so
 * "nov cannot, dec can" recorded December as blocked. A month that was offered
 * came back refused.
 *
 * The safety rule is unchanged: a segment that looks like it holds a date but
 * cannot be resolved makes the whole message decline. Half a list is not a
 * safer answer than none, because nobody can see which half was kept.
 */

/**
 * Segment boundaries.
 *
 * `/` and `+` separate segments only with whitespace on a side — "free: 20-30
 * may / busy: 1-19 may" is a list, while "12/12" is a date, and splitting
 * inside it produced the segments "12" and "12". A full stop separates only at
 * a sentence boundary for the same reason: "1.5k" must survive. Without the
 * sentence split, "mar cmi, ... apr can. may can" was two segments and May was
 * lost.
 */
const SEGMENT_SPLIT = new RegExp(
  [
    String.raw`\s*[,;&]\s*`,
    String.raw`\s+(?:and|or)\s+`,
    String.raw`\s*[/+]\s+`,
    String.raw`\s+[/+]\s*`,
    String.raw`\s*[.!?]+\s+`,
  ].join("|"),
  "i",
);

/** Tokens that mean a segment is making a claim about dates. */
const DATE_BEARING =
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|week|wk|weeks|wks|day|days|half|first|last|final|second|third|fourth|1st|2nd|3rd|4th|early|mid|middle|late|beginning|start|end)\b|\d/i;

/**
 * The terse answers a list uses and the rest of the grammar does not. "Yes",
 * "no" and "maybe" are availability words nowhere else — nobody types "no" on
 * its own to mean they are busy, except in a list — so they live here rather
 * than widening the vocabulary every other parser reads.
 */
const ANSWER_TOKEN: Record<string, DeclaredAvailabilityState> = {
  yes: "AVAILABLE",
  no: "UNAVAILABLE",
  maybe: "MAYBE",
  tbc: "UNKNOWN",
  tbd: "UNKNOWN",
  dunno: "UNKNOWN",
};

const ANSWER_TOKEN_RE = new RegExp(
  `\\b(${Object.keys(ANSWER_TOKEN).join("|")})\\b`,
  "i",
);

/**
 * Language that restricts or flips a segment's own meaning.
 *
 * A segment stating no direction normally takes the message's, which is right
 * for a bare period — "cmi nov and dec". It is wrong when the segment carries
 * one of these: "jan: after the 15th only" would inherit the "cannot" from the
 * sentences before it and record the whole of January as blocked, when the
 * speaker was offering the second half of it. Better to decline the list.
 */
const RESTRICTS_ITSELF =
  /\b(?:only|just|except|excluding|apart from|other than|after|onwards?|from|till|until|before)\b/i;

/** Null state = defer to the direction of the message as a whole. */
export interface SpanEntry {
  state: DeclaredAvailabilityState | null;
  range: DateRange;
}

/** How the caller reads a direction out of free text, injected to avoid a cycle. */
export type ReadState = (text: string) => DeclaredAvailabilityState | null;

function statedDirection(
  segment: string,
  readState?: ReadState,
): DeclaredAvailabilityState | null {
  // The caller's own vocabulary first — it is the richer one, and it is what
  // the rest of the grammar agrees with. The terse tokens only fill its gaps.
  const own = readState?.(segment) ?? null;
  if (own) return own;
  const token = ANSWER_TOKEN_RE.exec(segment);
  return token ? ANSWER_TOKEN[token[1]!.toLowerCase()]! : null;
}

/**
 * The list, with each segment's own direction where it stated one.
 *
 * Null unless at least two segments resolve: one span is the ordinary case and
 * belongs to the single-reference path, which knows about restrictions,
 * roster-pending and the rest.
 */
export function parseSpanList(
  rawText: string,
  today: ISODate,
  yearHint?: number,
  readState?: ReadState,
): SpanEntry[] | null {
  const segments = rawText
    .split(SEGMENT_SPLIT)
    .map((part) => part.trim())
    .filter(Boolean);
  if (segments.length < 2) return null;

  const entries: SpanEntry[] = [];
  // The month most recently named, so a bare "last week" knows where it is.
  let carried: { start: string; end: string } | undefined;
  // The direction most recently stated, for the segments that state none.
  let lastStated: DeclaredAvailabilityState | null = null;

  for (const segment of segments) {
    if (!DATE_BEARING.test(segment)) continue;

    const found =
      findSubPeriod(segment, today, yearHint, carried) ??
      findMonthRange(segment, today, yearHint) ??
      // The hint comes from the trip horizon, and a horizon opening in October
      // makes "june" mean June 2026 — already gone, so the matchers refuse it.
      // Every segment then failed, the whole list declined, and the caller's
      // single-reference path silently kept the first window. Falling back to
      // the matcher's own roll-forward keeps the list intact.
      findSubPeriod(segment, today, undefined, carried) ??
      findMonthRange(segment, today, undefined);

    // Date-shaped but unreadable — decline the message rather than record a
    // list with a hole in it.
    if (!found) return null;

    const own = statedDirection(segment, readState);
    // Nothing to inherit safely: see RESTRICTS_ITSELF.
    if (!own && RESTRICTS_ITSELF.test(segment)) return null;

    // A label governs the items under it until the next label. "Free: 1-8 apr,
    // 20-30 apr / busy: 9-19 apr" puts a bare window between two labelled ones,
    // and reading it against the message as a whole — which says "busy" —
    // recorded a window the speaker had offered as one they could not do.
    entries.push({ state: own ?? lastStated, range: found.range });
    if (own) lastStated = own;
    carried = monthAround(found.range.start);
  }

  if (entries.length < 2) return null;

  /**
   * Inheritance needs the message to have *one* direction to inherit.
   *
   * A segment following a labelled one takes that label. One with no labelled
   * segment before it has only the message to go on — and when the message
   * states two directions, there is nothing unambiguous to inherit.
   */
  const stated = new Set(
    entries.map((entry) => entry.state).filter((state) => state !== null),
  );
  if (stated.size > 1 && entries.some((entry) => entry.state === null)) {
    return null;
  }

  // A list enumerates alternatives; overlapping ranges mean the speaker was
  // *restating* one period more precisely, not naming two. "May cannot leh.
  // mid yr exam 10-21 may" became a list the moment sentences were split, and
  // recorded the whole of May alongside a fortnight of it. The single-reference
  // path reads that correctly, so hand it back.
  const nests = entries.some((a, i) =>
    entries.some(
      (b, j) =>
        i !== j && b.range.start >= a.range.start && b.range.end <= a.range.end,
    ),
  );
  if (nests) return null;

  return entries;
}

/**
 * A list in which every segment answers for itself — "mar: no. apr: yes. may:
 * maybe", "nov cannot, dec can".
 *
 * The same reader under a stricter policy, rather than a second implementation.
 * These need no direction from the message, so the caller can read them before
 * it has settled one; and requiring *every* segment to answer is what stops a
 * half-understood list being recorded. An earlier version of this matched
 * `month: answer` pairs directly and so never saw "jan: after the 15th only" at
 * all — it recorded the two entries it understood and dropped January without
 * a trace.
 */
export function parseSelfStatingList(
  rawText: string,
  today: ISODate,
  yearHint?: number,
  readState?: ReadState,
): { state: DeclaredAvailabilityState; range: DateRange }[] | null {
  const entries = parseSpanList(rawText, today, yearHint, readState);
  if (!entries) return null;
  if (entries.some((entry) => entry.state === null)) return null;
  return entries.map((entry) => ({ state: entry.state!, range: entry.range }));
}

function monthAround(date: string): { start: string; end: string } {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(last)}`,
  };
}
