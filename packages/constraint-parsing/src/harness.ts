/**
 * Ambient-pipeline harness. Replays a corpus of group-chat messages through the
 * same branch order as handleAmbientMessage in apps/telegram-bot/src/bot.ts,
 * minus the Telegram context and the database, and reports what each message
 * produced. Stateful branches that need a live trip (pending spans, option
 * lists on screen, continuations) are reported as such rather than simulated.
 *
 * Not a test: it answers "what would the bot do with this?" for a whole
 * conversation at once, which is how the gate-vs-grammar drift documented in
 * prefilter.ts keeps getting found.
 */

import { mightContainConstraint } from "./prefilter.js";
import { parseAvailabilityMessage } from "./grammar/availability.js";
import { parseDestinationObjection } from "./grammar/destination.js";
import {
  joinUtterances,
  looksLikeContinuation,
  sameReading,
} from "./grammar/continuation.js";
import { parseParticipantNote } from "./grammar/notes.js";
import { namesOpaquePeriod } from "./grammar/opaque.js";
import { parseOptionReference } from "./grammar/option-reference.js";
import { parseParticipationChange } from "./grammar/participation.js";
import { parseReversal } from "./grammar/reversal.js";
import { parseTripEdit } from "./grammar/trip-edit.js";
import { parseUnderspecifiedSpan } from "./grammar/underspecified.js";
import type { ExtractionContext } from "./types.js";

/** Where a message came to rest in the pipeline. */
export type Outcome =
  | "DROPPED_BY_GATE"
  | "OPTION_REFERENCE"
  | "REVERSAL"
  | "PARTICIPATION"
  | "TRIP_EDIT"
  | "AVAILABILITY"
  | "NOTE_ONLY"
  | "OPAQUE_ASK"
  | "CONTINUATION"
  | "UNDERSPECIFIED_ASK"
  | "ESCALATED_TO_LLM";

export interface Verdict {
  speaker: string;
  text: string;
  outcome: Outcome;
  /** True when the message also recorded an opinion on the way past. */
  noted: boolean;
  detail: string;
}

export interface HarnessOptions {
  ctx: ExtractionContext;
  /** Destinations already on the trip card, for trip-edit direction. */
  current?: string[];
  horizonUnset?: boolean;
  /**
   * How many options are on screen. Option references are only live while a
   * shortlist is showing, and the parser needs the count to resolve "the last
   * one". Zero means nothing is on screen.
   */
  optionsOnScreen?: number;
  /**
   * The speaker's last declaration-producing message, as bot.ts keeps in
   * `lastUtterances`. Continuation only fires when one exists and the joined
   * text parses — without this the branch claims far more than it really does.
   */
  lastUtterance?: string | null;
}

const brief = (value: unknown): string =>
  JSON.stringify(value) ?? String(value);

/**
 * One message through the pipeline, in bot.ts's order. The order is the point:
 * availability gets first refusal over participation, trip edits and reversals,
 * so a message about the speaker's own dates never moves the trip.
 */
export function runMessage(
  speaker: string,
  text: string,
  opts: HarnessOptions,
): Verdict {
  const {
    ctx,
    current = [],
    horizonUnset = false,
    optionsOnScreen = 0,
    lastUtterance = null,
  } = opts;
  const verdict = (outcome: Outcome, detail: string, noted = false): Verdict => ({
    speaker,
    text,
    outcome,
    noted,
    detail,
  });

  // Ahead of the gate, exactly as in bot.ts: choosing an option reads as
  // ordinary chatter, so the gate would drop every phrasing of it.
  if (optionsOnScreen > 1) {
    const ref = parseOptionReference(text, optionsOnScreen);
    if (ref) return verdict("OPTION_REFERENCE", brief(ref));
  }

  // Stage 1: the free deterministic gate.
  if (!mightContainConstraint(text)) {
    return verdict("DROPPED_BY_GATE", "");
  }

  const availability = parseAvailabilityMessage(text, ctx);

  // A bare retraction carries no date for latest-wins to bite on.
  if (!availability && parseReversal(text)) {
    return verdict("REVERSAL", brief(parseReversal(text)));
  }

  // Leaving or rejoining, checked after availability so "count me out for
  // November" stays a date constraint.
  if (!availability) {
    const change = parseParticipationChange(text);
    if (change) return verdict("PARTICIPATION", change);
  }

  // Opinions are recorded without ending the message: people bundle an opinion
  // with a constraint, and returning here dropped the dates.
  const note = parseParticipantNote(text);
  const noted = note !== null;
  const noteDetail = note
    ? `${note.kind}${
        parseDestinationObjection(text, ctx.today)[0]
          ? ` re ${parseDestinationObjection(text, ctx.today)[0]}`
          : ""
      }`
    : "";

  // Someone steering the trip itself.
  if (!availability) {
    const edit = parseTripEdit(text, ctx.today, current, { horizonUnset });
    if (edit) {
      return verdict(
        "TRIP_EDIT",
        `${brief(edit)}${noted ? ` | note: ${noteDetail}` : ""}`,
        noted,
      );
    }
  }

  if (availability) {
    return verdict(
      "AVAILABILITY",
      `${brief(availability.declarations)}${
        availability.maxLeaveDays ? ` maxLeave=${availability.maxLeaveDays}` : ""
      }${availability.subjectName ? ` subject=${availability.subjectName}` : ""}${
        noted ? ` | note: ${noteDetail}` : ""
      }`,
      noted,
    );
  }

  if (namesOpaquePeriod(text)) {
    return verdict("OPAQUE_ASK", "asks the sender to pin it down", noted);
  }

  // A fragment finishing the speaker's own previous message. Fires only when
  // the join actually yields declarations, as in tryContinuation.
  if (lastUtterance && looksLikeContinuation(text)) {
    const joined = joinUtterances(lastUtterance, text);
    const combined = parseAvailabilityMessage(joined, ctx);
    const before = parseAvailabilityMessage(lastUtterance, ctx);
    const addsNothing =
      combined !== null &&
      before !== null &&
      sameReading(before.declarations, combined.declarations);
    if (combined && combined.declarations.length > 0 && !addsNothing) {
      return verdict(
        "CONTINUATION",
        `joined to "${lastUtterance}" -> ${brief(combined.declarations)}`,
        noted,
      );
    }
  }

  const span = parseUnderspecifiedSpan(text, ctx);
  if (span) {
    return verdict("UNDERSPECIFIED_ASK", brief(span), noted);
  }

  if (noted) {
    return verdict("NOTE_ONLY", noteDetail, true);
  }

  return verdict("ESCALATED_TO_LLM", "grammar declined; LLM or 🤔", noted);
}

export interface Message {
  speaker: string;
  text: string;
}

/**
 * Replays a whole conversation, carrying the per-speaker `lastUtterances`
 * state that continuation depends on. Only a message that actually recorded
 * declarations becomes the anchor for the next fragment, matching bot.ts.
 */
export function runConversation(
  messages: Message[],
  opts: HarnessOptions,
): Verdict[] {
  const lastBySpeaker = new Map<string, string>();
  return messages.map((m) => {
    const verdict = runMessage(m.speaker, m.text, {
      ...opts,
      lastUtterance: lastBySpeaker.get(m.speaker) ?? null,
    });
    if (verdict.outcome === "AVAILABILITY") {
      lastBySpeaker.set(m.speaker, m.text);
    } else if (verdict.outcome === "CONTINUATION") {
      lastBySpeaker.set(
        m.speaker,
        joinUtterances(lastBySpeaker.get(m.speaker) ?? "", m.text),
      );
    }
    return verdict;
  });
}
