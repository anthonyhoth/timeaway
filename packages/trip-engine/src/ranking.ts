import type { EvaluatedWindow } from "./feasibility.js";

/**
 * Founder-confirmed lexicographic order — every position is explainable in
 * one sentence, no weighted scores (docs/DECISIONS.md):
 *
 * 1. most participants clear-cut AVAILABLE
 * 2. fewest leave days required
 * 3. fewest roster-pending participants (UNKNOWN-driven MAYBE)
 * 4. fewest MAYBE participants overall
 * 5. earliest start date
 * 6. shortest duration
 */
export function compareWindows(a: EvaluatedWindow, b: EvaluatedWindow): number {
  if (a.counts.available !== b.counts.available)
    return b.counts.available - a.counts.available;
  if (a.leaveDays !== b.leaveDays) return a.leaveDays - b.leaveDays;
  if (a.counts.rosterPending !== b.counts.rosterPending)
    return a.counts.rosterPending - b.counts.rosterPending;
  if (a.counts.maybe !== b.counts.maybe) return a.counts.maybe - b.counts.maybe;
  if (a.window.start !== b.window.start)
    return a.window.start < b.window.start ? -1 : 1;
  return a.window.days - b.window.days;
}

/** Feasible windows only, best first. Input order never affects output. */
export function rankWindows(
  evaluated: readonly EvaluatedWindow[],
): EvaluatedWindow[] {
  return evaluated.filter((e) => e.feasible).sort(compareWindows);
}
