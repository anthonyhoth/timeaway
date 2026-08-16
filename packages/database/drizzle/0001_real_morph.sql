CREATE TYPE "public"."availability_source" AS ENUM('CALENDAR', 'NATURAL_LANGUAGE');--> statement-breakpoint
CREATE TYPE "public"."declared_availability_state" AS ENUM('AVAILABLE', 'MAYBE', 'UNAVAILABLE', 'UNKNOWN');--> statement-breakpoint
CREATE TABLE "availability_declarations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participant_id" uuid NOT NULL,
	"state" "declared_availability_state" NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"source" "availability_source" NOT NULL,
	"original_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "availability_declarations_range_valid" CHECK ("availability_declarations"."end_date" >= "availability_declarations"."start_date"),
	CONSTRAINT "availability_declarations_nl_has_text" CHECK ("availability_declarations"."source" <> 'NATURAL_LANGUAGE' or "availability_declarations"."original_text" is not null)
);
--> statement-breakpoint
ALTER TABLE "availability_declarations" ADD CONSTRAINT "availability_declarations_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "availability_declarations_participant" ON "availability_declarations" USING btree ("participant_id");