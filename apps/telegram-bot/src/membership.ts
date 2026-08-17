/**
 * What a `my_chat_member` update means for us: did we just join, or leave?
 *
 * Pulled out of the handler and made total, because the inline version tested
 * `status === "member"` and nothing else. Adding the bot **as an
 * administrator** — routine in supergroups — produced `"administrator"`, matched
 * no branch, and sent no greeting. The group saw a bot that joined and said
 * nothing, with no error anywhere to explain it.
 *
 * The lesson generalised: a membership transition must always classify as
 * *something*. "Other" is a real answer that gets logged, rather than an
 * unmatched condition that vanishes.
 */
export type MembershipChange = "joined" | "left" | "other";

/** Statuses that mean the bot is in the chat and can post. */
const PRESENT = new Set(["member", "administrator", "creator"]);

/** Statuses that mean it is not. "restricted" can be either — see below. */
const ABSENT = new Set(["left", "kicked"]);

export function classifyMembership(
  previous: string,
  next: string,
  /**
   * `restricted` members are still in the chat but may be unable to post.
   * Telegram reports it with `is_member`, so the caller passes it through
   * rather than us guessing.
   */
  options: { wasMember?: boolean; isMember?: boolean } = {},
): MembershipChange {
  const wasIn = presence(previous, options.wasMember);
  const isIn = presence(next, options.isMember);

  if (!wasIn && isIn) return "joined";
  if (wasIn && !isIn) return "left";
  return "other";
}

function presence(status: string, isMember?: boolean): boolean {
  if (status === "restricted") return isMember ?? false;
  if (PRESENT.has(status)) return true;
  if (ABSENT.has(status)) return false;
  // An unfamiliar status is treated as absent: failing to greet is recoverable,
  // wrongly believing we are in a chat is not.
  return false;
}
