import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { participants } from "./participants.js";

/**
 * Things people say that matter to the group but are not scheduling
 * constraints: "I just went Korea, don't want to go again", "budget's tight".
 *
 * These never touch feasibility. Brief §8 draws the line — hard constraints
 * eliminate candidates, soft preferences only inform — and §19 puts budget
 * outside the product's job entirely. Recording them surfaces real friction
 * without pretending the engine can resolve it.
 */
export const noteKind = pgEnum("note_kind", [
  "DESTINATION_OBJECTION",
  "DESTINATION_PREFERENCE",
  "BUDGET",
  "OTHER",
]);

export const participantNotes = pgTable("participant_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  participantId: uuid("participant_id")
    .notNull()
    .references(() => participants.id, { onDelete: "cascade" }),
  kind: noteKind("kind").notNull(),
  /** Their own words — the auditability rule applies here too. */
  originalText: text("original_text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ParticipantNote = typeof participantNotes.$inferSelect;
