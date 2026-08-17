import { asc, eq } from "drizzle-orm";
import type { Db } from "../client.js";
import type { Trip } from "../schema/index.js";
import {
  availabilityDeclarations,
  participantNotes,
  participants,
  trips,
  users,
} from "../schema/index.js";

export interface ParticipantPlanningState {
  participantId: string;
  displayName: string;
  isOrganiser: boolean;
  /** Sitting this trip out — excluded from feasibility and from the counts. */
  optedOut: boolean;
  maxLeaveDays: number | null;
  /** Opinions recorded but never acted on — verbatim, newest last. */
  notes: { kind: string; text: string }[];
  /** Oldest first — the engine's latest-declaration-wins rule depends on it. */
  declarations: {
    state: "AVAILABLE" | "MAYBE" | "UNAVAILABLE" | "UNKNOWN";
    start: string;
    end: string;
    /** Their own words, so the card can say *why* something is unknown. */
    sourceText?: string | null;
  }[];
}

/**
 * Everything the trip engine needs for one trip, in one place. The engine
 * itself stays database-free — this is the only translation layer between
 * stored rows and the pure planning functions.
 */
export async function loadTripPlanningState(
  db: Db,
  tripId: string,
): Promise<ParticipantPlanningState[]> {
  const rows = await db
    .select({
      participantId: participants.id,
      inviteName: participants.inviteName,
      role: participants.role,
      optedOut: participants.optedOut,
      maxLeaveDays: participants.maxLeaveDays,
      userName: users.displayName,
    })
    .from(participants)
    .leftJoin(users, eq(participants.userId, users.id))
    .where(eq(participants.tripId, tripId))
    .orderBy(asc(participants.createdAt));

  const declarations = await db
    .select({
      participantId: availabilityDeclarations.participantId,
      state: availabilityDeclarations.state,
      start: availabilityDeclarations.startDate,
      end: availabilityDeclarations.endDate,
      sourceText: availabilityDeclarations.originalText,
    })
    .from(availabilityDeclarations)
    .innerJoin(
      participants,
      eq(availabilityDeclarations.participantId, participants.id),
    )
    .where(eq(participants.tripId, tripId))
    .orderBy(asc(availabilityDeclarations.createdAt));

  const byParticipant = new Map<
    string,
    ParticipantPlanningState["declarations"]
  >();
  for (const d of declarations) {
    const list = byParticipant.get(d.participantId) ?? [];
    list.push({ state: d.state, start: d.start, end: d.end, sourceText: d.sourceText });
    byParticipant.set(d.participantId, list);
  }

  const noteRows = await db
    .select({
      participantId: participantNotes.participantId,
      kind: participantNotes.kind,
      text: participantNotes.originalText,
    })
    .from(participantNotes)
    .innerJoin(participants, eq(participantNotes.participantId, participants.id))
    .where(eq(participants.tripId, tripId))
    .orderBy(asc(participantNotes.createdAt));

  const notesByParticipant = new Map<string, { kind: string; text: string }[]>();
  for (const n of noteRows) {
    const list = notesByParticipant.get(n.participantId) ?? [];
    list.push({ kind: n.kind, text: n.text });
    notesByParticipant.set(n.participantId, list);
  }

  return rows.map((row) => ({
    participantId: row.participantId,
    displayName: row.userName ?? row.inviteName ?? "Someone",
    isOrganiser: row.role === "ORGANISER",
    optedOut: row.optedOut,
    maxLeaveDays: row.maxLeaveDays,
    declarations: byParticipant.get(row.participantId) ?? [],
    notes: notesByParticipant.get(row.participantId) ?? [],
  }));
}

export async function setCardMessageId(
  db: Db,
  tripId: string,
  messageId: string,
): Promise<void> {
  await db
    .update(trips)
    .set({ cardMessageId: messageId })
    .where(eq(trips.id, tripId));
}

export async function selectTripDates(
  db: Db,
  tripId: string,
  start: string,
  end: string,
): Promise<Trip | undefined> {
  const [updated] = await db
    .update(trips)
    .set({ status: "DATE_SELECTED", selectedStart: start, selectedEnd: end })
    .where(eq(trips.id, tripId))
    .returning();
  return updated;
}

export async function getTripById(
  db: Db,
  tripId: string,
): Promise<Trip | undefined> {
  const [trip] = await db.select().from(trips).where(eq(trips.id, tripId));
  return trip;
}
