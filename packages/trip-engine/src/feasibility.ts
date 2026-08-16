import type { ISODate } from "@timeaway/shared";
import type { WindowAssessment } from "./assessment.js";
import { assessParticipantWindow } from "./assessment.js";
import type { AvailabilityDeclaration } from "./availability.js";
import { leaveDaysRequired } from "./leave.js";
import type { CandidateWindow } from "./windows.js";

export interface WindowParticipant {
  /** Opaque to the engine — participant row id in practice. */
  id: string;
  /** Oldest first; latest declaration covering a date wins. */
  declarations: readonly AvailabilityDeclaration[];
  /**
   * Hard leave cap — "max 2 days leave" (brief section 10's
   * `available if leave_required <= 2`). Windows costing more leave than this
   * are UNAVAILABLE for the participant, and therefore infeasible.
   */
  maxLeaveDays?: number;
}

export interface ParticipantWindowVerdict extends WindowAssessment {
  participantId: string;
  /** True when the leave cap alone rules the window out for them. */
  exceedsLeaveCap: boolean;
}

export interface WindowCounts {
  available: number;
  maybe: number;
  unavailable: number;
  unanswered: number;
  /** MAYBE participants whose uncertainty includes UNKNOWN days —
   * the "? 1 roster pending" number. */
  rosterPending: number;
}

export interface EvaluatedWindow {
  window: CandidateWindow;
  /** Leave days the window costs (same for all participants — one shared
   * holiday calendar per trip at MVP). */
  leaveDays: number;
  participants: ParticipantWindowVerdict[];
  counts: WindowCounts;
  /**
   * A window is feasible unless someone explicitly cannot make it: any
   * participant UNAVAILABLE (declared days or leave cap) eliminates it.
   * MAYBE, UNKNOWN-driven MAYBE, and UNANSWERED never eliminate — planning
   * proceeds without unanimous certainty (brief section 10).
   */
  feasible: boolean;
}

export function evaluateWindow(
  window: CandidateWindow,
  participants: readonly WindowParticipant[],
  publicHolidays: ReadonlySet<ISODate>,
): EvaluatedWindow {
  const leaveDays = leaveDaysRequired(window.start, window.end, publicHolidays);

  const verdicts: ParticipantWindowVerdict[] = participants.map((p) => {
    const assessment = assessParticipantWindow(p.declarations, window);
    const exceedsLeaveCap =
      p.maxLeaveDays !== undefined && leaveDays > p.maxLeaveDays;
    return {
      participantId: p.id,
      status: exceedsLeaveCap ? "UNAVAILABLE" : assessment.status,
      dayCounts: assessment.dayCounts,
      exceedsLeaveCap,
    };
  });

  const counts: WindowCounts = {
    available: 0,
    maybe: 0,
    unavailable: 0,
    unanswered: 0,
    rosterPending: 0,
  };
  for (const v of verdicts) {
    if (v.status === "AVAILABLE") counts.available++;
    else if (v.status === "MAYBE") {
      counts.maybe++;
      if (v.dayCounts.unknown > 0) counts.rosterPending++;
    } else if (v.status === "UNAVAILABLE") counts.unavailable++;
    else counts.unanswered++;
  }

  return {
    window,
    leaveDays,
    participants: verdicts,
    counts,
    feasible: counts.unavailable === 0,
  };
}

export function evaluateWindows(
  windows: readonly CandidateWindow[],
  participants: readonly WindowParticipant[],
  publicHolidays: ReadonlySet<ISODate>,
): EvaluatedWindow[] {
  return windows.map((w) => evaluateWindow(w, participants, publicHolidays));
}
