import { GrammyError } from "grammy";
import { describe, expect, it, vi } from "vitest";
import {
  classifyError,
  logBotError,
  newErrorRef,
  userFacingCallbackError,
  userFacingError,
} from "./errors.js";

const ctx = (over: Record<string, unknown> = {}) =>
  ({
    chat: { id: -100393794, type: "supergroup" },
    from: { id: 88514834 },
    update: { update_id: 1 },
    ...over,
  }) as never;

const captureLog = (fn: () => void): Record<string, unknown> => {
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  fn();
  const line = spy.mock.calls[0]![0] as string;
  spy.mockRestore();
  return JSON.parse(line);
};

describe("references", () => {
  it("are short, readable and unique", () => {
    const refs = new Set(Array.from({ length: 200 }, newErrorRef));
    expect(refs.size).toBe(200);
    for (const r of refs) expect(r).toMatch(/^[a-z2-9]{6}$/);
  });

  it("appear in both the user's message and the log", () => {
    const entry = captureLog(() => logBotError(ctx(), new Error("boom")));
    const ref = entry.ref as string;
    expect(userFacingError(ref)).toContain(ref);
    expect(userFacingCallbackError(ref)).toContain(ref);
  });
});

describe("what the user sees", () => {
  it("never blames them and never leaks internals", () => {
    const message = userFacingError("abc123");
    expect(message).toContain("nothing you did");
    expect(message).not.toMatch(/error|exception|stack|500|undefined|null/i);
  });

  it("fits a callback toast", () => {
    expect(userFacingCallbackError("abc123").length).toBeLessThan(200);
  });
});

describe("what the log records", () => {
  it("keeps the Telegram description, which is the diagnostic part", () => {
    const err = new GrammyError(
      "Call to 'sendMessage' failed!",
      { ok: false, error_code: 400, description: "Bad Request: button URL invalid" } as never,
      "sendMessage",
      {} as never,
    );
    const entry = captureLog(() => logBotError(ctx(), err));
    expect(entry.kind).toBe("telegram_api");
    expect(entry.method).toBe("sendMessage");
    expect(entry.description).toContain("button URL invalid");
  });

  it("keeps our own callback payload, which is safe and useful", () => {
    const entry = captureLog(() =>
      logBotError(
        ctx({ callbackQuery: { data: "sel:2026-11-07:2026-11-10" } }),
        new Error("boom"),
      ),
    );
    expect(entry.data).toBe("sel:2026-11-07:2026-11-10");
  });

  it("NEVER records what a person wrote — only how long it was", () => {
    // The privacy page promises non-planning messages are not logged; an
    // error path must not quietly become the exception.
    const secret = "cmi october, also my address is 21 Orchard Road";
    const entry = captureLog(() =>
      logBotError(ctx({ message: { text: secret } }), new Error("boom")),
    );
    expect(JSON.stringify(entry)).not.toContain("Orchard");
    expect(entry.textLength).toBe(secret.length);
  });

  it("records a command by name, since it is our own vocabulary", () => {
    const entry = captureLog(() =>
      logBotError(ctx({ message: { text: "/dates@TimeawayBot" } }), new Error("x")),
    );
    expect(entry.command).toBe("/dates");
  });
});

describe("classification", () => {
  it("separates the causes worth counting separately", () => {
    expect(
      classifyError(
        new GrammyError("x", { ok: false, error_code: 400, description: "d" } as never, "m", {} as never),
      ),
    ).toBe("telegram_api");
    expect(classifyError(Object.assign(new Error("x"), { code: "23505" }))).toBe("database");
    expect(classifyError(Object.assign(new Error("x"), { code: "ECONNRESET" }))).toBe("network");
    expect(classifyError(new Error("plain"))).toBe("unknown");
  });
});
