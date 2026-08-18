import type { ParticipantPlanningState } from "@timeaway/database";
import {
  evaluateWindows,
  generateCandidateWindows,
  rankForDisplay,
  SG_PUBLIC_HOLIDAYS_2026,
} from "@timeaway/trip-engine";
import { describe, expect, it } from "vitest";
import { renderTripCard } from "./card.js";
import { MONO_COLUMNS } from "./markup.js";

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
    expect(card).toContain("Listening here");
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
    expect(card).toContain("Listening here");
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
    expect(card).toMatch(/1\. \w{3} +\d+ → \w{3} +\d+/);
    expect(card).toMatch(/\d of \d free|\d of \d\b/);
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
    expect(card).toContain("Sat 7 – Tue 10 Nov 2026");
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
    expect(card).toMatch(/of 1 free|of 1\b/);
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

/**
 * User feedback: the suggested dates were hard to read.
 *
 * Two causes. The rows repeated whatever every option had in common, so the
 * reader scanned three identical stat strings to find the one thing that
 * differed — the dates. And the dates themselves were bare numbers, when the
 * first thing anyone wants from a trip window is whether it is a long weekend.
 */
describe("readable options", () => {
  const win = (start: string, end: string, days: number, leave: number) => ({
    window: { start, end, days },
    leaveDays: leave,
    counts: {
      available: 1,
      maybe: 0,
      unavailable: 0,
      unknown: 0,
      unanswered: 0,
      rosterPending: 0,
    },
    participants: [],
    feasible: true,
  });
  const withShortlist = (shortlist: ReturnType<typeof win>[]) => ({
    ...build([
      person("p1", "Anthony", [
        { state: "AVAILABLE" as const, start: "2026-11-02", end: "2026-11-20" },
      ]),
    ]),
    ranked: { feasible: shortlist as never, nearMisses: [] },
    shortlist: shortlist as never,
    shortlistSize: 5,
  });

  it("names the days of the week", () => {
    // "9–13 Dec" hides that it is Wednesday to Sunday, which is the whole
    // question when you are deciding whether a window is worth the leave.
    const card = renderTripCard(
      withShortlist([win("2026-12-09", "2026-12-13", 5, 3)]),
    );
    expect(card).toContain("Wed 9 – Sun 13 Dec");
  });

  it("states what every option shares once, above them", () => {
    const card = renderTripCard(
      withShortlist([
        win("2026-12-09", "2026-12-13", 5, 3),
        win("2026-12-17", "2026-12-21", 5, 3),
      ]),
    );
    expect(card).toContain("All 5 days");
    // …and then not again on the rows, which carry dates alone.
    const rows = card
      .replace(/<\/?pre>/g, "")
      .split("\n")
      .filter((line) => /^\d+\. /.test(line));
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row).not.toMatch(/days|leave|of \d/);
  });

  it("keeps on the row only what actually differs", () => {
    const card = renderTripCard(
      withShortlist([
        win("2026-12-09", "2026-12-13", 5, 3),
        win("2026-12-26", "2026-12-28", 3, 1),
      ]),
    );
    // Stats move onto their own line beneath each option rather than being
    // hoisted, since they no longer fit beside the dates on a phone.
    expect(card).toContain("3d");
    expect(card).toContain("5d");
    expect(card).not.toContain("All 5 days");
  });
});

/**
 * Founder feedback: the worked examples repeated on every card. They are
 * onboarding — useful exactly once, which is what the join message is for —
 * and a status card should say what is happening and what is still needed.
 */
describe("the invitation card is status, not a tutorial", () => {
  const waiting = () =>
    renderTripCard({
      ...build([person("p1", "Anthony"), person("p2", "Farah")]),
      horizonStart: null,
      horizonEnd: null,
    });

  it("still says it is listening", () => {
    expect(waiting()).toContain("Listening here");
  });

  it("drops the worked examples", () => {
    const card = waiting();
    expect(card).not.toContain("cmi October");
    expect(card).not.toContain("long weekend");
    expect(card).not.toContain("Just talk about dates");
  });

  it("names who it is waiting on instead", () => {
    // More useful than examples, and it is the thing that moves the trip on.
    expect(waiting()).toContain("Waiting on Anthony and Farah");
  });

  it("keeps the commands and the link", () => {
    const card = waiting();
    expect(card).toContain("/dates");
    expect(card).toContain("/pause");
    expect(card).toContain("https://timeaway.sg/t/");
  });

  it("puts each decision on its own line", () => {
    const card = waiting();
    expect(card.split("\n")[0]).toBe("<b>Japan</b>");
    expect(card.split("\n")[1]).toMatch(/days/);
  });
});

/**
 * Telegram never gives a bot the member list — only a count — so anyone who has
 * not spoken is invisible to us. Counting only the people we had heard from
 * turned half a group into unanimity: "3 of 3 can make it" in a chat of six
 * where three had never been asked.
 */
