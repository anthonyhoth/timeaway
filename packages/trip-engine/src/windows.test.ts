import { describe, expect, it } from "vitest";
import { generateCandidateWindows } from "./windows.js";

describe("generateCandidateWindows", () => {
  it("enumerates every window of every allowed duration inside the horizon", () => {
    const windows = generateCandidateWindows({
      horizonStart: "2026-11-01",
      horizonEnd: "2026-11-10",
      durationMinDays: 4,
      durationMaxDays: 6,
    });
    // 10-day horizon: 7 four-day + 6 five-day + 5 six-day starts.
    expect(windows).toHaveLength(18);
    expect(windows[0]).toEqual({
      start: "2026-11-01",
      end: "2026-11-04",
      days: 4,
    });
    expect(windows.at(-1)).toEqual({
      start: "2026-11-07",
      end: "2026-11-10",
      days: 4,
    });
  });

  it("never produces a window extending past the horizon end", () => {
    const windows = generateCandidateWindows({
      horizonStart: "2026-11-01",
      horizonEnd: "2026-11-10",
      durationMinDays: 4,
      durationMaxDays: 6,
    });
    expect(windows.every((w) => w.end <= "2026-11-10")).toBe(true);
  });

  it("orders by start date, then shortest duration first", () => {
    const windows = generateCandidateWindows({
      horizonStart: "2026-11-01",
      horizonEnd: "2026-11-06",
      durationMinDays: 4,
      durationMaxDays: 5,
    });
    expect(windows.map((w) => [w.start, w.days])).toEqual([
      ["2026-11-01", 4],
      ["2026-11-01", 5],
      ["2026-11-02", 4],
      ["2026-11-02", 5],
      ["2026-11-03", 4],
    ]);
  });

  it("supports a fixed duration as min = max", () => {
    const windows = generateCandidateWindows({
      horizonStart: "2026-11-21",
      horizonEnd: "2026-11-25",
      durationMinDays: 5,
      durationMaxDays: 5,
    });
    expect(windows).toEqual([
      { start: "2026-11-21", end: "2026-11-25", days: 5 },
    ]);
  });

  it("crosses month boundaries", () => {
    const windows = generateCandidateWindows({
      horizonStart: "2026-09-28",
      horizonEnd: "2026-10-03",
      durationMinDays: 6,
      durationMaxDays: 6,
    });
    expect(windows).toEqual([
      { start: "2026-09-28", end: "2026-10-03", days: 6 },
    ]);
  });

  it("returns empty when the horizon is shorter than the minimum duration", () => {
    expect(
      generateCandidateWindows({
        horizonStart: "2026-11-01",
        horizonEnd: "2026-11-03",
        durationMinDays: 4,
        durationMaxDays: 6,
      }),
    ).toEqual([]);
  });

  it("handles a single-day horizon with single-day duration", () => {
    expect(
      generateCandidateWindows({
        horizonStart: "2026-11-21",
        horizonEnd: "2026-11-21",
        durationMinDays: 1,
        durationMaxDays: 1,
      }),
    ).toEqual([{ start: "2026-11-21", end: "2026-11-21", days: 1 }]);
  });

  it("scales to a realistic Sep–Nov horizon without blowing up", () => {
    const windows = generateCandidateWindows({
      horizonStart: "2026-09-01",
      horizonEnd: "2026-11-30",
      durationMinDays: 4,
      durationMaxDays: 6,
    });
    // 91-day horizon: 88 + 87 + 86 windows.
    expect(windows).toHaveLength(261);
  });

  it("throws on malformed or inverted horizons", () => {
    expect(() =>
      generateCandidateWindows({
        horizonStart: "2026-11-31",
        horizonEnd: "2026-12-05",
        durationMinDays: 4,
        durationMaxDays: 6,
      }),
    ).toThrow(RangeError);
    expect(() =>
      generateCandidateWindows({
        horizonStart: "2026-11-10",
        horizonEnd: "2026-11-01",
        durationMinDays: 4,
        durationMaxDays: 6,
      }),
    ).toThrow(RangeError);
  });

  it("throws on invalid duration ranges", () => {
    const horizon = { horizonStart: "2026-11-01", horizonEnd: "2026-11-30" };
    expect(() =>
      generateCandidateWindows({ ...horizon, durationMinDays: 0, durationMaxDays: 3 }),
    ).toThrow(RangeError);
    expect(() =>
      generateCandidateWindows({ ...horizon, durationMinDays: 6, durationMaxDays: 4 }),
    ).toThrow(RangeError);
    expect(() =>
      generateCandidateWindows({ ...horizon, durationMinDays: 4.5, durationMaxDays: 6 }),
    ).toThrow(RangeError);
  });
});
