import { describe, expect, it } from "vitest";
import { parseAvailabilityMessage } from "./availability.js";
import { parseMultiSpan } from "./multi-span.js";

const ctx = {
  today: "2026-08-17" as const,
  horizonStart: "2026-10-01" as const,
  horizonEnd: "2026-12-31" as const,
  destination: null,
};

const totalDays = (ranges: readonly { start: string; end: string }[]) =>
  ranges.reduce(
    (n, r) => n + (Date.parse(r.end) - Date.parse(r.start)) / 86_400_000 + 1,
    0,
  );

/**
 * Only the first span used to be recorded and the rest dropped in silence —
 * an under-claim, and in one way worse than over-claiming: the message got its
 * ✍, so the speaker believed all five weeks had landed while the card was
 * built from two.
 */
describe("several periods in one message", () => {
  const message =
    "free in oct last 2 weeks, nov 1st week and last week and dec 3rd week";

  it("records every span the founder's example names", () => {
    expect(parseAvailabilityMessage(message, ctx)?.declarations).toEqual([
      { state: "AVAILABLE", start: "2026-10-18", end: "2026-10-31" },
      { state: "AVAILABLE", start: "2026-11-01", end: "2026-11-07" },
      { state: "AVAILABLE", start: "2026-11-24", end: "2026-11-30" },
      { state: "AVAILABLE", start: "2026-12-15", end: "2026-12-21" },
    ]);
  });

  it("adds up to the five weeks that were stated", () => {
    const declarations = parseAvailabilityMessage(message, ctx)!.declarations;
    expect(totalDays(declarations)).toBe(35);
  });

  it("carries the month across a bare qualifier", () => {
    // "nov 1st week and last week" names November once and means it twice.
    const spans = parseMultiSpan("nov 1st week and last week", "2026-08-17")!;
    expect(spans).toEqual([
      { start: "2026-11-01", end: "2026-11-07" },
      { start: "2026-11-24", end: "2026-11-30" },
    ]);
  });

  it("applies one direction to every span", () => {
    expect(
      parseAvailabilityMessage("cmi nov 1st week and dec 3rd week", ctx)
        ?.declarations,
    ).toEqual([
      { state: "UNAVAILABLE", start: "2026-11-01", end: "2026-11-07" },
      { state: "UNAVAILABLE", start: "2026-12-15", end: "2026-12-21" },
    ]);
  });

  it("declines the whole list when one segment cannot be read", () => {
    // Half a list is not safer than none — nobody can see which half was kept.
    expect(
      parseMultiSpan("nov 1st week and sometime after that", "2026-08-17"),
    ).toBeNull();
  });

  it("leaves a single period to the single-reference path", () => {
    // That path knows about restrictions and roster-pending; this one does not.
    expect(parseMultiSpan("free in november", "2026-08-17")).toBeNull();
    expect(parseAvailabilityMessage("free in november", ctx)?.declarations).toEqual([
      { state: "AVAILABLE", start: "2026-11-01", end: "2026-11-30" },
    ]);
  });

  it("does not disturb a leave cap stated alongside open availability", () => {
    // The comma here is not a list of periods.
    const parsed = parseAvailabilityMessage("got 12 days leave, anytime works", ctx);
    expect(parsed?.maxLeaveDays).toBe(12);
    expect(parsed?.declarations).toEqual([
      { state: "AVAILABLE", start: "2026-10-01", end: "2026-12-31" },
    ]);
  });
});
