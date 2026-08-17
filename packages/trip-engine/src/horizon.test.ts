import { describe, expect, it } from "vitest";
import { deriveHorizon } from "./horizon.js";

const person = (...ranges: [string, string][]) => ({
  declarations: ranges.map(([start, end]) => ({ start, end })),
});

describe("deriveHorizon", () => {
  const today = "2026-08-17" as const;

  it("spans everything the group has said", () => {
    expect(
      deriveHorizon(
        [person(["2027-12-01", "2027-12-31"]), person(["2027-11-10", "2027-11-20"])],
        today,
      ),
    ).toEqual({ start: "2027-11-10", end: "2027-12-31" });
  });

  it("cannot exclude an answer, whatever the year", () => {
    // The whole point: a window made of what people said contains it.
    const window = deriveHorizon([person(["2028-06-01", "2028-06-14"])], today)!;
    expect(window.start <= "2028-06-01").toBe(true);
    expect(window.end >= "2028-06-14").toBe(true);
  });

  it("has nothing to derive before anyone answers", () => {
    expect(deriveHorizon([person()], today)).toBeNull();
    expect(deriveHorizon([], today)).toBeNull();
  });

  it("does not drag the window into the past", () => {
    expect(deriveHorizon([person(["2026-01-01", "2026-12-31"])], today)).toEqual({
      start: "2026-08-17",
      end: "2026-12-31",
    });
  });

  it("ignores someone sitting the trip out", () => {
    // They constrain nothing, so they must not stretch the window either.
    expect(
      deriveHorizon(
        [
          { optedOut: true, declarations: [{ start: "2029-01-01", end: "2029-01-07" }] },
          person(["2026-11-01", "2026-11-30"]),
        ],
        today,
      ),
    ).toEqual({ start: "2026-11-01", end: "2026-11-30" });
  });

  it("returns nothing when every answer is already past", () => {
    expect(deriveHorizon([person(["2025-01-01", "2025-02-01"])], today)).toBeNull();
  });
});
