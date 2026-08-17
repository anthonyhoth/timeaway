import { describe, expect, it } from "vitest";
import { positionSpans } from "./positions.js";

const NOVEMBER = { start: "2026-11-01", end: "2026-11-30" };

describe("positionSpans", () => {
  it("turns 2 weeks in November into three answerable choices", () => {
    expect(positionSpans(NOVEMBER, 14)).toEqual([
      { position: "first", start: "2026-11-01", end: "2026-11-14" },
      { position: "middle", start: "2026-11-09", end: "2026-11-22" },
      { position: "last", start: "2026-11-17", end: "2026-11-30" },
    ]);
  });

  it("keeps the three in calendar order", () => {
    const spans = positionSpans(NOVEMBER, 7);
    expect(spans.map((s) => s.start)).toEqual([
      "2026-11-01",
      "2026-11-12",
      "2026-11-24",
    ]);
  });

  it("gives every option the length that was asked for", () => {
    for (const days of [3, 7, 10, 14]) {
      for (const span of positionSpans(NOVEMBER, days)) {
        const length =
          (Date.parse(`${span.end}T00:00:00Z`) -
            Date.parse(`${span.start}T00:00:00Z`)) /
            86_400_000 +
          1;
        expect(length, `${days} / ${span.position}`).toBe(days);
      }
    }
  });

  it("never runs past the period", () => {
    for (const span of positionSpans(NOVEMBER, 14)) {
      expect(span.start >= NOVEMBER.start).toBe(true);
      expect(span.end <= NOVEMBER.end).toBe(true);
    }
  });

  it("offers nothing when the span fills or overflows the period", () => {
    expect(positionSpans(NOVEMBER, 30)).toEqual([]);
    expect(positionSpans(NOVEMBER, 45)).toEqual([]);
  });

  it("does not offer the same dates twice under two names", () => {
    // A 29-day span in a 30-day month leaves only two distinct placements.
    const spans = positionSpans(NOVEMBER, 29);
    expect(new Set(spans.map((s) => s.start)).size).toBe(spans.length);
  });
});
