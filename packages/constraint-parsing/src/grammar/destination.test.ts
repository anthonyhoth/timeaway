import { describe, expect, it } from "vitest";
import { applyDestinationEdit, parseDestinationEdit } from "./destination.js";

const TODAY = "2026-08-17";
const parse = (text: string, current: string[] = ["Japan"]) =>
  parseDestinationEdit(text, TODAY, current);

describe("parseDestinationEdit — adding", () => {
  it("adds a place offered alongside the current one", () => {
    expect(parse("lets try korea too")).toEqual({ op: "ADD", destinations: ["Korea"] });
    expect(parse("can also consider taiwan")).toEqual({ op: "ADD", destinations: ["Taiwan"] });
    expect(parse("what about vietnam")).toEqual({ op: "ADD", destinations: ["Vietnam"] });
  });

  it("adds several at once", () => {
    expect(parse("lets add korea and taiwan too")).toEqual({
      op: "ADD",
      destinations: ["Korea", "Taiwan"],
    });
  });

  it("ignores adding something already on the list", () => {
    expect(parse("add japan to the list")).toBeNull();
  });
});

describe("parseDestinationEdit — replacing", () => {
  it("replaces on 'instead' and its cousins", () => {
    for (const t of ["lets go korea instead", "actually lets do korea", "change it to korea"]) {
      expect(parse(t)).toEqual({ op: "REPLACE", destinations: ["Korea"] });
    }
  });
});

describe("parseDestinationEdit — removing", () => {
  it("removes a place the trip actually has", () => {
    for (const t of ["not japan", "drop japan", "japan is out"]) {
      expect(parse(t)).toEqual({ op: "REMOVE", destinations: ["Japan"] });
    }
  });

  it("won't remove something that was never on the list", () => {
    // The guard that stops "not sure" deleting an imaginary place.
    expect(parse("not korea")).toBeNull();
    expect(parse("not sure")).toBeNull();
  });
});

describe("parseDestinationEdit — declining", () => {
  it("ignores date talk that happens to carry an edit word", () => {
    // These were the dangerous near-misses: an edit word plus a month.
    expect(parse("lets go in june instead")).toBeNull();
    expect(parse("can also do december")).toBeNull();
  });

  it("ignores availability messages", () => {
    expect(parse("cmi korea trip")).toBeNull();
    expect(parse("only got 2 days AL")).toBeNull();
  });

  it("now reads a positive assessment as a suggestion", () => {
    // Superseded deliberately: "korea looks nice" is how a destination gets
    // proposed, and treating it as chatter sent it to the LLM or nowhere.
    expect(parse("korea looks nice")).toEqual({
      op: "ADD",
      destinations: ["Korea"],
    });
  });

  it("still ignores chatter that only looks like one", () => {
    expect(parse("let's eat later")).toBeNull();
    expect(parse("the weather is fine too")).toBeNull();
  });
});

describe("applyDestinationEdit", () => {
  it("appends, replaces and removes", () => {
    expect(applyDestinationEdit(["Japan"], { op: "ADD", destinations: ["Korea"] })).toEqual(["Japan", "Korea"]);
    expect(applyDestinationEdit(["Japan"], { op: "REPLACE", destinations: ["Korea"] })).toEqual(["Korea"]);
    expect(applyDestinationEdit(["Japan", "Korea"], { op: "REMOVE", destinations: ["Japan"] })).toEqual(["Korea"]);
  });

  it("de-duplicates case-insensitively and caps the list", () => {
    expect(applyDestinationEdit(["Japan"], { op: "ADD", destinations: ["japan"] })).toEqual(["Japan"]);
    const many = applyDestinationEdit(
      ["A", "B", "C", "D", "E"],
      { op: "ADD", destinations: ["F"] },
    );
    expect(many).toHaveLength(5);
  });

  it("can empty the list, leaving the trip destination-open", () => {
    expect(applyDestinationEdit(["Japan"], { op: "REMOVE", destinations: ["Japan"] })).toEqual([]);
  });
});
