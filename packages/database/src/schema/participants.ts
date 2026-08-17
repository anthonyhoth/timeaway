import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { trips } from "./trips.js";
import { users } from "./users.js";

export const participantRole = pgEnum("participant_role", [
  "ORGANISER",
  "PARTICIPANT",
]);

/**
 * A participant can exist before the person has a Timeaway account: the
 * organiser names them ("Marcus"), shares the trip link, and the person claims
 * the slot when they first respond. Hence user_id is nullable with invite_name
 * as the pre-claim label — see docs/DECISIONS.md dated schema entry.
 */
export const participants = pgTable(
  "participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id),
    inviteName: text("invite_name"),
    role: participantRole("role").notNull().default("PARTICIPANT"),
    // "Max 2 days leave" — a hard cap the engine treats as a constraint
    // (brief section 10). Source text preserved per the auditability rule.
    // Sat this one out. Not everyone in a group chat is travelling, and
    // someone who has already spoken needs a way to withdraw without their
    // silence being read as a constraint.
    optedOut: boolean("opted_out").notNull().default(false),
    maxLeaveDays: integer("max_leave_days"),
    maxLeaveDaysSourceText: text("max_leave_days_source_text"),
    // When the cap was stated. A bare retraction ("nvm") has to work out which
    // of someone's recent facts it refers to, and the cap is a column rather
    // than a row, so it carries no createdAt of its own.
    maxLeaveDaysSetAt: timestamp("max_leave_days_set_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("participants_trip_user")
      .on(t.tripId, t.userId)
      .where(sql`${t.userId} is not null`),
    check(
      "participants_identity_present",
      sql`${t.userId} is not null or ${t.inviteName} is not null`,
    ),
  ],
);

export type Participant = typeof participants.$inferSelect;
export type NewParticipant = typeof participants.$inferInsert;
