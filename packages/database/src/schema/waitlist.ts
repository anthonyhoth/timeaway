import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/**
 * Native-app waitlist. The bot itself already works, so this is explicitly
 * *not* the primary call to action (docs/DECISIONS.md) — it collects interest
 * in the app that remains an MVP exclusion.
 */
export const waitlistSignups = pgTable(
  "waitlist_signups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    /** Where the signup came from — "landing", "trip", etc. */
    source: text("source").notNull().default("landing"),
    /** Set when someone signed up from a specific trip page. */
    tripShortCode: text("trip_short_code"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("waitlist_email_unique").on(sql`lower(${t.email})`)],
);

export type WaitlistSignup = typeof waitlistSignups.$inferSelect;
