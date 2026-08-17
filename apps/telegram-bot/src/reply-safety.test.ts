import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * A source-level guard, because this class of bug has now bitten twice and is
 * invisible in normal testing.
 *
 * Telegram rejects an entire `sendMessage` when one of its parameters is
 * unusable — a reply target that no longer exists, or an inline button URL it
 * will not accept. The user sees nothing at all, and the only trace is in our
 * logs. Unit tests cannot catch it because the failure is on Telegram's side.
 *
 * So the rule is enforced on the source: replies go through `replyTo`, which
 * sets `allow_sending_without_reply`, and buttons through `isButtonSafeUrl`.
 */
const source = readFileSync(
  fileURLToPath(new URL("./bot.ts", import.meta.url)),
  "utf8",
);

describe("a message can never be suppressed by its own decorations", () => {
  it("builds every reply through replyTo", () => {
    // An inline `{ message_id: … }` omits allow_sending_without_reply, and a
    // deleted or pre-re-add target then drops the whole message.
    const inline = source.match(/reply_parameters:\s*\{/g) ?? [];
    expect(inline, "use replyTo(messageId) instead").toHaveLength(0);
    expect(source).toContain("reply_parameters: replyTo(");
  });

  it("keeps replyTo's opt-out flag set", () => {
    expect(source).toContain("allow_sending_without_reply: true");
  });

  it("still screens button URLs Telegram would reject", () => {
    // localhost links once killed every message that carried one.
    expect(source).toContain("isButtonSafeUrl");
  });
});
