import { describe, expect, it } from "vitest";
import { parseAvailabilityMessage } from "./availability.js";
import { namesClosedRange, statesOpenEndedFloor } from "./date-shape.js";
import { resolveHorizon } from "./horizon.js";

const today = "2026-08-21" as const;
const ctx = {
  today,
  horizonStart: "2026-10-01" as const,
  horizonEnd: "2027-06-30" as const,
  destination: null,
};
const dates = (text: string) => parseAvailabilityMessage(text, ctx)?.declarations;

/**
 * The shape of a date reference — where it starts, where it ends, and whether
 * anything is allowed to move those edges.
 *
 * Three sweeps have now found the same fix living in one parser and missing
 * from another. The open-ended floor was fixed in `resolveHorizon` in the first
 * sweep; the third sweep found availability reading "dec 12 onwards" as the
 * 12th of December, because availability resolves its own dates and never got
 * it. Both readings live in date-shape.ts now, for the same reason stance.ts
 * exists.
 */
describe("an open-ended floor is not a single day", () => {
  it("reads a floor as running to the end of its month", () => {
    // Three weeks of offered availability, recorded as one day.
    expect(dates("dec 12 onwards i free")).toEqual([
      { state: "AVAILABLE", start: "2026-12-12", end: "2026-12-31" },
    ]);
  });

  it("gives the horizon path the same answer it already gave", () => {
    expect(resolveHorizon("so after 13 march can lor", today)).toEqual({
      start: "2027-03-13",
      end: "2027-03-31",
    });
  });

  it("recognises the shape directly", () => {
    expect(statesOpenEndedFloor("dec 12 onwards")).toBe(true);
    expect(statesOpenEndedFloor("after 13 march")).toBe(true);
    // A closed range names its own end; nothing to widen.
    expect(statesOpenEndedFloor("from 12 to 15 dec")).toBe(false);
    expect(statesOpenEndedFloor("12-15 dec")).toBe(false);
  });

  it("leaves a single date that means a single date alone", () => {
    expect(dates("cmi on the 12th dec")?.[0]).toMatchObject({
      start: "2026-12-12",
      end: "2026-12-12",
    });
  });
});

describe("a range with both ends stated cannot be narrowed", () => {
  /**
   * "Mid-year exam" is a noun phrase. Its "mid" was being applied to the range
   * beside it, trimming a day off each end of dates the speaker had given
   * exactly.
   */
  it("ignores a sub-period qualifier belonging to another noun", () => {
    expect(dates("may cannot leh. mid yr exam 10-21 may")).toEqual([
      { state: "UNAVAILABLE", start: "2027-05-10", end: "2027-05-21" },
    ]);
  });

  it("agrees with the same message without the qualifier", () => {
    expect(dates("exam 10-21 may")).toEqual([
      { state: "UNAVAILABLE", start: "2027-05-10", end: "2027-05-21" },
    ]);
  });

  it("recognises the shape directly", () => {
    expect(namesClosedRange("10-21 may")).toBe(true);
    expect(namesClosedRange("12/12-15/12")).toBe(true);
    expect(namesClosedRange("first 3 weeks of jan")).toBe(false);
    expect(namesClosedRange("mid december")).toBe(false);
  });

  it("still narrows when no range was stated", () => {
    // The qualifier is the only thing positioning these, so it must still win.
    expect(dates("cmi first 2 weeks of nov")?.[0]).toMatchObject({
      start: "2026-11-01",
      end: "2026-11-14",
    });
    expect(dates("busy mid december")?.[0]).toMatchObject({ start: "2026-12-11" });
  });
});
