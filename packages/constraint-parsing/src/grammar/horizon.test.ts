import { describe, expect, it } from "vitest";
import {
  isUnknownAnswer,
  parseDurationRange,
  resolveHorizon,
} from "./horizon.js";

// Monday 17 Aug 2026.
const TODAY = "2026-08-17";
const r = (text: string) => resolveHorizon(text, TODAY);

describe("resolveHorizon — phrasings that failed in live testing", () => {
  it("accepts a bare year phrase", () => {
    expect(r("next year")).toEqual({ start: "2027-01-01", end: "2027-12-31" });
  });

  it("combines a year phrase with a month range", () => {
    // The whole point: this must be Jun–Jul 2027, not all of 2027.
    expect(r("next year around june-july")).toEqual({
      start: "2027-06-01",
      end: "2027-07-31",
    });
    expect(r("next year june to july")).toEqual({
      start: "2027-06-01",
      end: "2027-07-31",
    });
  });

  it("still handles the forms that already worked", () => {
    expect(r("Sep–Nov")).toEqual({ start: "2026-09-01", end: "2026-11-30" });
    expect(r("December")).toEqual({ start: "2026-12-01", end: "2026-12-31" });
    expect(r("2026-09-01 to 2026-11-30")).toEqual({
      start: "2026-09-01",
      end: "2026-11-30",
    });
  });

  it("rolls a past month forward to next year", () => {
    // June 2026 is behind us on 17 Aug.
    expect(r("june-july")).toEqual({ start: "2027-06-01", end: "2027-07-31" });
  });

  it("accepts fuzzy periods the wizard previously rejected", () => {
    expect(r("year end")).toEqual({ start: "2026-11-15", end: "2027-01-05" });
    expect(r("q1 2027")).toEqual({ start: "2027-01-01", end: "2027-03-31" });
    expect(r("mid-year")).toEqual({ start: "2027-05-15", end: "2027-07-15" });
  });

  it("accepts relative expressions", () => {
    expect(r("next month")).toEqual({ start: "2026-09-01", end: "2026-09-30" });
  });

  it("honours an explicit year alongside months", () => {
    expect(r("june july 2028")).toEqual({
      start: "2028-06-01",
      end: "2028-07-31",
    });
  });

  it("returns null on genuinely unparseable input", () => {
    expect(r("sometime whenever")).toBeNull();
    expect(r("")).toBeNull();
  });
});

describe("parseDurationRange", () => {
  it("accepts a bare range, which the wizard step needs", () => {
    expect(parseDurationRange("4-6")).toEqual({ min: 4, max: 6 });
    expect(parseDurationRange("4–6")).toEqual({ min: 4, max: 6 });
    expect(parseDurationRange("4 to 6")).toEqual({ min: 4, max: 6 });
    expect(parseDurationRange("5")).toEqual({ min: 5, max: 5 });
    expect(parseDurationRange("5 days")).toEqual({ min: 5, max: 5 });
  });

  it("rejects nonsense", () => {
    expect(parseDurationRange("0-3")).toBeNull();
    expect(parseDurationRange("6-4")).toBeNull();
    expect(parseDurationRange("99")).toBeNull();
    expect(parseDurationRange("banana")).toBeNull();
  });
});

describe("isUnknownAnswer — every wizard step needs this", () => {
  it("recognises the ways people say they don't know", () => {
    for (const t of [
      "idk yet", "idk", "dunno", "dunno leh", "not sure", "no idea",
      "don't know", "tbc", "whatever", "up to you", "flexible", "no preference",
    ]) {
      expect(isUnknownAnswer(t)).toBe(true);
    }
  });

  it("does not swallow real answers", () => {
    // "Open" alone means undecided, but a real place must never be mistaken
    // for one — this is what turned "idk yet" into a trip to "Idk Yet".
    for (const t of ["Japan", "Korea/Japan", "4-6", "a week", "Sep–Nov", "New Zealand"]) {
      expect(isUnknownAnswer(t)).toBe(false);
    }
  });
});

describe("parseDurationRange — phrasings from live testing", () => {
  it("understands named durations", () => {
    expect(parseDurationRange("a week")).toEqual({ min: 7, max: 7 });
    expect(parseDurationRange("long weekend")).toEqual({ min: 3, max: 4 });
    expect(parseDurationRange("weekend")).toEqual({ min: 2, max: 3 });
    expect(parseDurationRange("two weeks")).toEqual({ min: 14, max: 14 });
  });

  it("tolerates hedging", () => {
    expect(parseDurationRange("about 5")).toEqual({ min: 5, max: 5 });
    expect(parseDurationRange("5ish")).toEqual({ min: 5, max: 5 });
    expect(parseDurationRange("maybe 4 to 6 days")).toEqual({ min: 4, max: 6 });
    expect(parseDurationRange("roughly a week")).toEqual({ min: 7, max: 7 });
  });

  it("understands spelled-out numbers", () => {
    expect(parseDurationRange("four to six")).toEqual({ min: 4, max: 6 });
    expect(parseDurationRange("five days")).toEqual({ min: 5, max: 5 });
  });

  it("returns null for don't-know, which the caller handles separately", () => {
    expect(parseDurationRange("idk yet")).toBeNull();
  });
});

/**
 * Reported live: a trip started in a group assumed a 2026 window, and answering
 * for 2027 left the group with "no dates". Part of that was the wizard flatly
 * rejecting the clearest answer someone can give to "roughly when?".
 */
describe("a bare year is a horizon", () => {
  const today = "2026-08-17" as const;

  it("accepts a year on its own", () => {
    expect(resolveHorizon("2027", today)).toEqual({
      start: "2027-01-01",
      end: "2027-12-31",
    });
    expect(resolveHorizon("in 2027", today)).toEqual({
      start: "2027-01-01",
      end: "2027-12-31",
    });
  });

  it("starts a year already under way from today, not January", () => {
    expect(resolveHorizon("2026", today)).toEqual({
      start: "2026-08-17",
      end: "2026-12-31",
    });
    expect(resolveHorizon("this year", today)?.start).toBe("2026-08-17");
  });

  it("still lets a month inside the year win", () => {
    // The year is a hint, not the answer, when something narrower is said.
    expect(resolveHorizon("dec 2027", today)).toEqual({
      start: "2027-12-01",
      end: "2027-12-31",
    });
    expect(resolveHorizon("next year june", today)?.start).toBe("2027-06-01");
  });

  it("still declines a non-answer", () => {
    expect(resolveHorizon("idk", today)).toBeNull();
    expect(resolveHorizon("hahaha", today)).toBeNull();
  });
});
