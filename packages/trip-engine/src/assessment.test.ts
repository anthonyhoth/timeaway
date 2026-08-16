import { describe, expect, it } from "vitest";
import { assessParticipantWindow } from "./assessment.js";
import type { AvailabilityDeclaration } from "./availability.js";

const decl = (
  state: AvailabilityDeclaration["state"],
  start: string,
  end: string,
): AvailabilityDeclaration => ({ state, start, end });

const NOV_21_25 = { start: "2026-11-21", end: "2026-11-25" };

describe("assessParticipantWindow", () => {
  it("AVAILABLE only when every single day is explicitly AVAILABLE", () => {
    const { status, dayCounts } = assessParticipantWindow(
      [decl("AVAILABLE", "2026-11-01", "2026-11-30")],
      NOV_21_25,
    );
    expect(status).toBe("AVAILABLE");
    expect(dayCounts).toEqual({
      available: 5,
      maybe: 0,
      unavailable: 0,
      unknown: 0,
      unanswered: 0,
    });
  });

  it("one MAYBE day breaks clear-cut availability into MAYBE", () => {
    const { status } = assessParticipantWindow(
      [
        decl("AVAILABLE", "2026-11-01", "2026-11-30"),
        decl("MAYBE", "2026-11-23", "2026-11-23"),
      ],
      NOV_21_25,
    );
    expect(status).toBe("MAYBE");
  });

  it("one UNKNOWN day classifies the window as MAYBE, with the reason preserved", () => {
    const { status, dayCounts } = assessParticipantWindow(
      [
        decl("AVAILABLE", "2026-11-01", "2026-11-22"),
        decl("UNKNOWN", "2026-11-23", "2026-11-30"),
      ],
      NOV_21_25,
    );
    expect(status).toBe("MAYBE");
    // unknown count > 0 is what lets display say "roster pending", not "maybe"
    expect(dayCounts.unknown).toBe(3);
    expect(dayCounts.available).toBe(2);
  });

  it("one UNAVAILABLE day dominates everything else", () => {
    const { status } = assessParticipantWindow(
      [
        decl("AVAILABLE", "2026-11-01", "2026-11-30"),
        decl("UNAVAILABLE", "2026-11-25", "2026-11-25"),
      ],
      NOV_21_25,
    );
    expect(status).toBe("UNAVAILABLE");
  });

  it("UNAVAILABLE dominates even over UNKNOWN days", () => {
    const { status } = assessParticipantWindow(
      [
        decl("UNKNOWN", "2026-11-01", "2026-11-30"),
        decl("UNAVAILABLE", "2026-11-21", "2026-11-21"),
      ],
      NOV_21_25,
    );
    expect(status).toBe("UNAVAILABLE");
  });

  it("no declarations at all → UNANSWERED, not MAYBE", () => {
    const { status, dayCounts } = assessParticipantWindow([], NOV_21_25);
    expect(status).toBe("UNANSWERED");
    expect(dayCounts.unanswered).toBe(5);
  });

  it("partial answers with gaps → MAYBE, with the gap counted", () => {
    const { status, dayCounts } = assessParticipantWindow(
      [decl("AVAILABLE", "2026-11-21", "2026-11-23")],
      NOV_21_25,
    );
    expect(status).toBe("MAYBE");
    expect(dayCounts.available).toBe(3);
    expect(dayCounts.unanswered).toBe(2);
  });
});
