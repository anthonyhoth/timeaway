import { describe, expect, it } from "vitest";
import { resolveReversal, type ReversibleFact } from "./reversal.js";

const at = (minutesAgo: number): Date =>
  new Date(Date.UTC(2026, 7, 17, 12, 0, 0) - minutesAgo * 60_000);

const fact = (
  kind: ReversibleFact["kind"],
  minutesAgo: number,
  label = kind,
): ReversibleFact => ({ kind, id: `${kind}-${minutesAgo}`, label, recordedAt: at(minutesAgo) });

describe("resolveReversal", () => {
  it("does nothing when the speaker has said nothing yet", () => {
    expect(resolveReversal([])).toEqual({ action: "nothing" });
  });

  it("withdraws the only thing on record", () => {
    const only = fact("declaration", 2);
    expect(resolveReversal([only])).toEqual({ action: "undo", fact: only });
  });

  it("withdraws the most recent when they are all the same kind", () => {
    // "I can do June" then "not 14-18 June" then "nvm" — the ordinary reading
    // of "that" is the thing said last.
    const older = fact("declaration", 6);
    const newer = fact("declaration", 1);
    expect(resolveReversal([older, newer])).toEqual({
      action: "undo",
      fact: newer,
    });
  });

  it("asks when one conversational moment mixed several kinds", () => {
    const result = resolveReversal([
      fact("note", 4),
      fact("declaration", 2),
      fact("leaveCap", 1),
    ]);
    expect(result.action).toBe("ask");
    expect(result.action === "ask" && result.options.map((o) => o.kind)).toEqual(
      ["leaveCap", "declaration", "note"],
    );
  });

  it("offers only the newest of each kind, not every row", () => {
    const result = resolveReversal([
      fact("declaration", 5),
      fact("declaration", 3),
      fact("note", 1),
    ]);
    expect(result.action === "ask" && result.options).toHaveLength(2);
  });

  it("treats an old fact as unambiguous however mixed the history", () => {
    // A note from last week is not part of today's statement, so "nvm" plainly
    // refers to the dates just given.
    const result = resolveReversal([
      fact("note", 60 * 24 * 7),
      fact("declaration", 1),
    ]);
    expect(result).toMatchObject({ action: "undo", fact: { kind: "declaration" } });
  });

  it("never withdraws more than one fact", () => {
    const result = resolveReversal([fact("declaration", 2), fact("declaration", 1)]);
    expect(result.action).toBe("undo");
  });
});
