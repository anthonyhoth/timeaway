import { describe, expect, it } from "vitest";
import { parseDurationRange, resolveHorizon } from "./horizon.js";

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
    expect(parseDurationRange("a week")).toBeNull();
  });
});
