import { describe, expect, it } from "vitest";
import {
  isUnknownAnswer,
  parseDurationRange,
  parseTripRequest,
  resolveHorizon,
} from "@timeaway/constraint-parsing";

/**
 * The group-chat failure this guards: ForceReply opens a reply box, but people
 * routinely type in the main one instead. The wizard only accepted explicit
 * replies, so those answers were dropped and the bot went mute after asking
 * its own question.
 *
 * Accepting any plain message would be worse — the organiser is also talking
 * to their friends. The rule is that a plain message answers the step only if
 * the step's own parser can read it, which is what these assert.
 */
const today = "2026-08-17" as const;

describe("what counts as an answer to the wizard", () => {
  it("reads ordinary destination answers", () => {
    for (const text of ["Korea", "Japan or Korea", "korea/japan", "Bali"]) {
      expect(parseTripRequest(text, today).destinations.length, text).toBeGreaterThan(0);
    }
  });

  it("reads ordinary horizon answers", () => {
    for (const text of ["november", "next year", "Nov–Dec", "end of the year"]) {
      expect(resolveHorizon(text, today), text).not.toBeNull();
    }
  });

  it("reads ordinary duration answers", () => {
    for (const text of ["4-6", "a week", "5 days", "long weekend"]) {
      expect(parseDurationRange(text), text).not.toBeNull();
    }
  });

  it("treats not-knowing as an answer at every step", () => {
    for (const text of ["idk", "not sure", "no idea", "dunno"]) {
      expect(isUnknownAnswer(text), text).toBe(true);
    }
  });

  /**
   * These must fall through to ambient capture instead: the organiser chatting
   * mid-wizard should not be answered with "Sorry, I didn't catch that".
   */
  /**
   * The destination parser is permissive by design — it must accept places no
   * curated list would hold, so "ok lah" becomes a trip to Ok Lah and "hahaha"
   * a trip to Hahaha. That is correct behaviour for an explicit reply to the
   * question, and wrong for a stray group message, so the plain-message path
   * screens messages made entirely of noise words first.
   */
  const CHATTER_WORDS = new Set([
    "ha", "haha", "hahaha", "hahahaha", "hehe", "hehehe", "lol", "lmao", "rofl",
    "ok", "okay", "okok", "k", "kk", "yes", "no", "nope", "ya", "yah", "yeah",
    "sure", "nice", "cool", "wait", "hmm", "hmmm", "erm", "umm", "eh", "ah",
    "ar", "sia", "lah", "leh", "lor", "hor", "meh", "liao", "already", "alamak",
    "shiok", "wah", "omg", "same", "true", "agree", "noted", "done", "thanks",
    "thx", "ty", "bro", "sis", "guys", "man", "yup", "yep", "nah",
  ]);
  const isAllChatter = (text: string) => {
    const words = text.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
    return words.length > 0 && words.every((w) => CHATTER_WORDS.has(w));
  };

  it("screens messages made entirely of noise words", () => {
    for (const text of ["hahaha", "ok lah", "wait ah", "lol", "wah", "noted"]) {
      expect(isAllChatter(text), text).toBe(true);
    }
  });

  it("lets real answers past the screen", () => {
    for (const text of ["Korea", "Japan or Korea", "Bali", "Osaka"]) {
      expect(isAllChatter(text), text).toBe(false);
      expect(parseTripRequest(text, today).destinations.length, text).toBeGreaterThan(0);
    }
  });

  it("does not mistake group chatter for a horizon or a duration", () => {
    for (const text of ["hahaha", "ok lah", "sounds good"]) {
      expect(resolveHorizon(text, today), text).toBeNull();
      expect(parseDurationRange(text), text).toBeNull();
    }
  });
});
