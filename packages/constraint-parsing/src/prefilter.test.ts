import { describe, expect, it } from "vitest";
import { mightContainConstraint } from "./prefilter.js";

describe("mightContainConstraint", () => {
  it("passes availability statements from the proof scenario", () => {
    expect(mightContainConstraint("Can't do October")).toBe(true);
    expect(mightContainConstraint("Max 2 days leave")).toBe(true);
    expect(mightContainConstraint("I only know my roster one month ahead")).toBe(true);
    expect(mightContainConstraint("Sheryl can only travel during school holidays")).toBe(true);
  });

  it("passes casual Singapore group-chat phrasings", () => {
    expect(mightContainConstraint("cmi for oct sia")).toBe(true);
    expect(mightContainConstraint("I got reservist in sep")).toBe(true);
    expect(mightContainConstraint("4-6 days can")).toBe(true);
    expect(mightContainConstraint("free after the 15th")).toBe(true);
    expect(mightContainConstraint("nov ok for me")).toBe(true);
    expect(mightContainConstraint("deepavali long weekend?")).toBe(true);
  });

  it("passes date-shaped messages", () => {
    expect(mightContainConstraint("21/11 to 25/11?")).toBe(true);
    expect(mightContainConstraint("2026-11-07")).toBe(true);
    expect(mightContainConstraint("maybe the weekend after")).toBe(true);
  });

  it("filters ordinary chatter", () => {
    expect(mightContainConstraint("hahahaha")).toBe(false);
    expect(mightContainConstraint("wah the food there looks amazing")).toBe(false);
    expect(mightContainConstraint("who's bringing the switch")).toBe(false);
    expect(mightContainConstraint("lol")).toBe(false);
  });

  it("filters degenerate input", () => {
    expect(mightContainConstraint("")).toBe(false);
    expect(mightContainConstraint("x".repeat(1500))).toBe(false);
  });
});