describe("an honest denominator", () => {
  const spoke = [
    person("p1", "Anthony", [
      { state: "AVAILABLE" as const, start: "2026-11-02", end: "2026-11-20" },
    ]),
    person("p2", "Dan", [
      { state: "AVAILABLE" as const, start: "2026-11-02", end: "2026-11-20" },
    ]),
  ];

  it("counts the whole chat, not just the vocal part", () => {
    const card = renderTripCard({ ...build(spoke), groupSize: 6 });
    expect(card).toContain("of 6");
    expect(card).not.toContain("of 2");
  });

  it("says how many have never answered", () => {
    expect(renderTripCard({ ...build(spoke), groupSize: 6 })).toContain(
      "4 people haven't said anything yet",
    );
  });

  it("takes opt-outs off the denominator", () => {
    // Someone sitting the trip out is not a person we are waiting on.
    const withOptOut = [
      ...spoke,
      person("p3", "Farah", [], null, true),
    ];
    const card = renderTripCard({ ...build(withOptOut), groupSize: 6 });
    expect(card).toContain("of 5");
  });

  it("never shrinks below the people we have actually heard from", () => {
    // Someone may answer and then leave the chat; dropping their answer from
    // the denominator would be a stranger lie than the one being fixed.
    const card = renderTripCard({ ...build(spoke), groupSize: 1 });
    expect(card).toContain("of 2");
  });

  it("falls back to the old behaviour when the count is unknown", () => {
    const card = renderTripCard({ ...build(spoke), groupSize: null });
    expect(card).toContain("of 2");
    expect(card).not.toContain("haven't said anything yet");
  });

  it("folds the unnamed into the waiting list as one sentence", () => {
    const card = renderTripCard({
      ...build([person("p1", "Anthony"), person("p2", "Farah")]),
      horizonStart: null,
      horizonEnd: null,
      groupSize: 6,
    });
    expect(card).toContain("Waiting on Anthony, Farah and 4 others.");
  });
});

/**
 * Phone formatting. Widths are checked rather than eyeballed because a `<pre>`
 * block scrolls sideways instead of wrapping — the failure is invisible in a
 * desktop client and unusable on a phone.
 */
describe("the card fits a phone", () => {
  const win = (start: string, end: string, days: number, leave: number) => ({
    window: { start, end, days },
    leaveDays: leave,
    counts: {
      available: 1,
      maybe: 0,
      unavailable: 0,
      unknown: 0,
      unanswered: 0,
      rosterPending: 0,
    },
    participants: [],
    feasible: true,
  });
  const card = (shortlist: ReturnType<typeof win>[]) =>
    renderTripCard({
      ...build([
        person("p1", "Anthony", [
          { state: "AVAILABLE" as const, start: "2026-11-02", end: "2026-11-20" },
        ]),
      ]),
      ranked: { feasible: shortlist as never, nearMisses: [] },
      shortlist: shortlist as never,
      shortlistSize: 5,
    });
  const rows = (text: string) =>
    (/<pre>([\s\S]*?)<\/pre>/.exec(text)?.[1] ?? "").split("\n").filter(Boolean);

  it("never exceeds the monospace budget, uniform or mixed", () => {
    const uniform = card([
      win("2026-12-09", "2026-12-13", 5, 3),
      win("2026-12-17", "2026-12-21", 5, 3),
    ]);
    const mixed = card([
      win("2026-12-19", "2026-12-23", 5, 2),
      win("2026-11-28", "2026-12-04", 7, 4),
    ]);
    for (const text of [uniform, mixed]) {
      for (const row of rows(text)) {
        expect(row.length, row).toBeLessThanOrEqual(MONO_COLUMNS);
      }
    }
  });

  it("lines the day numbers up in a column", () => {
    // A single-digit day must not shunt the weekday across.
    const text = card([
      win("2026-12-09", "2026-12-13", 5, 3),
      win("2026-12-17", "2026-12-21", 5, 3),
    ]);
    const [first, second] = rows(text);
    expect(first!.indexOf("→")).toBe(second!.indexOf("→"));
  });

  it("wraps to two lines rather than scrolling sideways", () => {
    // Mixed stats cannot fit beside the dates, so they take their own line.
    const mixed = rows(
      card([
        win("2026-12-19", "2026-12-23", 5, 2),
        win("2026-11-28", "2026-12-04", 7, 4),
      ]),
    );
    expect(mixed.length).toBe(4);
  });

  it("produces HTML Telegram will accept", () => {
    const text = card([win("2026-12-09", "2026-12-13", 5, 3)]);
    // Balanced tags, and no stray angle bracket from user content.
    for (const tag of ["b", "pre"]) {
      const open = text.match(new RegExp(`<${tag}[ >]`, "g")) ?? [];
      const close = text.match(new RegExp(`</${tag}>`, "g")) ?? [];
      expect(open.length, tag).toBe(close.length);
    }
  });
});
