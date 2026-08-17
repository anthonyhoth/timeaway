/**
 * Deciding what a bare retraction refers to.
 *
 * "Actually nvm, I can't do that anymore" names no date, so the engine's
 * latest-declaration-wins rule has nothing to bite on. Something has to choose
 * a referent, and the choice must be conservative: silently deleting the wrong
 * constraint is worse than the constraint staying, because the speaker has been
 * told it was handled and will not say it again.
 *
 * Three cases, in increasing difficulty:
 *
 *   1. One recent fact          → withdraw it.
 *   2. Several of the same kind → withdraw the most recent. This is the
 *                                 ordinary chat reading of "that".
 *   3. Several different kinds  → genuinely ambiguous ("Bali sounds good /
 *                                 I can do 28-30 Jun / budget $800 / nvm").
 *                                 Ask, offering the newest of each kind.
 *
 * A retraction never withdraws more than one fact, and the caller must always
 * say what it withdrew — an invisible deletion is indistinguishable from the
 * bug it is meant to fix.
 */
export type ReversibleKind = "declaration" | "leaveCap" | "note";

export interface ReversibleFact {
  kind: ReversibleKind;
  /** Absent for the leave cap, which is a column rather than a row. */
  id?: string;
  /** Human-readable, shown back to the speaker so the undo is visible. */
  label: string;
  recordedAt: Date;
}

export type ReversalResolution =
  | { action: "undo"; fact: ReversibleFact }
  | { action: "ask"; options: ReversibleFact[] }
  | { action: "nothing" };

/**
 * Facts recorded within this of the newest are treated as one conversational
 * moment. Someone listing a destination, their dates and their budget across a
 * few messages is making one statement, so "nvm" is ambiguous across all of it.
 * Beyond the window, the newest fact stands alone as the obvious referent.
 */
const BURST_MS = 10 * 60 * 1000;

export function resolveReversal(facts: ReversibleFact[]): ReversalResolution {
  if (facts.length === 0) return { action: "nothing" };

  const byRecency = [...facts].sort(
    (a, b) => b.recordedAt.getTime() - a.recordedAt.getTime(),
  );
  const newest = byRecency[0]!;

  const burst = byRecency.filter(
    (f) => newest.recordedAt.getTime() - f.recordedAt.getTime() <= BURST_MS,
  );

  // Keep only the newest of each kind: offering someone three of their own
  // date ranges to choose between is a worse question than picking the latest.
  const newestOfKind = new Map<ReversibleKind, ReversibleFact>();
  for (const fact of burst) {
    if (!newestOfKind.has(fact.kind)) newestOfKind.set(fact.kind, fact);
  }

  if (newestOfKind.size <= 1) return { action: "undo", fact: newest };
  return { action: "ask", options: [...newestOfKind.values()] };
}
