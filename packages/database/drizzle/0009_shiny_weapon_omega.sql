CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event" text NOT NULL,
	"trip_id" uuid,
	"chat_id" text,
	"properties" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "analytics_events_event" ON "analytics_events" USING btree ("event");--> statement-breakpoint
CREATE INDEX "analytics_events_created" ON "analytics_events" USING btree ("created_at");