ALTER TABLE "trips" ADD COLUMN "telegram_chat_id" text;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "ambient_paused" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "participants" ADD COLUMN "max_leave_days" integer;--> statement-breakpoint
ALTER TABLE "participants" ADD COLUMN "max_leave_days_source_text" text;--> statement-breakpoint
CREATE INDEX "trips_telegram_chat_id" ON "trips" USING btree ("telegram_chat_id");