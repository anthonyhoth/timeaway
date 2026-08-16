import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { participants } from "./participants.js";

/**
 * UNANSWERED is deliberately not in this enum: it is the absence of any
 * declaration covering a date, never a stored row (brief section 9 — untouched
 * dates default to UNANSWERED). UNKNOWN is stored explicitly and must never be
 * folded into UNAVAILABLE — it means "I cannot forecast this yet".
 */
export const declaredAvailabilityState = pgEnum("declared_availability_state", [
  "AVAILABLE",
  "MAYBE",
  "UNAVAILABLE",
  "UNKNOWN",
]);

/**
 * Both input paths produce the same record shape (brief section 12):
 * "Can't do Sep 4–17" and calendar taps Can't/4→17 are the same declaration.
 */
export const availabilitySource = pgEnum("availability_source", [
  "CALENDAR",
  "NATURAL_LANGUAGE",
]);

export const availabilityDeclarations = pgTable(
  "availability_declarations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Tied to the trip participant, not the user: availability is trip-scoped
    // (data ownership, brief section 17), and pre-claim participants can have
    // availability relayed for them ("Sheryl can only do school holidays").
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    state: declaredAvailabilityState("state").notNull(),
    // Inclusive on both ends. A single day is start = end.
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    source: availabilitySource("source").notNull(),
    // Verbatim user text that produced this declaration — required for
    // NL-derived rows (auditability rule in AGENTS.md), null for calendar taps.
    originalText: text("original_text"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("availability_declarations_participant").on(t.participantId),
    check(
      "availability_declarations_range_valid",
      sql`${t.endDate} >= ${t.startDate}`,
    ),
    check(
      "availability_declarations_nl_has_text",
      sql`${t.source} <> 'NATURAL_LANGUAGE' or ${t.originalText} is not null`,
    ),
  ],
);

export type AvailabilityDeclarationRow =
  typeof availabilityDeclarations.$inferSelect;
export type NewAvailabilityDeclaration =
  typeof availabilityDeclarations.$inferInsert;
