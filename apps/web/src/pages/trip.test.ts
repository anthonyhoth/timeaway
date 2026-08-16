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
