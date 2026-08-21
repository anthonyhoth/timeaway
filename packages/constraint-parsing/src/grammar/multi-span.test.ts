import { describe, expect, it } from "vitest";
import { parseAvailabilityMessage } from "./availability.js";
import { parseSpanList } from "./multi-span.js";

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
    const spans = parseSpanList("nov 1st week and last week", "2026-08-17")!;
    expect(spans.map((s) => s.range)).toEqual([
      { start: "2026-11-01", end: "2026-11-07" },
      { start: "2026-11-24", end: "2026-11-30" },
    ]);
    // Neither segment states a direction of its own, so both defer to the
    // message's.
    expect(spans.map((s) => s.state)).toEqual([null, null]);
  });

  it("carries the message's direction into spans that state none", () => {
    // Was "applies one direction to every span". A shared direction is the
    // *default*, not the rule — see the mixed-answer cases below.
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
      parseSpanList("nov 1st week and sometime after that", "2026-08-17"),
    ).toBeNull();
  });

  it("leaves a single period to the single-reference path", () => {
    // That path knows about restrictions and roster-pending; this one does not.
    expect(parseSpanList("free in november", "2026-08-17")).toBeNull();
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

/**
 * A list where the answers *differ*.
 *
 * `parseSpanList` resolved each segment's dates separately and then stamped a
 * single state across all of them. That is right for the founder's example
 * above, where one direction governs the whole list, and wrong the moment
 * somebody says no to one month and yes to the next — the second month is
 * recorded as the opposite of what they said.
 *
 * The colon form has read per-entry states since the third sweep. This is the
 * same shape written with commas and full stops, which is how people write it.
 */
describe("a list can hold more than one answer", () => {
  const dates = (text: string) => parseAvailabilityMessage(text, ctx)?.declarations;

  it("does not record an offered month as blocked", () => {
    expect(dates("nov cannot, dec can")).toEqual([
      { state: "UNAVAILABLE", start: "2026-11-01", end: "2026-11-30" },
      { state: "AVAILABLE", start: "2026-12-01", end: "2026-12-31" },
    ]);
  });

  it("reads a segment's own answer in either direction", () => {
    expect(dates("nov can, dec cannot")).toEqual([
      { state: "AVAILABLE", start: "2026-11-01", end: "2026-11-30" },
      { state: "UNAVAILABLE", start: "2026-12-01", end: "2026-12-31" },
    ]);
  });

  it("reads the free/busy form people paste", () => {
    expect(dates("free: 20-30 nov / busy: 1-19 nov")).toEqual([
      { state: "AVAILABLE", start: "2026-11-20", end: "2026-11-30" },
      { state: "UNAVAILABLE", start: "2026-11-01", end: "2026-11-19" },
    ]);
  });

  it("splits on a full stop, so a third entry is not swallowed", () => {
    // "mar cmi, ... apr can. may can" kept two entries and lost May, because
    // only the comma split and the rest of the message stayed one segment.
    expect(dates("nov cmi. dec can")).toEqual([
      { state: "UNAVAILABLE", start: "2026-11-01", end: "2026-11-30" },
      { state: "AVAILABLE", start: "2026-12-01", end: "2026-12-31" },
    ]);
  });

  it("keeps a slash date intact rather than splitting inside it", () => {
    // "/" separates segments only with space around it. Without that guard
    // "12/12" became the segments "12" and "12".
    expect(dates("cmi 12/12-15/12 and 20/12-25/12")).toEqual([
      { state: "UNAVAILABLE", start: "2026-12-12", end: "2026-12-15" },
      { state: "UNAVAILABLE", start: "2026-12-20", end: "2026-12-25" },
    ]);
  });

  it("does not split inside a decimal", () => {
    // A full stop splits only at a sentence boundary, so "1.5k" survives. Were
    // it split, "5k" would be a date-bearing segment nothing can resolve and
    // the whole list would decline.
    expect(
      parseSpanList("nov 1st week 1.5k and dec 3rd week", "2026-08-17"),
    ).toHaveLength(2);
  });

  /**
   * The safety rule, extended. A segment that resolves a date but states no
   * direction of its own normally inherits the message's — safe when it is a
   * bare period, and not safe when the segment carries language that restricts
   * or flips its meaning. "Jan: after the 15th only" would inherit "cannot"
   * from the sentences before it and record the whole of January as blocked,
   * when the speaker was offering the second half of it.
   */
  it("declines rather than inherit a direction onto a restricted segment", () => {
    expect(dates("nov: cannot. dec: cannot. jan: after the 15th only")).toBeUndefined();
  });

  it("still inherits onto a plain bare period", () => {
    expect(dates("cmi nov and dec")).toEqual([
      { state: "UNAVAILABLE", start: "2026-11-01", end: "2026-11-30" },
      { state: "UNAVAILABLE", start: "2026-12-01", end: "2026-12-31" },
    ]);
  });

  it("carries a label across the bare items under it", () => {
    // The middle window states nothing and belongs to the "free" list, not to
    // the message as a whole — which reads as "busy" and blocked it out.
    expect(dates("free: 1-8 nov, 20-30 nov / busy: 9-19 nov")).toEqual([
      { state: "AVAILABLE", start: "2026-11-01", end: "2026-11-08" },
      { state: "AVAILABLE", start: "2026-11-20", end: "2026-11-30" },
      { state: "UNAVAILABLE", start: "2026-11-09", end: "2026-11-19" },
    ]);
  });

  it("keeps a hedge across the whole list", () => {
    // The injected reader has to be the caller's *full* one: the bare intent
    // would call this a firm yes the group could plan around.
    expect(dates("should be can nov and dec")).toEqual([
      { state: "MAYBE", start: "2026-11-01", end: "2026-11-30" },
      { state: "MAYBE", start: "2026-12-01", end: "2026-12-31" },
    ]);
  });

  it("reads the terse answer tokens the colon form uses", () => {
    // Shared vocabulary with parseSelfStatingList rather than a second copy:
    // "no" and "yes" are not availability words anywhere else in the grammar.
    expect(dates("nov: no. dec: yes")).toEqual([
      { state: "UNAVAILABLE", start: "2026-11-01", end: "2026-11-30" },
      { state: "AVAILABLE", start: "2026-12-01", end: "2026-12-31" },
    ]);
  });
});
