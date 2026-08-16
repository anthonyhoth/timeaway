import { generateShortCode } from "@timeaway/shared";
import { eq } from "drizzle-orm";
import type { Db } from "../client.js";
import type { Trip } from "../schema/index.js";
import { participants, trips } from "../schema/index.js";

export interface CreateTripInput {
  organiserUserId: string;
  destination?: string | null;
  horizonStart?: string | null;
  horizonEnd?: string | null;
  durationMinDays?: number | null;
  durationMaxDays?: number | null;
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
            destination: input.destination ?? null,
            status: "PLANNING",
            horizonStart: input.horizonStart ?? null,
            horizonEnd: input.horizonEnd ?? null,
            durationMinDays: input.durationMinDays ?? null,
            durationMaxDays: input.durationMaxDays ?? null,
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
