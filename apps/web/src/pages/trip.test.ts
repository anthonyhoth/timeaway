import type { PublicTripView } from "@timeaway/database";
import { describe, expect, it } from "vitest";
import { TripPage } from "./trip.js";

const view = (overrides: Partial<PublicTripView> = {}): PublicTripView => ({
  shortCode: "abc12345",
  destinationCandidates: ["Japan"],
  status: "PLANNING",
  horizonStart: "2026-11-02",
  horizonEnd: "2026-11-30",
  durationMinDays: 4,
  durationMaxDays: 5,
  shortlistSize: 5,
  selectedStart: null,
  selectedEnd: null,
  participants: [],
  ...overrides,
});

const render = (v: PublicTripView) =>
  String(
    TripPage({
      view: v,
      ranked: { feasible: [], nearMisses: [] },
      botUrl: "https://t.me/TimeawayBot",
    }),
  );

describe("TripPage", () => {
  it("escapes user-supplied destination names", () => {
    const html = render(
      view({ destinationCandidates: ['<script>alert("xss")</script>'] }),
    );
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes names in the page title too", () => {
    const html = render(view({ destinationCandidates: ['" onload="evil()'] }));
    expect(html).not.toContain('onload="evil()"');
  });

  it("invites input when no availability has been shared", () => {
    const html = render(view());
    expect(html).toContain("No dates yet");
  });

  it("shows the confirmed state once dates are selected", () => {
    const html = render(
      view({
        status: "DATE_SELECTED",
        selectedStart: "2026-11-07",
        selectedEnd: "2026-11-10",
      }),
    );
    expect(html).toContain("Dates confirmed");
    expect(html).toContain("7–10 Nov 2026");
  });

  it("always offers the bot as the primary call to action", () => {
    expect(render(view())).toContain("https://t.me/TimeawayBot");
  });
});

/**
 * Removing the bot archives the trip rather than deleting it, and the re-add
 * message tells the group the page is still readable. That promise only holds
 * if the page stops behaving like a live board: an archived trip that still
 * says "Planning in progress" and asks people to speak up in the group chat is
 * pointing them at a chat the bot has left.
 */
describe("an archived trip reads as a record, not a live board", () => {
  const archived = () => render(view({ status: "ARCHIVED" }));

  it("says the trip is closed", () => {
    const page = archived();
    expect(page).toContain("Trip closed");
    expect(page).not.toContain("Planning in progress");
  });

  it("explains why, without blaming anyone", () => {
    expect(archived()).toContain("no longer being planned");
    expect(archived()).toContain("removed from the group chat");
  });

  it("stops asking for answers there is nowhere to put", () => {
    expect(archived()).not.toContain("this page updates");
    expect(archived()).toContain("closed before anyone said");
  });

  it("leaves a live trip alone", () => {
    const live = render(view());
    expect(live).toContain("Planning in progress");
    expect(live).not.toContain("no longer being planned");
    expect(live).toContain("this page updates");
  });

  it("still keeps what people said", () => {
    // Archiving exists so the record survives; hiding it would defeat it.
    const page = render(
      view({
        status: "ARCHIVED",
        participants: [
          {
            firstName: "Farah",
            status: "AVAILABLE",
            optedOut: false,
            maxLeaveDays: 3,
            declarations: [],
            dayCounts: { available: 0, maybe: 0, unavailable: 0, unknown: 0 },
          } as never,
        ],
      }),
    );
    expect(page).toContain("Farah");
  });
});
