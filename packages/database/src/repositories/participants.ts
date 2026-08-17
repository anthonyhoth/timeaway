import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../client.js";
import type { Participant } from "../schema/index.js";
import {
  availabilityDeclarations,
  participantNotes,
  participants,
} from "../schema/index.js";
import { upsertTelegramUser } from "./users.js";

/**
 * Ambient auto-add (founder-decided): anyone in the group whose availability
 * gets parsed becomes a participant. Upserts the Telegram-linked user, then
 * finds or creates their participant row for the trip.
 */
export async function ensureParticipantForTelegramUser(
  db: Db,
  tripId: string,
  input: { telegramUserId: string; displayName: string },
): Promise<Participant> {
  const user = await upsertTelegramUser(db, input);
  const [existing] = await db
    .select()
    .from(participants)
    .where(
      and(eq(participants.tripId, tripId), eq(participants.userId, user.id)),
    );
  if (existing) return existing;
  const [created] = await db
    .insert(participants)
    .values({ tripId, userId: user.id, role: "PARTICIPANT" })
    .returning();
  return created!;
}

export interface NlDeclarationInput {
  state: "AVAILABLE" | "MAYBE" | "UNAVAILABLE" | "UNKNOWN";
  startDate: string;
  endDate: string;
}

/** Persist NL-derived declarations with their verbatim source sentence. */
export async function addNlDeclarations(
  db: Db,
  participantId: string,
  declarations: readonly NlDeclarationInput[],
  originalText: string,
): Promise<void> {
  if (declarations.length === 0) return;
  await db.insert(availabilityDeclarations).values(
    declarations.map((d) => ({
      participantId,
      state: d.state,
      startDate: d.startDate,
      endDate: d.endDate,
      source: "NATURAL_LANGUAGE" as const,
      originalText,
    })),
  );
}

/**
 * Persist a range entered through the inline calendar. Same table and shape as
 * natural-language declarations — only `source` differs (brief §12: both input
 * paths produce identical records).
 */
export async function addCalendarDeclaration(
  db: Db,
  participantId: string,
  declaration: NlDeclarationInput,
): Promise<void> {
  await db.insert(availabilityDeclarations).values({
    participantId,
    state: declaration.state,
    startDate: declaration.startDate,
    endDate: declaration.endDate,
    source: "CALENDAR",
    originalText: null,
  });
}

export async function listDeclarations(
  db: Db,
  participantId: string,
): Promise<
  { state: "AVAILABLE" | "MAYBE" | "UNAVAILABLE" | "UNKNOWN"; start: string; end: string }[]
> {
  const rows = await db
    .select({
      state: availabilityDeclarations.state,
      start: availabilityDeclarations.startDate,
      end: availabilityDeclarations.endDate,
    })
    .from(availabilityDeclarations)
    .where(eq(availabilityDeclarations.participantId, participantId))
    .orderBy(asc(availabilityDeclarations.createdAt));
  return rows;
}

/** Everything held about one person, with ids so each item can be removed. */
export async function listOwnRecord(
  db: Db,
  participantId: string,
): Promise<{
  declarations: {
    id: string;
    state: string;
    start: string;
    end: string;
    source: string;
    originalText: string | null;
  }[];
  notes: { id: string; kind: string; text: string }[];
}> {
  const declarations = await db
    .select({
      id: availabilityDeclarations.id,
      state: availabilityDeclarations.state,
      start: availabilityDeclarations.startDate,
      end: availabilityDeclarations.endDate,
      source: availabilityDeclarations.source,
      originalText: availabilityDeclarations.originalText,
    })
    .from(availabilityDeclarations)
    .where(eq(availabilityDeclarations.participantId, participantId))
    .orderBy(asc(availabilityDeclarations.createdAt));

  const notes = await db
    .select({
      id: participantNotes.id,
      kind: participantNotes.kind,
      text: participantNotes.originalText,
    })
    .from(participantNotes)
    .where(eq(participantNotes.participantId, participantId))
    .orderBy(asc(participantNotes.createdAt));

  return { declarations, notes };
}

/** Remove one recorded item, checking it belongs to the asker. */
export async function deleteDeclaration(
  db: Db,
  participantId: string,
  declarationId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(availabilityDeclarations)
    .where(
      and(
        eq(availabilityDeclarations.id, declarationId),
        eq(availabilityDeclarations.participantId, participantId),
      ),
    )
    .returning({ id: availabilityDeclarations.id });
  return deleted.length > 0;
}

export async function clearLeaveCap(
  db: Db,
  participantId: string,
): Promise<void> {
  await db
    .update(participants)
    .set({ maxLeaveDays: null, maxLeaveDaysSourceText: null })
    .where(eq(participants.id, participantId));
}

export async function setLeaveCap(
  db: Db,
  participantId: string,
  maxLeaveDays: number,
  sourceText: string,
): Promise<void> {
  await db
    .update(participants)
    .set({ maxLeaveDays, maxLeaveDaysSourceText: sourceText })
    .where(eq(participants.id, participantId));
}

/** Withdraw from, or rejoin, the trip. */
export async function setParticipantOptedOut(
  db: Db,
  participantId: string,
  optedOut: boolean,
): Promise<void> {
  await db
    .update(participants)
    .set({ optedOut })
    .where(eq(participants.id, participantId));
}

export async function addParticipantNote(
  db: Db,
  participantId: string,
  kind: "DESTINATION_OBJECTION" | "DESTINATION_PREFERENCE" | "BUDGET" | "OTHER",
  originalText: string,
): Promise<void> {
  await db
    .insert(participantNotes)
    .values({ participantId, kind, originalText });
}

/**
 * Erase everything held about one person on one trip: their declarations,
 * their notes (which contain verbatim message text), and the participant row
 * itself. Cascades handle the children, but they are deleted explicitly so
 * the intent is legible at the call site.
 *
 * PDPA expects a real deletion path, and storing people's own words — which
 * the auditability rule requires — is precisely what creates that duty.
 */
export async function forgetParticipant(
  db: Db,
  participantId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(availabilityDeclarations)
      .where(eq(availabilityDeclarations.participantId, participantId));
    await tx
      .delete(participantNotes)
      .where(eq(participantNotes.participantId, participantId));
    await tx.delete(participants).where(eq(participants.id, participantId));
  });
}

/** Every participant row this Telegram user has in a given chat's trips. */
export async function findParticipantsForUserInTrip(
  db: Db,
  tripId: string,
  userId: string,
): Promise<Participant[]> {
  return db
    .select()
    .from(participants)
    .where(and(eq(participants.tripId, tripId), eq(participants.userId, userId)));
}

export async function listParticipants(
  db: Db,
  tripId: string,
): Promise<Participant[]> {
  return db.select().from(participants).where(eq(participants.tripId, tripId));
}
