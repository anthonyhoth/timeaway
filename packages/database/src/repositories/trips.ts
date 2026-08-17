import { generateShortCode } from "@timeaway/shared";
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../client.js";
import type { Trip } from "../schema/index.js";
import { participants, trips } from "../schema/index.js";

export interface CreateTripInput {
  organiserUserId: string;
  /** All places under consideration; empty means the destination is open. */
  destinationCandidates?: string[];
  horizonStart?: string | null;
  horizonEnd?: string | null;
  durationMinDays?: number | null;
  durationMaxDays?: number | null;
  /** Group chat the trip was created in; enables ambient capture there. */
  telegramChatId?: string | null;
}

function isShortCodeCollision(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { code?: string; constraint?: string; cause?: unknown };
  if (e.code === "23505" && (e.constraint?.includes("short_code") ?? true)) {
    return true;
  }
  return e.cause !== undefined && isShortCodeCollision(e.cause);
}

/**
 * Create a trip with its organiser participant row, atomically. Created as
 * PLANNING: the creation wizard collects the full owner search space, and the
 * share link immediately starts availability collection — there is no separate
 * IDEA stage in this flow.
 */
export async function createTrip(db: Db, input: CreateTripInput): Promise<Trip> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const shortCode = generateShortCode();
    try {
      return await db.transaction(async (tx) => {
        const [trip] = await tx
          .insert(trips)
          .values({
            shortCode,
            organiserId: input.organiserUserId,
            destinationCandidates: input.destinationCandidates ?? [],
            destination: null,
            status: "PLANNING",
            horizonStart: input.horizonStart ?? null,
            horizonEnd: input.horizonEnd ?? null,
            durationMinDays: input.durationMinDays ?? null,
            durationMaxDays: input.durationMaxDays ?? null,
            telegramChatId: input.telegramChatId ?? null,
          })
          .returning();
        await tx.insert(participants).values({
          tripId: trip!.id,
          userId: input.organiserUserId,
          role: "ORGANISER",
        });
        return trip!;
      });
    } catch (error) {
      if (isShortCodeCollision(error)) continue;
      throw error;
    }
  }
  throw new Error("Could not allocate a unique trip short code");
}

export async function getTripByShortCode(
  db: Db,
  shortCode: string,
): Promise<Trip | undefined> {
  const [trip] = await db
    .select()
    .from(trips)
    .where(eq(trips.shortCode, shortCode));
  return trip;
}

/**
 * The trip whose ambient capture a group chat's messages feed: the most
 * recently created PLANNING trip linked to that chat. One active trip per
 * chat is the MVP assumption.
 */
export async function findActivePlanningTripByChatId(
  db: Db,
  telegramChatId: string,
): Promise<Trip | undefined> {
  const [trip] = await db
    .select()
    .from(trips)
    .where(
      and(
        eq(trips.telegramChatId, telegramChatId),
        eq(trips.status, "PLANNING"),
      ),
    )
    .orderBy(desc(trips.createdAt))
    .limit(1);
  return trip;
}

/**
 * Bind a trip to the group chat it will be planned in. Trips created in a DM
 * start unbound: ambient capture looks trips up *by chat*, so until this is
 * set there is no path for anyone to contribute availability.
 */
export async function setTripChatId(
  db: Db,
  tripId: string,
  telegramChatId: string,
): Promise<void> {
  await db
    .update(trips)
    .set({ telegramChatId, cardMessageId: null })
    .where(eq(trips.id, tripId));
}

/** Narrow the shortlist — 5 options down to 3, then to a chosen date. */
export async function setShortlistSize(
  db: Db,
  tripId: string,
  size: number,
): Promise<void> {
  await db.update(trips).set({ shortlistSize: size }).where(eq(trips.id, tripId));
}

/** Rewrite the places under consideration, from a conversational edit. */
export async function setDestinationCandidates(
  db: Db,
  tripId: string,
  candidates: string[],
): Promise<void> {
  await db
    .update(trips)
    .set({ destinationCandidates: candidates })
    .where(eq(trips.id, tripId));
}

/** Change the trip's window or length from a conversational edit. */
export async function setTripShape(
  db: Db,
  tripId: string,
  shape: {
    horizonStart?: string;
    horizonEnd?: string;
    durationMinDays?: number;
    durationMaxDays?: number;
  },
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (shape.horizonStart) patch.horizonStart = shape.horizonStart;
  if (shape.horizonEnd) patch.horizonEnd = shape.horizonEnd;
  if (shape.durationMinDays) patch.durationMinDays = shape.durationMinDays;
  if (shape.durationMaxDays) patch.durationMaxDays = shape.durationMaxDays;
  if (Object.keys(patch).length === 0) return;
  await db.update(trips).set(patch).where(eq(trips.id, tripId));
}

/** Retire a trip so the group can start fresh, keeping the history. */
export async function archiveTrip(db: Db, tripId: string): Promise<void> {
  await db
    .update(trips)
    .set({ status: "ARCHIVED", cardMessageId: null })
    .where(eq(trips.id, tripId));
}

export async function setAmbientPaused(
  db: Db,
  tripId: string,
  paused: boolean,
): Promise<void> {
  await db
    .update(trips)
    .set({ ambientPaused: paused })
    .where(eq(trips.id, tripId));
}
