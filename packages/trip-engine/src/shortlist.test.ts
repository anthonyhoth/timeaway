import { describe, expect, it } from "vitest";
import { evaluateWindows } from "./feasibility.js";
import { SG_PUBLIC_HOLIDAYS } from "./holidays-sg.js";
import { rankForDisplay } from "./ranking.js";
import { selectDiverseWindows, separationDays } from "./shortlist.js";
import { generateCandidateWindows } from "./windows.js";

/** A year-long horizon with one person free throughout. */
const ranked = rankForDisplay(
  evaluateWindows(
    generateCandidateWindows({
      horizonStart: "2027-01-01",
      horizonEnd: "2027-12-31",
      durationMinDays: 5,
      durationMaxDays: 7,
    }),
    [
      {
        id: "a",
        declarations: [
          { state: "AVAILABLE", start: "2027-01-01", end: "2027-12-31" },
        ],
      },
    ],
    SG_PUBLIC_HOLIDAYS,
  ),
).feasible;

describe("separationDays", () => {
  it("is negative for overlapping windows", () => {
    expect(
      separationDays(
        { start: "2027-02-04", end: "2027-02-08" },
        { start: "2027-02-06", end: "2027-02-10" },
      ),
    ).toBe(-1);
  });

  it("counts the clear days between windows", () => {
    expect(
      separationDays(
        { start: "2027-02-01", end: "2027-02-05" },
        { start: "2027-02-09", end: "2027-02-13" },
      ),
    ).toBe(3);
  });

  it("is order-independent", () => {
    const a = { start: "2027-03-01", end: "2027-03-05" };
    const b = { start: "2027-05-01", end: "2027-05-05" };
    expect(separationDays(a, b)).toBe(separationDays(b, a));
  });
});

describe("selectDiverseWindows", () => {
  it("returns the requested number when the horizon allows", () => {
    expect(selectDiverseWindows(ranked, 5)).toHaveLength(5);
    expect(selectDiverseWindows(ranked, 3)).toHaveLength(3);
  });

  it("never returns overlapping windows — the actual bug", () => {
    // Plain ranking gave 4–8 Feb, 5–9 Feb and 6–10 Feb: the same week thrice.
    const picked = selectDiverseWindows(ranked, 5);
    for (let i = 0; i < picked.length; i++) {
      for (let j = i + 1; j < picked.length; j++) {
        expect(
          separationDays(picked[i]!.window, picked[j]!.window),
        ).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("spreads options across the year when it can", () => {
    const months = new Set(
      selectDiverseWindows(ranked, 5).map((w) => w.window.start.slice(0, 7)),
    );
    expect(months.size).toBe(5);
  });

  it("keeps the best-ranked option first", () => {
    expect(selectDiverseWindows(ranked, 5)[0]).toEqual(ranked[0]);
  });

  it("clusters rather than fails when only one stretch works", () => {
    const narrow = rankForDisplay(
      evaluateWindows(
        generateCandidateWindows({
          horizonStart: "2027-03-01",
          horizonEnd: "2027-03-20",
          durationMinDays: 5,
          durationMaxDays: 5,
        }),
        [
          {
            id: "a",
            declarations: [
              { state: "AVAILABLE", start: "2027-03-01", end: "2027-03-20" },
            ],
          },
        ],
        SG_PUBLIC_HOLIDAYS,
      ),
    ).feasible;

    const picked = selectDiverseWindows(narrow, 5);
    expect(picked.length).toBeGreaterThan(1);
    for (let i = 0; i < picked.length; i++) {
      for (let j = i + 1; j < picked.length; j++) {
        expect(
          separationDays(picked[i]!.window, picked[j]!.window),
        ).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("handles degenerate input", () => {
    expect(selectDiverseWindows([], 5)).toEqual([]);
    expect(selectDiverseWindows(ranked, 0)).toEqual([]);
  });
});
