import { describe, expect, it } from "vitest";
import { parseTripEdit } from "./trip-edit.js";

/**
 * Found by tracing "I'm not free 2 weeks in nov" through the pipeline: the
 * availability parser declines it (which two weeks?), so it fell through here,
 * where "not" is an edit word — and became "move the trip to November". From
 * an organiser that applied with no confirmation at all.
 */
describe("a statement about oneself is never a change to the trip", () => {
  const parse = (text: string) => parseTripEdit(text, "2026-08-17", ["Japan"]);

  it("does not turn personal unavailability into a horizon move", () => {
    expect(parse("I'm not free 2 weeks in nov")).toBeNull();
    expect(parse("i can't do nov")).toBeNull();
    expect(parse("im busy in december")).toBeNull();
    expect(parse("i have no leave for nov")).toBeNull();
  });

  it("still reads a genuine change to the plan", () => {
    expect(parse("let's push it to december")).toMatchObject({ horizon: {} });
    expect(parse("make it 5 days")).toMatchObject({ duration: { min: 5 } });
    expect(parse("let's do Korea instead")).toMatchObject({ destination: {} });
  });

  it("still reads a change stated in the first person", () => {
    // "I" alone is not the tell — the availability vocabulary is.
    expect(parse("i think we should do Korea instead")).toMatchObject({
      destination: {},
    });
  });
});
