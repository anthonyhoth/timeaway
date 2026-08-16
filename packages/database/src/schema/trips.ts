import {
  date,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

/**
 * Trip lifecycle per brief section 5. HAPPENED is deliberately absent — it is
 * an optional later state requiring explicit user confirmation, never inferred
 * from DATE_SELECTED (see docs/DECISIONS.md dated schema entry).
 */
export const tripStatus = pgEnum("trip_status", [
  "IDEA",
  "PLANNING",
  "MATCH_FOUND",
  "DATE_SELECTED",
  "ARCHIVED",
]);

export const trips = pgTable("trips", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Public share slug for gettimeaway.com/t/<shortCode> — link-passthrough is
  // the distribution model (docs/DECISIONS.md), so every trip is linkable.
  shortCode: text("short_code").notNull().unique(),
  organiserId: uuid("organiser_id")
    .notNull()
    .references(() => users.id),
  // Nullable: destination can be open ("somewhere in Sep–Nov" is a valid trip).
  destination: text("destination"),
  status: tripStatus("status").notNull().default("IDEA"),
  // Rough travel period the organiser is searching within (brief section 8).
  // Calendar dates, deliberately timezone-free.
  horizonStart: date("horizon_start"),
  horizonEnd: date("horizon_end"),
  // Duration range — "4–6 days", never a single number (brief section 8).
  durationMinDays: integer("duration_min_days"),
  durationMaxDays: integer("duration_max_days"),
  // Set when status reaches DATE_SELECTED.
  selectedStart: date("selected_start"),
  selectedEnd: date("selected_end"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Trip = typeof trips.$inferSelect;
export type NewTrip = typeof trips.$inferInsert;
