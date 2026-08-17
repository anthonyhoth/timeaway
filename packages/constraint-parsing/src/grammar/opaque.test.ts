import { describe, expect, it } from "vitest";
import { parseAvailabilityMessage } from "./availability.js";
import { namesOpaquePeriod, opaqueReferentLabel } from "./opaque.js";

const ctx = {
  today: "2026-08-17" as const,
  horizonStart: "2026-10-01" as const,
  horizonEnd: "2027-06-30" as const,
  destination: null,
};

/**
 * "I can only go during my dec company closure" names a real, precise period
 * that nothing outside that person's head can resolve — including the LLM,
 * since the dates are not in the message, the chat, or the world the model saw.
 *
 * The damage was never the wasted call. It was that the surrounding grammar
 * still fired: "only … dec" was recorded as *available all December*, turning a
 * closure that might be five days into a month the group could plan around.
 */
describe("periods only the speaker can resolve", () => {
  it("keeps the certainty and drops the guess", () => {
    // Outside December is genuinely ruled out — that is real information and
    // narrows the search now. Inside December we do not know, so we say so.
    expect(
      parseAvailabilityMessage(
        "I can only go during my dec company closure",
        ctx,
      )?.declarations,
    ).toEqual([
      { state: "UNAVAILABLE", start: "2026-10-01", end: "2027-06-30" },
      { state: "UNKNOWN", start: "2026-12-01", end: "2026-12-31" },
    ]);
  });

  it("treats a possessive personal event as opaque", () => {
    for (const text of [
      "my company closure",
      "my block leave",
      "our office shutdown",
      "my clearance leave",
      "my reservist dates",
      "my attachment ends dec",
    ]) {
      expect(namesOpaquePeriod(text), text).toBe(true);
    }
  });

  it("does not treat a public period as opaque", () => {
    // Anyone can look these up; only the speaker knows their own closure.
    for (const text of [
      "school holidays in dec",
      "cny period",
      "the long weekend",
      "december",
    ]) {
      expect(namesOpaquePeriod(text), text).toBe(false);
    }
  });

  it("still reads an ordinary restriction as availability", () => {
    expect(
      parseAvailabilityMessage("i can only do school holidays in dec", ctx)
        ?.declarations[1],
    ).toMatchObject({ state: "AVAILABLE" });
    expect(
      parseAvailabilityMessage("i can only travel in june", ctx)
        ?.declarations[1],
    ).toMatchObject({ state: "AVAILABLE" });
  });

  it("names the thing it needs, so the question can be specific", () => {
    expect(opaqueReferentLabel("my dec company closure")).toBe("company closure");
    expect(opaqueReferentLabel("only during my block leave")).toBe("block leave");
  });
});
