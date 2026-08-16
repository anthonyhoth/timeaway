import type { ISODate } from "@timeaway/shared";
import { assessParticipantWindow } from "./assessment.js";
import type { AvailabilityDeclaration } from "./availability.js";
import type { WindowParticipant } from "./feasibility.js";
import { leaveDaysRequired } from "./leave.js";
import type { CandidateWindow } from "./windows.js";
import { generateCandidateWindows } from "./windows.js";

/**
 * Structural mismatches between a participant and the trip *as drafted* —
 * distinct from ordinary per-window unavailability.
 *
 * "Dan can't make 7–10 Nov" is a window problem the ranking already handles.
 * "Dan has one leave day and this is a seven-day trip" is not: no window will
 * ever work, and the group needs to decide whether to reshape the trip or go
 * without him. Timeaway surfaces that choice; it never makes it.
 */
export type ParticipantDiagnostic =
  | {
      kind: "ANSWERED_OUTSIDE_HORIZON";
      participantId: string;
      /** What they actually said, so the group can see the mismatch. */
      statedRanges: { start: ISODate; end: ISODate }[];
    }
  | {
      kind: "BLOCKED_ACROSS_HORIZON";
      participantId: string;
      /** Dates they said they *could* do, outside this trip's window. */
      availableElsewhere: { start: ISODate; end: ISODate }[];
    }
  | {
      kind: "LEAVE_CAP_BLOCKS_ALL";
      participantId: string;
      maxLeaveDays: number;
      /** Cheapest any window of the current shape could be. */
      cheapestWindowLeave: number;
      /** Longest trip they could afford here; 0 when nothing fits. */
      longestAffordableDays: number;
    };

function overlaps(
  d: AvailabilityDeclaration,
  start: ISODate,
  end: ISODate,
): boolean {
  return d.start <= end && d.end >= start;
}

/**
 * The longest trip this person could afford within the horizon, given their
 * leave cap — the concrete answer to "so what *could* they do?".
 */
export function longestAffordableDuration(
  horizonStart: ISODate,
  horizonEnd: ISODate,
  maxLeaveDays: number,
  publicHolidays: ReadonlySet<ISODate>,
  searchUpToDays = 14,
): number {
  let longest = 0;
  for (let days = 1; days <= searchUpToDays; days++) {
    let windows: CandidateWindow[];
    try {
      windows = generateCandidateWindows({
        horizonStart,
        horizonEnd,
        durationMinDays: days,
        durationMaxDays: days,
      });
    } catch {
      break;
    }
    if (windows.length === 0) break;
    const affordable = windows.some(
      (w) => leaveDaysRequired(w.start, w.end, publicHolidays) <= maxLeaveDays,
    );
    if (affordable) longest = days;
  }
  return longest;
}

export interface DiagnosticsInput {
  participants: readonly WindowParticipant[];
  /** Windows already generated for the trip's current shape. */
  windows: readonly CandidateWindow[];
  horizonStart: ISODate;
  horizonEnd: ISODate;
  publicHolidays: ReadonlySet<ISODate>;
}

export function diagnoseParticipants(
  input: DiagnosticsInput,
): ParticipantDiagnostic[] {
  const diagnostics: ParticipantDiagnostic[] = [];

  const windowLeave = input.windows.map((w) =>
    leaveDaysRequired(w.start, w.end, input.publicHolidays),
  );
  const cheapestWindowLeave =
    windowLeave.length > 0 ? Math.min(...windowLeave) : 0;

  for (const participant of input.participants) {
    // Answered, but about dates this trip doesn't cover. Without this they
    // resolve to UNANSWERED and look like they simply never replied.
    if (participant.declarations.length > 0) {
      const inHorizon = participant.declarations.filter((d) =>
        overlaps(d, input.horizonStart, input.horizonEnd),
      );
      if (inHorizon.length === 0) {
        diagnostics.push({
          kind: "ANSWERED_OUTSIDE_HORIZON",
          participantId: participant.id,
          statedRanges: participant.declarations.map((d) => ({
            start: d.start,
            end: d.end,
          })),
        });
        continue;
      }
    }

    // Unavailable for every single window: the trip's dates simply don't work
    // for them, which is worth stating once rather than repeating per window.
    if (participant.declarations.length > 0 && input.windows.length > 0) {
      // Ask the resolver, not the raw declarations: a later AVAILABLE
      // overrides an earlier blanket UNAVAILABLE, which is exactly how
      // "only during school holidays" is expressed.
      const blockedEverywhere = input.windows.every(
        (w) =>
          assessParticipantWindow(participant.declarations, w).status ===
          "UNAVAILABLE",
      );
      if (blockedEverywhere) {
        diagnostics.push({
          kind: "BLOCKED_ACROSS_HORIZON",
          participantId: participant.id,
          availableElsewhere: participant.declarations
            .filter(
              (d) =>
                d.state === "AVAILABLE" &&
                !overlaps(d, input.horizonStart, input.horizonEnd),
            )
            .map((d) => ({ start: d.start, end: d.end })),
        });
        continue;
      }
    }

    // A leave cap that no window of this shape can satisfy is a mismatch with
    // the trip's length, not with any particular set of dates.
    if (participant.maxLeaveDays !== undefined && input.windows.length > 0) {
      const cap = participant.maxLeaveDays;
      if (windowLeave.every((leave) => leave > cap)) {
        diagnostics.push({
          kind: "LEAVE_CAP_BLOCKS_ALL",
          participantId: participant.id,
          maxLeaveDays: cap,
          cheapestWindowLeave,
          longestAffordableDays: longestAffordableDuration(
            input.horizonStart,
            input.horizonEnd,
            cap,
            input.publicHolidays,
          ),
        });
      }
    }
  }

  return diagnostics;
}
