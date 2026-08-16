import type {
  AvailabilityState,
  DeclaredAvailabilityState,
  ISODate,
} from "@timeaway/shared";
import { eachDay } from "./dates.js";

/**
 * A participant's declared availability over an inclusive date range,
 * channel-independent: calendar taps and parsed natural language both reduce
 * to this shape before reaching the engine.
 */
export interface AvailabilityDeclaration {
  state: DeclaredAvailabilityState;
  /** Inclusive. */
  start: ISODate;
  /** Inclusive. A single day is start = end. */
  end: ISODate;
}

/**
 * Resolve one participant's state for a single date.
 *
 * Declarations must be in declaration order (oldest first); the latest
 * declaration covering the date wins, so "Can't do Sep 4–17" followed by
 * "actually Sep 10 works" resolves Sep 10 to AVAILABLE. A date covered by no
 * declaration is UNANSWERED — that state is only ever derived, never stored.
 */
export function resolveDay(
  declarations: readonly AvailabilityDeclaration[],
  date: ISODate,
): AvailabilityState {
  for (let i = declarations.length - 1; i >= 0; i--) {
    const d = declarations[i]!;
    if (d.start <= date && date <= d.end) return d.state;
  }
  return "UNANSWERED";
}

/**
 * Resolve every date in [start, end] (inclusive) to its five-state value.
 */
export function resolveRange(
  declarations: readonly AvailabilityDeclaration[],
  start: ISODate,
  end: ISODate,
): Map<ISODate, AvailabilityState> {
  const result = new Map<ISODate, AvailabilityState>();
  for (const day of eachDay(start, end)) {
    result.set(day, resolveDay(declarations, day));
  }
  return result;
}
