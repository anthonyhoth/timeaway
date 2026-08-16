import { describe, expect, it } from "vitest";
import type { AvailabilityDeclaration } from "./availability.js";
import { resolveDay, resolveRange } from "./availability.js";

const decl = (
  state: AvailabilityDeclaration["state"],
  start: string,
  end: string,
): AvailabilityDeclaration => ({ state, start, end });

describe("resolveDay", () => {
  it("is UNANSWERED when there are no declarations at all", () => {
    expect(resolveDay([], "2026-09-04")).toBe("UNANSWERED");
  });

  it("is UNANSWERED for dates no declaration covers", () => {
    const ds = [decl("UNAVAILABLE", "2026-09-04", "2026-09-17")];
    expect(resolveDay(ds, "2026-09-03")).toBe("UNANSWERED");
    expect(resolveDay(ds, "2026-09-18")).toBe("UNANSWERED");
  });

  it("covers both range boundaries inclusively", () => {
    const ds = [decl("UNAVAILABLE", "2026-09-04", "2026-09-17")];
    expect(resolveDay(ds, "2026-09-04")).toBe("UNAVAILABLE");
    expect(resolveDay(ds, "2026-09-17")).toBe("UNAVAILABLE");
  });

  it("resolves each declared state", () => {
    for (const state of [
      "AVAILABLE",
      "MAYBE",
      "UNAVAILABLE",
      "UNKNOWN",
    ] as const) {
      expect(resolveDay([decl(state, "2026-11-01", "2026-11-30")], "2026-11-15")).toBe(
        state,
      );
    }
  });

  it("keeps UNKNOWN distinct from UNANSWERED — the roster case", () => {
    // "I only know my roster one month ahead": November explicitly UNKNOWN,
    // December simply not answered. These must never collapse into each other.
    const ds = [decl("UNKNOWN", "2026-11-01", "2026-11-30")];
    expect(resolveDay(ds, "2026-11-15")).toBe("UNKNOWN");
    expect(resolveDay(ds, "2026-12-15")).toBe("UNANSWERED");
  });

  it("lets a later declaration override an earlier overlapping one", () => {
    const ds = [
      decl("UNAVAILABLE", "2026-09-04", "2026-09-17"),
      decl("AVAILABLE", "2026-09-10", "2026-09-12"),
    ];
    expect(resolveDay(ds, "2026-09-10")).toBe("AVAILABLE");
    expect(resolveDay(ds, "2026-09-12")).toBe("AVAILABLE");
    // Outside the override, the earlier declaration still applies.
    expect(resolveDay(ds, "2026-09-09")).toBe("UNAVAILABLE");
    expect(resolveDay(ds, "2026-09-13")).toBe("UNAVAILABLE");
  });

  it("later roster knowledge can replace UNKNOWN", () => {
    // Roster releases: what was UNKNOWN becomes concrete.
    const ds = [
      decl("UNKNOWN", "2026-11-01", "2026-11-30"),
      decl("AVAILABLE", "2026-11-20", "2026-11-26"),
    ];
    expect(resolveDay(ds, "2026-11-22")).toBe("AVAILABLE");
    expect(resolveDay(ds, "2026-11-10")).toBe("UNKNOWN");
  });

  it("handles single-day declarations", () => {
    const ds = [decl("MAYBE", "2026-11-21", "2026-11-21")];
    expect(resolveDay(ds, "2026-11-21")).toBe("MAYBE");
    expect(resolveDay(ds, "2026-11-22")).toBe("UNANSWERED");
  });
});

describe("resolveRange", () => {
  it("maps every day in the range, inclusive", () => {
    const result = resolveRange([], "2026-11-21", "2026-11-25");
    expect([...result.keys()]).toEqual([
      "2026-11-21",
      "2026-11-22",
      "2026-11-23",
      "2026-11-24",
      "2026-11-25",
    ]);
    expect([...result.values()]).toEqual(Array(5).fill("UNANSWERED"));
  });

  it("mixes states across a horizon — the proof-scenario shape", () => {
    // "Can't do October" + roster-pending November.
    const ds = [
      decl("UNAVAILABLE", "2026-10-01", "2026-10-31"),
      decl("UNKNOWN", "2026-11-01", "2026-11-30"),
    ];
    const result = resolveRange(ds, "2026-09-30", "2026-11-02");
    expect(result.get("2026-09-30")).toBe("UNANSWERED");
    expect(result.get("2026-10-01")).toBe("UNAVAILABLE");
    expect(result.get("2026-10-31")).toBe("UNAVAILABLE");
    expect(result.get("2026-11-01")).toBe("UNKNOWN");
    expect(result.get("2026-11-02")).toBe("UNKNOWN");
  });
});
