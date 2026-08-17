/**
 * Not every extractor failure is the same failure.
 *
 * A timeout is bad luck and worth retrying on the next message. An exhausted
 * balance or a revoked key is a wall: every subsequent call will fail the same
 * way, costing a round-trip of latency each time and burying the real cause
 * under identical stack traces. Worse, the caller's only recovery was to return
 * silently — so the group saw nothing at all, and the person who had just typed
 * their dates reasonably assumed they were recorded.
 *
 * So we separate the two. Transient failures stay silent and retry. Standing
 * failures trip a breaker, and we tell the group plainly — once, not per
 * message — how to phrase things so the deterministic grammar can take over.
 */
export type ExtractorFailure = "quota" | "auth" | "transient";

interface ApiErrorish {
  status?: number;
  code?: string;
  error?: { code?: string; type?: string };
}

export function classifyExtractorFailure(error: unknown): ExtractorFailure {
  const e = (error ?? {}) as ApiErrorish;
  const code = e.code ?? e.error?.code ?? "";
  const type = e.error?.type ?? "";

  // 429 is ambiguous: rate-limiting is transient, an empty balance is not.
  // OpenAI distinguishes them by code, so trust that over the status alone.
  if (code === "credit_balance_exhausted" || type === "insufficient_quota") {
    return "quota";
  }
  if (e.status === 401 || e.status === 403) return "auth";
  return "transient";
}

/**
 * Cooldown rather than a permanent latch: topping up credits should bring the
 * bot back on its own, without anyone remembering to restart the process.
 */
const BREAKER_COOLDOWN_MS = 15 * 60 * 1000;

/** Say it once per chat per hour. Repeated, it would read as nagging. */
const NOTICE_INTERVAL_MS = 60 * 60 * 1000;

export class ExtractorHealth {
  private downUntil = 0;
  private lastNotice = new Map<string, number>();

  constructor(private readonly now: () => number = Date.now) {}

  /** False while the breaker is open — skip the call entirely, don't pay for it. */
  available(): boolean {
    return this.now() >= this.downUntil;
  }

  /** @returns whether this failure opened the breaker. */
  record(error: unknown): ExtractorFailure {
    const kind = classifyExtractorFailure(error);
    if (kind !== "transient") this.downUntil = this.now() + BREAKER_COOLDOWN_MS;
    return kind;
  }

  /** Cleared as soon as anything succeeds — recovery needs no intervention. */
  recordSuccess(): void {
    this.downUntil = 0;
  }

  /** Rate-limits the group-facing notice, per chat. */
  shouldNotify(chatId: string): boolean {
    // Absence must not be spelled as a timestamp: defaulting to 0 makes a chat
    // that has never been told indistinguishable from one told at time zero.
    const last = this.lastNotice.get(chatId);
    if (last !== undefined && this.now() - last < NOTICE_INTERVAL_MS) {
      return false;
    }
    this.lastNotice.set(chatId, this.now());
    return true;
  }
}

/**
 * Names no vendor and admits no billing problem — that is our business, not the
 * group's. It gives them phrasings the grammar handles, so the trip keeps
 * moving instead of stalling on our outage.
 */
export const EXTRACTOR_DEGRADED_NOTICE =
  "I didn't catch that one — say it plainly and I'll get it:\n" +
  "• “can't make it 10–14 Nov”\n" +
  "• “free the whole of December”\n" +
  "• “got 5 days leave”\n" +
  "Or use /dates to pick it on a calendar.";
