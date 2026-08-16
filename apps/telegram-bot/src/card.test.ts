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
    tripUrl: "https://timeaway.sg/t/abc123",
  };
}

describe("renderTripCard", () => {
  it("never claims a best match before anyone has shared dates", () => {
    // Every window is technically feasible when all participants are
    // UNANSWERED, so this guards against calling the first one a match.
    const card = renderTripCard(
      build([person("p1", "Anthony"), person("p2", "Mei")]),
    );
    expect(card).not.toContain("Best match so far");
    expect(card).toContain("I'm listening in this chat now");
  });

  it("acknowledges a leave cap even with no dates yet", () => {
    const card = renderTripCard(
      build([person("p1", "Anthony", [], 10)]),
    );
    expect(card).toContain("Noted so far: Anthony up to 10 leave days");
  });

  it("invites input when nobody has said anything", () => {
    const card = renderTripCard({
      destinations: [],
      durationMinDays: null,
      durationMaxDays: null,
      ranked: { feasible: [], nearMisses: [] },
      participants: [],
      tripUrl: "https://timeaway.sg/t/abc123",
    });
    expect(card).toContain("I'm listening in this chat now");
    expect(card).toContain("Destination open");
  });

  it("offers a shortlist of distinct windows", () => {
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
    expect(card).toMatch(/\d windows work so far/);
    expect(card).toMatch(/1\. .+ · \d days/);
    expect(card).toMatch(/✅ \d in · \d+ leave/);
    expect(card).toContain("https://timeaway.sg/t/abc123");
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

  it("numbers each option so the group can point at one", () => {
    const card = renderTripCard(
      build([
        person("p1", "Anthony", [
          { state: "AVAILABLE", start: "2026-11-02", end: "2026-11-20" },
        ]),
      ]),
    );
    expect(card).toMatch(/^2\. /m);
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
