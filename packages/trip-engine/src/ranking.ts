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

/**
 * Windows that fail only because someone is unavailable, ranked by how few
 * people they exclude.
 *
 * This is the conflict case the product exists for: when no window works for
 * everyone, "nothing found" is a useless answer. Naming the closest option and
 * who it excludes lets the group decide whether to drop a date or a person —
 * a decision Timeaway must surface, never make.
 */
export function rankNearMisses(
  evaluated: readonly EvaluatedWindow[],
): EvaluatedWindow[] {
  return evaluated
    .filter((e) => !e.feasible)
    .sort(
      (a, b) =>
        a.counts.unavailable - b.counts.unavailable || compareWindows(a, b),
    );
}

export interface RankedWindows {
  /** Windows everyone can make. */
  feasible: EvaluatedWindow[];
  /** Ranked fallbacks, populated only when nothing is feasible. */
  nearMisses: EvaluatedWindow[];
}

/**
 * The full picture for display: feasible windows when they exist, otherwise
 * the closest near-misses so the group still has something to act on.
 */
export function rankForDisplay(
  evaluated: readonly EvaluatedWindow[],
): RankedWindows {
  const feasible = rankWindows(evaluated);
  return {
    feasible,
    nearMisses: feasible.length > 0 ? [] : rankNearMisses(evaluated),
  };
}

/** Participants blocking a window, for "Mei can't make it" style copy. */
export function blockedParticipantIds(window: EvaluatedWindow): string[] {
  return window.participants
    .filter((p) => p.status === "UNAVAILABLE")
    .map((p) => p.participantId);
}
