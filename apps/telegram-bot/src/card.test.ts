import type { ParticipantPlanningState } from "@timeaway/database";
import {
  evaluateWindows,
  generateCandidateWindows,
  rankForDisplay,
  SG_PUBLIC_HOLIDAYS_2026,
} from "@timeaway/trip-engine";
import { describe, expect, it } from "vitest";
import { renderTripCard } from "./card.js";

const person = (
  id: string,
  displayName: string,
  declarations: ParticipantPlanningState["declarations"] = [],
  maxLeaveDays: number | null = null,
): ParticipantPlanningState => ({
  participantId: id,
  displayName,
  isOrganiser: id === "p1",
  maxLeaveDays,
  declarations,
});

function build(participants: ParticipantPlanningState[]) {
  const windows = generateCandidateWindows({
    horizonStart: "2026-11-02",
    horizonEnd: "2026-11-20",
    durationMinDays: 4,
    durationMaxDays: 5,
  });
  const evaluated = evaluateWindows(
    windows,
    participants.map((p) => ({
      id: p.participantId,
      declarations: p.declarations,
      maxLeaveDays: p.maxLeaveDays ?? undefined,
    })),
    SG_PUBLIC_HOLIDAYS_2026,
  );
  return {
    destinations: ["Japan"],
    durationMinDays: 4,
    durationMaxDays: 5,
    ranked: rankForDisplay(evaluated),
    participants,
    tripUrl: "https://gettimeaway.com/t/abc123",
  };
}

describe("renderTripCard", () => {
  it("invites input when nobody has said anything", () => {
    const card = renderTripCard({
      destinations: [],
      durationMinDays: null,
      durationMaxDays: null,
      ranked: { feasible: [], nearMisses: [] },
      participants: [],
      tripUrl: "https://gettimeaway.com/t/abc123",
    });
    expect(card).toContain("No dates yet");
    expect(card).toContain("Destination open");
  });

  it("shows the best window with counts and leave days", () => {
    const card = renderTripCard(
      build([
        person("p1", "Anthony", [
          { state: "AVAILABLE", start: "2026-11-02", end: "2026-11-20" },
        ]),
        person("p2", "Mei", [
          { state: "AVAILABLE", start: "2026-11-02", end: "2026-11-20" },
        ]),
      ]),
    );
    expect(card).toContain("Best match so far");
    expect(card).toContain("✅ 2 can make it");
    expect(card).toMatch(/🗓 \d+ leave days?/);
    expect(card).toContain("https://gettimeaway.com/t/abc123");
  });

  it("names roster-pending people distinctly from plain maybes", () => {
    const card = renderTripCard(
      build([
        person("p1", "Anthony", [
          { state: "AVAILABLE", start: "2026-11-02", end: "2026-11-20" },
        ]),
        person("p2", "Farah", [
          { state: "UNKNOWN", start: "2026-11-02", end: "2026-11-20" },
        ]),
      ]),
    );
    expect(card).toContain("Farah — waiting on roster");
    expect(card).not.toContain("Farah — maybe");
  });

  it("flags people who have not responded at all", () => {
    const card = renderTripCard(
      build([
        person("p1", "Anthony", [
          { state: "AVAILABLE", start: "2026-11-02", end: "2026-11-20" },
        ]),
        person("p2", "Daniel"),
      ]),
    );
    expect(card).toContain("Daniel — no dates yet");
  });

  it("surfaces the closest option and who it excludes when nothing works", () => {
    const card = renderTripCard(
      build([
        person("p1", "Anthony", [
          { state: "UNAVAILABLE", start: "2026-11-02", end: "2026-11-11" },
        ]),
        person("p2", "Mei", [
          { state: "UNAVAILABLE", start: "2026-11-12", end: "2026-11-20" },
        ]),
      ]),
    );
    expect(card).toContain("No window works for everyone yet");
    expect(card).toContain("Closest:");
    expect(card).toMatch(/❌ (Anthony|Mei) can't make it/);
    expect(card).toContain("Shift a date or go without someone");
  });

  it("lists alternative windows when several work", () => {
    const card = renderTripCard(
      build([
        person("p1", "Anthony", [
          { state: "AVAILABLE", start: "2026-11-02", end: "2026-11-20" },
        ]),
      ]),
    );
    expect(card).toContain("Also works:");
  });

  it("renders the confirmed state once dates are selected", () => {
    const card = renderTripCard({
      ...build([person("p1", "Anthony")]),
      selected: { start: "2026-11-07", end: "2026-11-10" },
    });
    expect(card).toContain("🎉 Dates confirmed");
    expect(card).toContain("7–10 Nov 2026");
    expect(card).not.toContain("Best match so far");
  });
});
