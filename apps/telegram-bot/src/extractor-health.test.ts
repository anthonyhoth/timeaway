import { describe, expect, it } from "vitest";
import {
  classifyExtractorFailure,
  ExtractorHealth,
} from "./extractor-health.js";

/** The shape OpenAI actually returned when the balance ran out. */
const quotaError = {
  status: 429,
  code: "credit_balance_exhausted",
  error: { type: "insufficient_quota", code: "credit_balance_exhausted" },
};

/** Same status, entirely different meaning — this one is worth retrying. */
const rateLimitError = {
  status: 429,
  code: "rate_limit_exceeded",
  error: { type: "requests", code: "rate_limit_exceeded" },
};

describe("classifyExtractorFailure", () => {
  it("reads an exhausted balance as standing, not transient", () => {
    expect(classifyExtractorFailure(quotaError)).toBe("quota");
  });

  it("does not confuse rate limiting with an empty balance", () => {
    expect(classifyExtractorFailure(rateLimitError)).toBe("transient");
  });

  it("treats a rejected key as standing", () => {
    expect(classifyExtractorFailure({ status: 401 })).toBe("auth");
  });

  it("treats network trouble as transient", () => {
    expect(classifyExtractorFailure(new Error("socket hang up"))).toBe(
      "transient",
    );
  });
});

describe("ExtractorHealth", () => {
  it("stops calling once a standing failure trips the breaker", () => {
    const health = new ExtractorHealth();
    expect(health.available()).toBe(true);
    health.record(quotaError);
    expect(health.available()).toBe(false);
  });

  it("keeps trying after a transient failure", () => {
    const health = new ExtractorHealth();
    health.record(rateLimitError);
    expect(health.available()).toBe(true);
  });

  it("recovers on its own once the cooldown passes", () => {
    let now = 0;
    const health = new ExtractorHealth(() => now);
    health.record(quotaError);
    expect(health.available()).toBe(false);
    now += 16 * 60 * 1000;
    expect(health.available()).toBe(true);
  });

  it("comes straight back when a call succeeds", () => {
    const health = new ExtractorHealth();
    health.record(quotaError);
    health.recordSuccess();
    expect(health.available()).toBe(true);
  });

  it("tells a chat once, then holds off", () => {
    let now = 0;
    const health = new ExtractorHealth(() => now);
    expect(health.shouldNotify("-100")).toBe(true);
    expect(health.shouldNotify("-100")).toBe(false);
    now += 61 * 60 * 1000;
    expect(health.shouldNotify("-100")).toBe(true);
  });

  it("rate-limits per chat, so one group's outage doesn't mute another", () => {
    const health = new ExtractorHealth();
    expect(health.shouldNotify("-100")).toBe(true);
    expect(health.shouldNotify("-200")).toBe(true);
  });
});

/**
 * The two-tier policy, learned the hard way.
 *
 * The wordy notice is rate-limited so the bot does not nag. On its own that was
 * worse than nagging: with the extractor down, every unparsed message produced
 * nothing at all for an hour, and a bot that reads your message and says
 * nothing looks exactly like a bot that is broken.
 *
 * So the *explanation* is rate-limited and the *acknowledgement* is not — the
 * handler reacts to every unparsed message, and only consults this for whether
 * to spell out why.
 */
describe("acknowledging is not the same as explaining", () => {
  it("holds the explanation back without holding back the ack", () => {
    let now = 0;
    const health = new ExtractorHealth(() => now);
    expect(health.shouldNotify("-100")).toBe(true);
    // Silent for the rest of the hour — which is exactly why the reaction in
    // the handler is unconditional.
    now += 5 * 60 * 1000;
    expect(health.shouldNotify("-100")).toBe(false);
  });
});
