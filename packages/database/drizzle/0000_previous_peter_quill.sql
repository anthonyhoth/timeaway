CREATE TYPE "public"."identity_provider" AS ENUM('telegram', 'email', 'apple', 'google');--> statement-breakpoint
CREATE TYPE "public"."trip_status" AS ENUM('IDEA', 'PLANNING', 'MATCH_FOUND', 'DATE_SELECTED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."participant_role" AS ENUM('ORGANISER', 'PARTICIPANT');--> statement-breakpoint
CREATE TABLE "user_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "identity_provider" NOT NULL,
	"external_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"short_code" text NOT NULL,
	"organiser_id" uuid NOT NULL,
	"destination" text,
	"status" "trip_status" DEFAULT 'IDEA' NOT NULL,
	"horizon_start" date,
	"horizon_end" date,
	"duration_min_days" integer,
	"duration_max_days" integer,
	"selected_start" date,
	"selected_end" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trips_short_code_unique" UNIQUE("short_code")
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"user_id" uuid,
	"invite_name" text,
	"role" "participant_role" DEFAULT 'PARTICIPANT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participants_identity_present" CHECK ("participants"."user_id" is not null or "participants"."invite_name" is not null)
);
--> statement-breakpoint
ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_organiser_id_users_id_fk" FOREIGN KEY ("organiser_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_identities_provider_external_id" ON "user_identities" USING btree ("provider","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "participants_trip_user" ON "participants" USING btree ("trip_id","user_id") WHERE "participants"."user_id" is not null;