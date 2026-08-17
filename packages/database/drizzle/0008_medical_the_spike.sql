CREATE TYPE "public"."note_kind" AS ENUM('DESTINATION_OBJECTION', 'DESTINATION_PREFERENCE', 'BUDGET', 'OTHER');--> statement-breakpoint
CREATE TABLE "participant_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participant_id" uuid NOT NULL,
	"kind" "note_kind" NOT NULL,
	"original_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "participant_notes" ADD CONSTRAINT "participant_notes_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;