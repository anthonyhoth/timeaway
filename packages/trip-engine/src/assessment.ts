import type { AvailabilityState } from "@timeaway/shared";
import type { AvailabilityDeclaration } from "./availability.js";
import { resolveDay } from "./availability.js";
import { eachDay } from "./dates.js";
import type { CandidateWindow } from "./windows.js";

/**
 * A participant's verdict for a whole candidate window. UNKNOWN never appears
 * at window level — an UNKNOWN day folds into MAYBE (founder ruling, see
 * docs/DECISIONS.md), but the day counts below preserve why, so display can
 * say "roster pending" instead of a generic "maybe".
 */
export type ParticipantWindowStatus =
  | "AVAILABLE"
  | "MAYBE"
  | "UNAVAILABLE"
  | "UNANSWERED";

export type WindowDayCounts = Record<Lowercase<AvailabilityState>, number>;

export interface WindowAssessment {
  status: ParticipantWindowStatus;
  dayCounts: WindowDayCounts;
}

/**
 * Classify one participant over a window (founder-decided semantics):
 *
 * - any UNAVAILABLE day        → UNAVAILABLE (dominates everything)
 * - else every day UNANSWERED  → UNANSWERED ("hasn't responded")
 * - else every day AVAILABLE   → AVAILABLE (strict: no exceptions)
 * - anything else              → MAYBE (maybe/unknown days, or partial answers)
 */
export function assessParticipantWindow(
  declarations: readonly AvailabilityDeclaration[],
  window: Pick<CandidateWindow, "start" | "end">,
): WindowAssessment {
  const dayCounts: WindowDayCounts = {
    available: 0,
    maybe: 0,
    unavailable: 0,
    unknown: 0,
    unanswered: 0,
  };
  let total = 0;
  for (const day of eachDay(window.start, window.end)) {
    const state = resolveDay(declarations, day);
    dayCounts[state.toLowerCase() as Lowercase<AvailabilityState>]++;
    total++;
  }

  let status: ParticipantWindowStatus;
  if (dayCounts.unavailable > 0) status = "UNAVAILABLE";
  else if (dayCounts.unanswered === total) status = "UNANSWERED";
  else if (dayCounts.available === total) status = "AVAILABLE";
  else status = "MAYBE";

  return { status, dayCounts };
}
