import { describe, expect, it } from "vitest";
import { parseDurationRange, parseHorizon } from "./parse.js";

const TODAY = "2026-08-16";

describe("parseHorizon", () => {
  it("parses a month range ahead in the year", () => {
    expect(parseHorizon("Sep–Nov", TODAY)).toEqual({
      start: "2026-09-01",
      end: "2026-11-30",
    });
    expect(parseHorizon("sep-nov", TODAY)).toEqual({
      start: "2026-09-01",
      end: "2026-11-30",
    });
    expect(parseHorizon("September to November", TODAY)).toEqual({
      start: "2026-09-01",
      end: "2026-11-30",
    });
  });

  it("starts today when the range's first month is already underway", () => {
    expect(parseHorizon("Aug–Oct", TODAY)).toEqual({
      start: "2026-08-16",
      end: "2026-10-31",
    });
  });

  it("rolls past months into next year", () => {
    expect(parseHorizon("Jan–Mar", TODAY)).toEqual({
      start: "2027-01-01",
      end: "2027-03-31",
    });
  });

  it("wraps backwards ranges across the year boundary", () => {
    expect(parseHorizon("Nov–Feb", TODAY)).toEqual({
      start: "2026-11-01",
      end: "2027-02-28",
    });
  });

  it("parses a single month", () => {
    expect(parseHorizon("December", TODAY)).toEqual({
      start: "2026-12-01",
      end: "2026-12-31",
    });
  });

  it("honours an explicit year", () => {
    expect(parseHorizon("Sep–Nov 2027", TODAY)).toEqual({
      start: "2027-09-01",
      end: "2027-11-30",
    });
    expect(parseHorizon("Nov–Feb 2027", TODAY)).toEqual({
      start: "2026-11-01",
      end: "2027-02-28",
    });
  });

  it("parses explicit ISO date ranges, clamping starts in the past", () => {
    expect(parseHorizon("2026-09-01 to 2026-11-30", TODAY)).toEqual({
      start: "2026-09-01",
      end: "2026-11-30",
    });
    expect(parseHorizon("2026-08-01 to 2026-09-15", TODAY)).toEqual({
      start: "2026-08-16",
      end: "2026-09-15",
    });
  });

  it("rejects inverted, past, and unparseable input", () => {
    expect(parseHorizon("2026-11-30 to 2026-09-01", TODAY)).toBeNull();
    expect(parseHorizon("2026-01-01 to 2026-02-01", TODAY)).toBeNull();
    expect(parseHorizon("sometime soon", TODAY)).toBeNull();
    expect(parseHorizon("xy–zz", TODAY)).toBeNull();
    expect(parseHorizon("", TODAY)).toBeNull();
  });
});

describe("parseDurationRange", () => {
  it("parses ranges and single values, with or without 'days'", () => {
    expect(parseDurationRange("4-6")).toEqual({ min: 4, max: 6 });
    expect(parseDurationRange("4 – 6 days")).toEqual({ min: 4, max: 6 });
    expect(parseDurationRange("4 to 6")).toEqual({ min: 4, max: 6 });
    expect(parseDurationRange("5")).toEqual({ min: 5, max: 5 });
    expect(parseDurationRange("5 days")).toEqual({ min: 5, max: 5 });
  });

  it("rejects zero, inverted, oversized, and non-numeric input", () => {
    expect(parseDurationRange("0-3")).toBeNull();
    expect(parseDurationRange("6-4")).toBeNull();
    expect(parseDurationRange("31")).toBeNull();
    expect(parseDurationRange("a few")).toBeNull();
  });
});
