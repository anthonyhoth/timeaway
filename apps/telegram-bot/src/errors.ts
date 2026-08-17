import { GrammyError, HttpError } from "grammy";
import type { Context } from "grammy";

/**
 * Two audiences, one incident.
 *
 * The group gets a calm, generic line and a short reference. The log gets
 * everything needed to diagnose it — except the one thing we promise not to
 * keep: what people actually wrote. The reference is what ties the two
 * together, so a user saying "it broke, ref a3f9c2" is directly greppable.
 */

/** Short, unambiguous, easy to read aloud — no 0/O or 1/l confusion. */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function newErrorRef(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let ref = "";
  for (const b of bytes) ref += ALPHABET[b % ALPHABET.length]!;
  return ref;
}

export type ErrorKind = "telegram_api" | "network" | "database" | "unknown";

export function classifyError(error: unknown): ErrorKind {
  if (error instanceof GrammyError) return "telegram_api";
  if (error instanceof HttpError) return "network";
  const code = (error as { code?: string }).code;
  // Postgres SQLSTATEs are five characters; node errors are named strings.
  if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return "database";
  if (typeof code === "string" && code.startsWith("E")) return "network";
  return "unknown";
}

/**
 * What was being attempted, without recording what anyone said.
 *
 * Commands and callback payloads are our own vocabulary and safe to log —
 * `sel:2026-11-07:2026-11-10` is far more useful than "a callback happened".
 * Free text is never logged: only its length, which is enough to tell a
 * one-word reply from a paragraph.
 */
function describeUpdate(ctx: Context): Record<string, unknown> {
  if (ctx.callbackQuery) {
    return { update: "callback_query", data: ctx.callbackQuery.data };
  }
  const text = ctx.message?.text;
  if (text) {
    return text.startsWith("/")
      ? { update: "command", command: text.split(/[\s@]/)[0] }
      : { update: "message", textLength: text.length };
  }
  if (ctx.myChatMember) return { update: "my_chat_member" };
  return { update: Object.keys(ctx.update).find((k) => k !== "update_id") ?? "unknown" };
}

export interface LoggedError {
  ref: string;
  kind: ErrorKind;
}

/**
 * Emit one structured JSON line. Structured because it stays greppable by
 * ref, and pipes into any log aggregator later without a reformat.
 */
export function logBotError(ctx: Context, error: unknown): LoggedError {
  const ref = newErrorRef();
  const kind = classifyError(error);

  const detail: Record<string, unknown> = {
    level: "error",
    ref,
    kind,
    at: new Date().toISOString(),
    chatId: ctx.chat?.id ?? null,
    chatType: ctx.chat?.type ?? null,
    userId: ctx.from?.id ?? null,
    ...describeUpdate(ctx),
  };

  if (error instanceof GrammyError) {
    // The description is the useful part — "inline keyboard button URL is
    // invalid" is what identified a real bug. The payload is omitted: it
    // carries the message we were sending, including participant names.
    detail.method = error.method;
    detail.errorCode = error.error_code;
    detail.description = error.description;
  } else if (error instanceof Error) {
    detail.name = error.name;
    detail.message = error.message;
    detail.stack = error.stack?.split("\n").slice(0, 6).join(" | ");
  } else {
    detail.message = String(error).slice(0, 300);
  }

  console.error(JSON.stringify(detail));
  return { ref, kind };
}

/** Calm, non-technical, and traceable. Never blames the user. */
export function userFacingError(ref: string): string {
  return (
    "Something went wrong on my end — nothing you did.\n" +
    `Give it another go in a moment. If it keeps happening, quote ref ${ref}.`
  );
}

/** Callback toasts are capped around 200 characters, so this stays terse. */
export function userFacingCallbackError(ref: string): string {
  return `Something went wrong — try again. (ref ${ref})`;
}
