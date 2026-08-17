import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Product events, per brief §6's metric set — invite → response → recommendation
 * → agreement, and the funnel around it.
 *
 * Written to Postgres rather than a vendor: it needs no key to start working,
 * it is queryable the moment a trial begins, and a PostHog sink can be added
 * later without changing a single call site.
 */
export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** e.g. bot_added, planning_started, constraint_captured, date_selected. */
    event: text("event").notNull(),
    tripId: uuid("trip_id"),
    /** Telegram chat, so funnels can be grouped without joining trips. */
    chatId: text("chat_id"),
    /** Never the message text — properties are counts, sources and states. */
    properties: jsonb("properties").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("analytics_events_event").on(t.event),
    index("analytics_events_created").on(t.createdAt),
  ],
);

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
