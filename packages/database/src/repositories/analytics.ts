import type { Db } from "../client.js";
import { analyticsEvents } from "../schema/index.js";

export interface EventInput {
  event: string;
  tripId?: string | null;
  chatId?: string | null;
  properties?: Record<string, unknown>;
}

/**
 * Record a product event. Deliberately swallows its own failures: analytics
 * must never break the thing it is measuring, and a dropped event is a far
 * smaller problem than a bot that stops answering.
 */
export async function recordEvent(db: Db, input: EventInput): Promise<void> {
  try {
    await db.insert(analyticsEvents).values({
      event: input.event,
      tripId: input.tripId ?? null,
      chatId: input.chatId ?? null,
      properties: input.properties ?? {},
    });
  } catch (error) {
    console.error("analytics write failed", input.event, error);
  }
}
