import type { ISODate } from "@timeaway/shared";
import { addDays, isValidIsoDate } from "./dates.js";

/**
 * A contiguous span of calendar days that could become the trip. Generation is
 * pure enumeration; feasibility (hard constraints) and ranking are separate
 * later stages — see brief section 8's pipeline.
 */
export interface CandidateWindow {
  /** Inclusive. */
  start: ISODate;
  /** Inclusive. */
  end: ISODate;
  /** Total days, counting both ends — 21 to 25 Nov is 5 days. */
  days: number;
}

export interface WindowGenerationInput {
  /** Organiser's rough travel period, inclusive on both ends. */
  horizonStart: ISODate;
  horizonEnd: ISODate;
  /** Duration range in days — "4–6 days", never a single number. A fixed
   * duration is expressed as min = max. */
  durationMinDays: number;
  durationMaxDays: number;
}

/**
 * Enumerate every window of an allowed duration that fits entirely inside the
 * horizon, ordered by start date, then by duration (shortest first).
 *
 * Returns [] when the horizon is shorter than the minimum duration — an empty
 * result is a valid planning answer, not an error. Invalid configuration
 * (malformed dates, inverted ranges, non-positive durations) throws instead:
 * those are caller bugs, not planning outcomes.
 */
export function generateCandidateWindows(
  input: WindowGenerationInput,
): CandidateWindow[] {
  const { horizonStart, horizonEnd, durationMinDays, durationMaxDays } = input;

  if (!isValidIsoDate(horizonStart) || !isValidIsoDate(horizonEnd)) {
    throw new RangeError(
      `Invalid horizon dates: ${horizonStart} – ${horizonEnd}`,
    );
  }
  if (horizonEnd < horizonStart) {
    throw new RangeError(
      `Horizon end ${horizonEnd} is before start ${horizonStart}`,
    );
  }
  if (
    !Number.isInteger(durationMinDays) ||
    !Number.isInteger(durationMaxDays) ||
    durationMinDays < 1 ||
    durationMaxDays < durationMinDays
  ) {
    throw new RangeError(
      `Invalid duration range: ${durationMinDays}–${durationMaxDays} days`,
    );
  }

  const windows: CandidateWindow[] = [];
  for (
    let start = horizonStart;
    start <= horizonEnd;
    start = addDays(start, 1)
  ) {
    for (let days = durationMinDays; days <= durationMaxDays; days++) {
      const end = addDays(start, days - 1);
      if (end > horizonEnd) break;
      windows.push({ start, end, days });
    }
  }
  return windows;
}
