import { describe, expect, it } from "vitest";
import { assessDemand } from "./demand.js";

const NO_HOLIDAYS: ReadonlySet<string> = new Set();

describe("assessDemand", () => {
  it("reads LOW for a window clear of school and public holidays", () => {
    const result = assessDemand("2026-10-12", "2026-10-16", NO_HOLIDAYS);
    expect(result.tier).toBe("LOW");
    expect(result.pressure).toBe(0);
    expect(result.reasons).toEqual([]);
  });

  it("reads PEAK inside the June school holidays", () => {
    const result = assessDemand("2026-06-10", "2026-06-15", NO_HOLIDAYS);
    expect(result.tier).toBe("PEAK");
    expect(result.reasons).toContain("June school holidays");
  });

  it("reads PEAK inside the year-end school holidays", () => {
    const result = assessDemand("2026-12-20", "2026-12-26", NO_HOLIDAYS);
    expect(result.tier).toBe("PEAK");
    expect(result.reasons).toContain("year-end school holidays");
  });

  it("scales with partial overlap", () => {
    // 28 Nov – 2 Dec: entirely inside the year-end block (from 16 Nov).
    expect(assessDemand("2026-11-28", "2026-12-02", NO_HOLIDAYS).pressure).toBe(1);
    // 12–16 Nov: only 16 Nov falls inside.
    const partial = assessDemand("2026-11-12", "2026-11-16", NO_HOLIDAYS);
    expect(partial.pressure).toBeCloseTo(0.2, 5);
    expect(partial.tier).toBe("SHOULDER");
  });

  it("counts public holidays as demand pressure", () => {
    // Deepavali observed Monday 9 Nov 2026.
    const result = assessDemand("2026-11-07", "2026-11-10");
    expect(result.reasons).toContain("public holiday weekend");
    expect(result.tier).not.toBe("LOW");
  });

  it("is explainable — every reason names a real calendar cause", () => {
    const result = assessDemand("2026-06-01", "2026-06-05", NO_HOLIDAYS);
    expect(result.reasons.length).toBeGreaterThan(0);
    for (const reason of result.reasons) {
      expect(reason).toMatch(/school holidays|public holiday/);
    }
  });
});
