import { describe, expect, it } from "vitest";
import { addDays, daySpan, eachDay, isValidIsoDate } from "./dates.js";

describe("isValidIsoDate", () => {
  it("accepts real calendar dates", () => {
    expect(isValidIsoDate("2026-09-04")).toBe(true);
    expect(isValidIsoDate("2028-02-29")).toBe(true); // leap year
  });

  it("rejects malformed strings", () => {
    expect(isValidIsoDate("2026-9-4")).toBe(false);
    expect(isValidIsoDate("04-09-2026")).toBe(false);
    expect(isValidIsoDate("not a date")).toBe(false);
  });

  it("rejects impossible calendar dates", () => {
    expect(isValidIsoDate("2026-02-30")).toBe(false);
    expect(isValidIsoDate("2026-13-01")).toBe(false);
    expect(isValidIsoDate("2026-02-29")).toBe(false); // not a leap year
  });
});

describe("addDays", () => {
  it("adds within a month", () => {
    expect(addDays("2026-09-04", 3)).toBe("2026-09-07");
  });

  it("crosses month and year boundaries", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("subtracts with negative days", () => {
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30");
  });
});

describe("daySpan", () => {
  it("is 1 for a single day", () => {
    expect(daySpan("2026-11-21", "2026-11-21")).toBe(1);
  });

  it("counts inclusively — 21 to 25 Nov is a 5-day trip", () => {
    expect(daySpan("2026-11-21", "2026-11-25")).toBe(5);
  });

  it("spans month boundaries", () => {
    expect(daySpan("2026-09-28", "2026-10-02")).toBe(5);
  });
});

describe("eachDay", () => {
  it("returns every day inclusive of both ends", () => {
    expect(eachDay("2026-09-29", "2026-10-02")).toEqual([
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
    ]);
  });

  it("returns a single day when start equals end", () => {
    expect(eachDay("2026-11-21", "2026-11-21")).toEqual(["2026-11-21"]);
  });

  it("returns empty when end is before start", () => {
    expect(eachDay("2026-10-02", "2026-09-29")).toEqual([]);
  });
});
