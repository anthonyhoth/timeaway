import { describe, expect, it } from "vitest";
import { parseParticipantNote } from "./notes.js";

describe("parseParticipantNote", () => {
  it("records a destination objection", () => {
    for (const t of [
      "i just went korea, idw go again",
      "i'd rather not do japan again",
      "im sick of bangkok",
    ]) {
      expect(parseParticipantNote(t)?.kind).toBe("DESTINATION_OBJECTION");
    }
  });

  it("records a destination preference", () => {
    for (const t of ["i want to go seoul", "im keen on taiwan", "i'd prefer japan"]) {
      expect(parseParticipantNote(t)?.kind).toBe("DESTINATION_PREFERENCE");
    }
  });

  it("records budget concerns, first person or not", () => {
    for (const t of [
      "budget quite tight for me",
      "too expensive for me leh",
      "can we keep it under 1500",
      "around $800 max",
    ]) {
      expect(parseParticipantNote(t)?.kind).toBe("BUDGET");
    }
  });

  it("keeps the words verbatim", () => {
    expect(parseParticipantNote("i want to go seoul")?.text).toBe("i want to go seoul");
  });

  it("leaves scheduling and group decisions alone", () => {
    // These belong to availability and trip-edit parsing respectively.
    expect(parseParticipantNote("cmi october")).toBeNull();
    expect(parseParticipantNote("drop japan")).toBeNull();
    expect(parseParticipantNote("lets go korea instead")).toBeNull();
  });

  it("needs first person for an opinion, so instructions stay instructions", () => {
    // "Drop Japan" is a decision about the plan; "I don't want Japan" is a view.
    expect(parseParticipantNote("dont want japan")).toBeNull();
    expect(parseParticipantNote("i dont want japan")?.kind).toBe("DESTINATION_OBJECTION");
  });
});
