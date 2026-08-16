import { describe, expect, it } from "vitest";
import type { AvailabilityDeclaration } from "./availability.js";
import { diagnoseParticipants, longestAffordableDuration } from "./diagnostics.js";
import type { WindowParticipant } from "./feasibility.js";
import { SG_PUBLIC_HOLIDAYS } from "./holidays-sg.js";
import { generateCandidateWindows } from "./windows.js";

const decl = (
  state: AvailabilityDeclaration["state"],
  start: string,
  end: string,
): AvailabilityDeclaration => ({ state, start, end });

// A seven-day trip somewhere in November 2026.
const HORIZON = { start: "2026-11-01", end: "2026-11-30" };
const windows = generateCandidateWindows({
  horizonStart: HORIZON.start,
  horizonEnd: HORIZON.end,
  durationMinDays: 7,
  durationMaxDays: 7,
});

const run = (participants: WindowParticipant[]) =>
  diagnoseParticipants({
    participants,
    windows,
    horizonStart: HORIZON.start,
    horizonEnd: HORIZON.end,
    publicHolidays: SG_PUBLIC_HOLIDAYS,
  });

describe("ANSWERED_OUTSIDE_HORIZON", () => {
  it("catches someone who answered about dates this trip doesn't cover", () => {
    // "I can only travel in June" against a November trip.
    const [d] = run([
      { id: "mei", declarations: [decl("AVAILABLE", "2027-06-01", "2027-06-30")] },
    ]);
    expect(d).toMatchObject({
      kind: "ANSWERED_OUTSIDE_HORIZON",
      participantId: "mei",
    });
    expect(d!.kind === "ANSWERED_OUTSIDE_HORIZON" && d.statedRanges[0]).toEqual({
      start: "2027-06-01",
      end: "2027-06-30",
    });
  });

  it("stays quiet when some of what they said does overlap", () => {
    expect(
      run([
        {
          id: "dan",
          declarations: [
            decl("UNAVAILABLE", "2026-10-01", "2026-10-31"),
            decl("AVAILABLE", "2026-11-05", "2026-11-20"),
          ],
        },
      ]),
    ).toEqual([]);
  });

  it("stays quiet for someone who simply hasn't answered", () => {
    expect(run([{ id: "silent", declarations: [] }])).toEqual([]);
  });
});

describe("LEAVE_CAP_BLOCKS_ALL", () => {
  it("catches a leave cap no window of this length can satisfy", () => {
    // One leave day against a seven-day trip.
    const [d] = run([{ id: "dan", declarations: [], maxLeaveDays: 1 }]);
    expect(d).toMatchObject({
      kind: "LEAVE_CAP_BLOCKS_ALL",
      participantId: "dan",
      maxLeaveDays: 1,
    });
  });

  it("says what they could actually manage instead", () => {
    const [d] = run([{ id: "dan", declarations: [], maxLeaveDays: 1 }]);
    // Deepavali falls Sun 8 Nov with Mon 9 Nov observed, so a Sat–Tue break
    // costs a single leave day.
    expect(
      d!.kind === "LEAVE_CAP_BLOCKS_ALL" && d.longestAffordableDays,
    ).toBeGreaterThanOrEqual(3);
    expect(
      d!.kind === "LEAVE_CAP_BLOCKS_ALL" && d.longestAffordableDays,
    ).toBeLessThan(7);
  });

  it("stays quiet when the cap is generous enough for some window", () => {
    expect(run([{ id: "ana", declarations: [], maxLeaveDays: 10 }])).toEqual([]);
  });

  it("stays quiet when no cap was given", () => {
    expect(run([{ id: "ana", declarations: [] }])).toEqual([]);
  });
});

describe("longestAffordableDuration", () => {
  it("grows with the leave available", () => {
    const one = longestAffordableDuration(
      HORIZON.start,
      HORIZON.end,
      1,
      SG_PUBLIC_HOLIDAYS,
    );
    const five = longestAffordableDuration(
      HORIZON.start,
      HORIZON.end,
      5,
      SG_PUBLIC_HOLIDAYS,
    );
    expect(five).toBeGreaterThan(one);
  });

  it("still allows a weekend break on zero leave", () => {
    expect(
      longestAffordableDuration(HORIZON.start, HORIZON.end, 0, SG_PUBLIC_HOLIDAYS),
    ).toBeGreaterThanOrEqual(2);
  });
});

describe("BLOCKED_ACROSS_HORIZON", () => {
  it("flags someone whose only workable dates are outside the trip", () => {
    // "I can only travel in June" parses to a blanket block on the horizon
    // plus the June range they named.
    const [d] = run([
      {
        id: "mei",
        declarations: [
          decl("UNAVAILABLE", "2026-11-01", "2026-11-30"),
          decl("AVAILABLE", "2027-06-01", "2027-06-30"),
        ],
      },
    ]);
    expect(d).toMatchObject({ kind: "BLOCKED_ACROSS_HORIZON", participantId: "mei" });
    expect(
      d!.kind === "BLOCKED_ACROSS_HORIZON" && d.availableElsewhere[0],
    ).toEqual({ start: "2027-06-01", end: "2027-06-30" });
  });

  it("respects latest-wins rather than reading raw declarations", () => {
    // "Only during school holidays" blocks the horizon then carves a window
    // back in. That person is NOT blocked, and must not be flagged.
    expect(
      run([
        {
          id: "priya",
          declarations: [
            decl("UNAVAILABLE", "2026-11-01", "2026-11-30"),
            decl("AVAILABLE", "2026-11-15", "2026-12-31"),
          ],
        },
      ]),
    ).toEqual([]);
  });
});
