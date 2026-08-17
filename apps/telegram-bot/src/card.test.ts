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
  optedOut = false,
): ParticipantPlanningState => ({
  participantId: id,
  displayName,
  isOrganiser: id === "p1",
  optedOut,
  maxLeaveDays,
  declarations,
  notes: [],
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

  it("lists each person's noted constraints on their own line", () => {
    const card = renderTripCard(
      build([person("p1", "Anthony", [], 10), person("p2", "Mei", [], 1)]),
    );
    expect(card).toContain("• Mei — up to 1 leave day");
    expect(card).toContain("Noted so far:");
    expect(card).toContain("• Anthony — up to 10 leave days");
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
    expect(card).toMatch(/1\. .+ · \dd · \d\/\d/);
    expect(card).toMatch(/· \d\/\d · \d+ leave/);
    expect(card).toContain("https://timeaway.sg/t/abc123");
  });

  it("names roster-pending people distinctly from plain maybes", () => {
    const card = renderTripCard(
      build([
        person("p1", "Anthony", [
          { state: "AVAILABLE", start: "2026-11-02", end: "2026-11-20" },
        ]),
        person("p2", "Farah", [
          {
            state: "UNKNOWN",
            start: "2026-11-02",
            end: "2026-11-20",
            sourceText: "roster not out yet for nov",
          },
        ]),
      ]),
    );
    expect(card).toContain("Farah — roster not out");
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
    expect(card).toMatch(/(Anthony|Mei) — can't make it/);
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

describe("opting out", () => {
  it("names anyone sitting the trip out", () => {
    const card = renderTripCard(
      build([
        person("p1", "Anthony", [
          { state: "AVAILABLE", start: "2026-11-02", end: "2026-11-20" },
        ]),
        person("p2", "Dan", [], null, true),
      ]),
    );
    expect(card).toContain("Dan sitting this one out");
  });

  it("leaves them out of the counts entirely", () => {
    // Two people, one sitting out — the available count is out of one.
    const card = renderTripCard(
      build([
        person("p1", "Anthony", [
          { state: "AVAILABLE", start: "2026-11-02", end: "2026-11-20" },
        ]),
        person("p2", "Dan", [], null, true),
      ]),
    );
    expect(card).toMatch(/\/1 · /);
    expect(card).not.toMatch(/of 2 in/);
  });
});

describe("non-schedule opinions", () => {
  it("records objections and preferences without voiding the trip", () => {
    const card = renderTripCard({
      ...build([
        person("p1", "Anthony", [
          { state: "AVAILABLE", start: "2026-11-02", end: "2026-11-20" },
        ]),
      ]),
      participants: [
        {
          participantId: "p1",
          displayName: "Anthony",
          isOrganiser: true,
          optedOut: false,
          maxLeaveDays: null,
          declarations: [
            { state: "AVAILABLE", start: "2026-11-02", end: "2026-11-20" },
          ],
          notes: [
            { kind: "DESTINATION_OBJECTION", text: "i just went korea, idw go again" },
          ],
        },
      ],
    });
    expect(card).toContain("Worth knowing:");
    expect(card).toContain("i just went korea, idw go again");
    // The dates still work — an opinion must never eliminate a window.
    expect(card).toMatch(/windows work so far|One window works/);
  });
});

describe("data coverage cliff", () => {
  // Only meaningful once leave figures are on screen — the invitation state
  // quotes no numbers, so qualifying them there would be noise.
  const answered = () =>
    build([
      person("p1", "Anthony", [
        { state: "AVAILABLE", start: "2026-11-02", end: "2026-11-20" },
      ]),
    ]);

  it("warns when the trip runs past our public-holiday data", () => {
    const card = renderTripCard({
      ...answered(),
      horizonStart: "2028-01-01",
      horizonEnd: "2028-06-30",
    });
    expect(card).toContain("Leave counts ignore public holidays after 2027");
  });

  it("stays quiet inside covered years", () => {
    const card = renderTripCard({
      ...answered(),
      horizonStart: "2026-11-01",
      horizonEnd: "2026-11-30",
    });
    expect(card).not.toContain("ignore public holidays");
  });
});

describe("output density", () => {
  const base = () =>
    build([
      person("p1", "Anthony", [
        { state: "AVAILABLE", start: "2026-11-02", end: "2026-11-20" },
      ]),
    ]);

  it("marks a duration we assumed, so it doesn't read as the group's choice", () => {
    const card = renderTripCard({ ...base(), durationDefaulted: true });
    expect(card).toContain("(default)");
  });

  it("says nothing when the duration was actually chosen", () => {
    const card = renderTripCard({ ...base(), durationDefaulted: false });
    expect(card).not.toContain("(default)");
  });

  /**
   * Three people blocked by one thing used to produce three warnings and three
   * warning icons, reading as three separate problems.
   */
  it("collapses one problem shared by several people into one warning", () => {
    const card = renderTripCard({
      ...base(),
      diagnostics: [
        {
          kind: "BLOCKED_ACROSS_HORIZON",
          participantId: "p2",
          availableElsewhere: [{ start: "2027-01-03", end: "2027-01-09" }],
        },
        {
          kind: "BLOCKED_ACROSS_HORIZON",
          participantId: "p3",
          availableElsewhere: [],
        },
      ] as never,
      participants: [
        ...base().participants,
        person("p2", "Dan"),
        person("p3", "Mei"),
      ],
    });

    expect(card).toContain("Dan and Mei can't do any of these dates");
    // One icon for one problem, and the way out stated once.
    expect(card.match(/⚠️/g) ?? []).toHaveLength(1);
    expect(card.match(/go without/g) ?? []).toHaveLength(1);
    // The detail specific to one person survives the collapse.
    expect(card).toContain("Dan — free");
  });

  it("keeps the status emoji out of the per-person lines", () => {
    const card = renderTripCard(base());
    for (const noisy of ["✅", "❌", "❓", "🤔", "💬", "🗓"]) {
      expect(card, noisy).not.toContain(noisy);
    }
  });
});

/**
 * A new trip has no window. The three-month default it used to get was
 * invisible and exclusionary: a group planning for Dec 2027 had every answer
 * fall outside a range they never chose, and were told no dates worked.
 */
describe("a window read off what people said", () => {
  const withDates = () =>
    build([
      person("p1", "Anthony", [
        { state: "AVAILABLE", start: "2027-12-01", end: "2027-12-31" },
      ]),
    ]);

  it("says where the window came from", () => {
    const card = renderTripCard({
      ...withDates(),
      horizonStart: "2027-12-01",
      horizonEnd: "2027-12-31",
      horizonDerived: true,
    });
    expect(card).toContain("from what you've said");
    expect(card).toContain("Dec 2027");
  });

  it("stays quiet about a window the group chose themselves", () => {
    const card = renderTripCard({
      ...withDates(),
      horizonStart: "2027-12-01",
      horizonEnd: "2027-12-31",
      horizonDerived: false,
    });
    expect(card).not.toContain("from what you've said");
  });
});

/**
 * "Roster not out" was hard-coded from when a shift roster was the only thing
 * that produced UNKNOWN. Once a company closure could too it read as nonsense —
 * and a generic label would have thrown away the distinction the product exists
 * to make, so the reason is read off what the person actually wrote.
 */
describe("why someone's dates are unknown", () => {
  const withReason = (sourceText: string) =>
    renderTripCard(
      build([
        person("p1", "Anthony", [
          { state: "AVAILABLE", start: "2026-11-02", end: "2026-11-20" },
        ]),
        person("p2", "Farah", [
          { state: "UNKNOWN", start: "2026-11-02", end: "2026-11-20", sourceText },
        ]),
      ]),
    );

  it("names a company closure as such", () => {
    expect(withReason("I can only go during my nov company closure")).toContain(
      "waiting on company closure dates",
    );
  });

  it("still says roster for a roster", () => {
    expect(withReason("roster not out yet for nov")).toContain("roster not out");
  });

  it("is honest when the words give no reason", () => {
    expect(withReason("not sure yet")).toContain("dates not confirmed");
  });
});
