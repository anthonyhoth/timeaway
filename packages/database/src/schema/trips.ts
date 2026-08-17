import {
  boolean,
  date,
  index,
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

export const trips = pgTable(
  "trips",
  {
  id: uuid("id").primaryKey().defaultRandom(),
  // Public share slug for timeaway.sg/t/<shortCode> — link-passthrough is
  // the distribution model (docs/DECISIONS.md), so every trip is linkable.
  shortCode: text("short_code").notNull().unique(),
  organiserId: uuid("organiser_id")
    .notNull()
    .references(() => users.id),
  // Places on the table — "Korea/Japan" stores both (brief §8's "destination
  // candidates"). Empty when the destination is open.
  destinationCandidates: text("destination_candidates").array(),
  // The settled choice, once the group picks one. Null while undecided;
  // destination does not feed the engine at MVP (no flights or weather).
  destination: text("destination"),
  status: tripStatus("status").notNull().default("IDEA"),
  // Rough travel period the organiser is searching within (brief section 8).
  // Calendar dates, deliberately timezone-free.
  horizonStart: date("horizon_start"),
  horizonEnd: date("horizon_end"),
  // Duration range — "4–6 days", never a single number (brief section 8).
  durationMinDays: integer("duration_min_days"),
  durationMaxDays: integer("duration_max_days"),
  // Whether the range above was assumed rather than chosen. The card marks it
  // "(default)" so nobody takes an assumption of ours for a group decision —
  // and 3–7 is a plausible thing to pick deliberately, so it cannot be inferred.
  durationDefaulted: boolean("duration_defaulted").notNull().default(false),
  // Set when status reaches DATE_SELECTED.
  selectedStart: date("selected_start"),
  selectedEnd: date("selected_end"),
  // Group chat this trip's ambient capture listens to (null for DM-created
  // trips). Telegram chat ids exceed 32 bits — stored as text.
  telegramChatId: text("telegram_chat_id"),
  // How many options the group is currently choosing between. Planning
  // narrows in rounds: a shortlist of 5 spread across the horizon, then the
  // best 3 once people have reacted, then one selected date.
  shortlistSize: integer("shortlist_size").notNull().default(5),
  // /pause turns ambient capture off for the group without ending the trip.
  ambientPaused: boolean("ambient_paused").notNull().default(false),
  // The live results card in the group chat, edited in place as availability
  // lands rather than reposted. Null until the first card is sent.
  cardMessageId: text("card_message_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  },
  (t) => [index("trips_telegram_chat_id").on(t.telegramChatId)],
);

export type Trip = typeof trips.$inferSelect;
export type NewTrip = typeof trips.$inferInsert;
