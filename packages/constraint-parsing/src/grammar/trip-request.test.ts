import { describe, expect, it } from "vitest";
import { parseTripRequest } from "./trip-request.js";

const TODAY = "2026-08-16";

describe("parseTripRequest", () => {
  it("parses the founder's example end to end", () => {
    const result = parseTripRequest("a Korea/Japan trip in 2027 year end", TODAY);
    expect(result.destinations).toEqual(["Korea", "Japan"]);
    expect(result.horizon).toEqual({
      start: "2027-11-15",
      end: "2028-01-05",
    });
    expect(result.duration).toBeNull();
    expect(result.needsLlm).toBe(false);
  });

  it("handles no arguments at all", () => {
    const result = parseTripRequest("", TODAY);
    expect(result).toEqual({
      destinations: [],
      horizon: null,
      duration: null,
      interpretations: [],
      needsLlm: false,
    });
  });

  it("parses a bare destination", () => {
    const result = parseTripRequest("Japan", TODAY);
    expect(result.destinations).toEqual(["Japan"]);
    expect(result.horizon).toBeNull();
    expect(result.needsLlm).toBe(false);
  });

  it("parses destination, month range, and duration together", () => {
    const result = parseTripRequest("Japan Sep–Nov 4-6 days", TODAY);
    expect(result.destinations).toEqual(["Japan"]);
    expect(result.horizon).toEqual({ start: "2026-09-01", end: "2026-11-30" });
    expect(result.duration).toEqual({ min: 4, max: 6 });
  });

  it("splits candidates on several separators", () => {
    expect(parseTripRequest("Korea or Japan", TODAY).destinations).toEqual([
      "Korea",
      "Japan",
    ]);
    expect(parseTripRequest("Bali, Phuket, Danang", TODAY).destinations).toEqual([
      "Bali",
      "Phuket",
      "Danang",
    ]);
  });

  it("preserves multi-word and already-capitalised place names", () => {
    expect(parseTripRequest("New Zealand next year", TODAY).destinations).toEqual([
      "New Zealand",
    ]);
    expect(parseTripRequest("USA in December", TODAY).destinations).toEqual([
      "USA",
    ]);
  });

  it("resolves fuzzy periods without an explicit year", () => {
    // Year end 2026 hasn't happened yet on 16 Aug 2026.
    expect(parseTripRequest("Taiwan year end", TODAY).horizon).toEqual({
      start: "2026-11-15",
      end: "2027-01-05",
    });
    expect(parseTripRequest("Osaka next year", TODAY).horizon).toEqual({
      start: "2027-01-01",
      end: "2027-12-31",
    });
    expect(parseTripRequest("Bangkok Q1 2027", TODAY).horizon).toEqual({
      start: "2027-01-01",
      end: "2027-03-31",
    });
  });

  it("rolls a finished period forward to next year", () => {
    // Mid-year 2026 ended 15 Jul, before today.
    expect(parseTripRequest("Seoul mid-year", TODAY).horizon).toEqual({
      start: "2027-05-15",
      end: "2027-07-15",
    });
  });

  it("keeps explicit ISO ranges literal", () => {
    const result = parseTripRequest("Japan 2026-09-01 to 2026-11-30", TODAY);
    expect(result.horizon).toEqual({ start: "2026-09-01", end: "2026-11-30" });
    expect(result.interpretations).not.toContain("explicit dates");
  });

  it("escalates conditional language to the LLM", () => {
    expect(
      parseTripRequest("Japan in November unless flights are crazy", TODAY)
        .needsLlm,
    ).toBe(true);
    expect(
      parseTripRequest("Korea year end but not during CNY", TODAY).needsLlm,
    ).toBe(true);
  });

  it("escalates when nothing is recognisable", () => {
    expect(parseTripRequest("asdkjh 12345", TODAY).needsLlm).toBe(true);
  });

  it("does not mistake a bare number range for a duration", () => {
    // No "days" keyword — must not become a 4–6 day duration.
    expect(parseTripRequest("Japan 4-6", TODAY).duration).toBeNull();
  });

  it("reports what it interpreted so the bot can confirm", () => {
    const result = parseTripRequest("a Korea/Japan trip in 2027 year end", TODAY);
    expect(result.interpretations).toContain("year end");
    expect(result.interpretations).toContain("destination");
  });
});
