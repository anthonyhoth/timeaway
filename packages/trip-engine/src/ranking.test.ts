import { describe, expect, it } from "vitest";
import type { AvailabilityDeclaration } from "./availability.js";
import type { WindowParticipant } from "./feasibility.js";
import { evaluateWindow, evaluateWindows } from "./feasibility.js";
import { SG_PUBLIC_HOLIDAYS_2026 } from "./holidays-sg.js";
import { rankWindows } from "./ranking.js";
import { generateCandidateWindows } from "./windows.js";

const decl = (
  state: AvailabilityDeclaration["state"],
  start: string,
  end: string,
): AvailabilityDeclaration => ({ state, start, end });

describe("evaluateWindow", () => {
  const window = { start: "2026-11-07", end: "2026-11-11", days: 5 };

  it("computes leave and per-participant verdicts", () => {
    const result = evaluateWindow(
      window,
      [
        { id: "a", declarations: [decl("AVAILABLE", "2026-11-01", "2026-11-30")] },
        { id: "b", declarations: [decl("UNKNOWN", "2026-11-01", "2026-11-30")] },
        { id: "c", declarations: [] },
      ],
      SG_PUBLIC_HOLIDAYS_2026,
    );
    expect(result.leaveDays).toBe(2); // Deepavali weekend
    expect(result.counts).toEqual({
      available: 1,
      maybe: 1,
      unavailable: 0,
      unanswered: 1,
      rosterPending: 1,
    });
    expect(result.feasible).toBe(true);
  });

  it("one explicitly unavailable participant makes the window infeasible", () => {
    const result = evaluateWindow(
      window,
      [
        { id: "a", declarations: [decl("AVAILABLE", "2026-11-01", "2026-11-30")] },
        { id: "b", declarations: [decl("UNAVAILABLE", "2026-11-10", "2026-11-10")] },
      ],
      SG_PUBLIC_HOLIDAYS_2026,
    );
    expect(result.feasible).toBe(false);
    expect(result.counts.unavailable).toBe(1);
  });

  it("a leave cap acts as a hard constraint — 'max 2 days leave'", () => {
    const capped: WindowParticipant = {
      id: "c",
      declarations: [decl("AVAILABLE", "2026-11-01", "2026-11-30")],
      maxLeaveDays: 2,
    };
    // Mon 23 – Fri 27 Nov: 5 leave days, over the cap.
    const week = evaluateWindow(
      { start: "2026-11-23", end: "2026-11-27", days: 5 },
      [capped],
      SG_PUBLIC_HOLIDAYS_2026,
    );
    expect(week.participants[0]!.status).toBe("UNAVAILABLE");
    expect(week.participants[0]!.exceedsLeaveCap).toBe(true);
    expect(week.feasible).toBe(false);

    // Deepavali window costs 2 leave days — inside the cap.
    const deepavali = evaluateWindow(
      { start: "2026-11-07", end: "2026-11-11", days: 5 },
      [capped],
      SG_PUBLIC_HOLIDAYS_2026,
    );
    expect(deepavali.participants[0]!.status).toBe("AVAILABLE");
    expect(deepavali.feasible).toBe(true);
  });

  it("UNANSWERED participants never eliminate a window", () => {
    const result = evaluateWindow(window, [{ id: "silent", declarations: [] }], SG_PUBLIC_HOLIDAYS_2026);
    expect(result.feasible).toBe(true);
    expect(result.counts.unanswered).toBe(1);
  });
});

describe("rankWindows — proof-scenario shape", () => {
  // Horizon 2–15 Nov 2026, trip of 4–5 days. Deepavali observed Mon 9 Nov.
  //   P1: available the whole horizon
  //   P2: can't do 2–6 Nov, available 7–15
  //   P3: available 7–11, roster unknown 12–15
  const participants: WindowParticipant[] = [
    { id: "p1", declarations: [decl("AVAILABLE", "2026-11-02", "2026-11-15")] },
    {
      id: "p2",
      declarations: [
        decl("UNAVAILABLE", "2026-11-02", "2026-11-06"),
        decl("AVAILABLE", "2026-11-07", "2026-11-15"),
      ],
    },
    {
      id: "p3",
      declarations: [
        decl("AVAILABLE", "2026-11-07", "2026-11-11"),
        decl("UNKNOWN", "2026-11-12", "2026-11-15"),
      ],
    },
  ];

  const ranked = rankWindows(
    evaluateWindows(
      generateCandidateWindows({
        horizonStart: "2026-11-02",
        horizonEnd: "2026-11-15",
        durationMinDays: 4,
        durationMaxDays: 5,
      }),
      participants,
      SG_PUBLIC_HOLIDAYS_2026,
    ),
  );

  it("eliminates every window touching an unavailable day", () => {
    expect(ranked.every((r) => r.window.start >= "2026-11-07")).toBe(true);
  });

  it("puts the all-available, holiday-stacked window first", () => {
    // 7–10 Nov: everyone available, Sat+Sun(Deepavali)+Mon(observed)+Tue = 1 leave day.
    expect(ranked[0]!.window).toEqual({
      start: "2026-11-07",
      end: "2026-11-10",
      days: 4,
    });
    expect(ranked[0]!.leaveDays).toBe(1);
    expect(ranked[0]!.counts.available).toBe(3);
  });

  it("orders the rest by leave, then start, among all-available windows", () => {
    // Remaining all-available windows: 7–11 (2 leave) and 8–11 (2 leave);
    // earlier start breaks the tie.
    expect(ranked[1]!.window.start).toBe("2026-11-07");
    expect(ranked[1]!.window.days).toBe(5);
    expect(ranked[2]!.window).toMatchObject({ start: "2026-11-08", days: 4 });
  });

  it("ranks roster-pending windows below clear-cut ones, still feasible", () => {
    const pending = ranked.filter((r) => r.counts.rosterPending > 0);
    expect(pending.length).toBeGreaterThan(0);
    const firstPendingIndex = ranked.findIndex(
      (r) => r.counts.rosterPending > 0,
    );
    const lastFullIndex = ranked
      .map((r) => r.counts.available === 3)
      .lastIndexOf(true);
    expect(firstPendingIndex).toBeGreaterThan(lastFullIndex);
  });

  it("is independent of input order", () => {
    const windows = generateCandidateWindows({
      horizonStart: "2026-11-02",
      horizonEnd: "2026-11-15",
      durationMinDays: 4,
      durationMaxDays: 5,
    });
    const reversed = rankWindows(
      evaluateWindows([...windows].reverse(), participants, SG_PUBLIC_HOLIDAYS_2026),
    );
    expect(reversed.map((r) => r.window)).toEqual(ranked.map((r) => r.window));
  });
});
