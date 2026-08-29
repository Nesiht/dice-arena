CREATE TYPE "public"."match_action_status" AS ENUM('ACCEPTED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."match_lifecycle_status" AS ENUM('CREATED', 'WAITING', 'ACTIVE', 'COMPLETED', 'FORFEITED', 'EXPIRED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."match_result" AS ENUM('WIN', 'LOSS', 'DRAW');--> statement-breakpoint
CREATE TYPE "public"."match_seat" AS ENUM('A', 'B');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('ACTIVE', 'DISABLED');--> statement-breakpoint
CREATE TABLE "match_actions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"match_id" uuid NOT NULL,
	"action_id" uuid NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"expected_version" bigint NOT NULL,
	"action_type" varchar(64) NOT NULL,
	"request_payload" jsonb NOT NULL,
	"status" "match_action_status" NOT NULL,
	"result_version" bigint,
	"response_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_actions_match_action_unique" UNIQUE("match_id","action_id")
);
--> statement-breakpoint
CREATE TABLE "match_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"match_id" uuid NOT NULL,
	"sequence_number" bigint NOT NULL,
	"type" varchar(64) NOT NULL,
	"actor_user_id" uuid,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_events_match_sequence_unique" UNIQUE("match_id","sequence_number")
);
--> statement-breakpoint
CREATE TABLE "match_participants" (
	"match_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"seat" "match_seat" NOT NULL,
	"result" "match_result",
	"final_score" integer,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_participants_match_user_pk" PRIMARY KEY("match_id","user_id"),
	CONSTRAINT "match_participants_match_seat_unique" UNIQUE("match_id","seat")
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"status" "match_lifecycle_status" NOT NULL,
	"version" bigint DEFAULT 0 NOT NULL,
	"state_schema_version" integer DEFAULT 1 NOT NULL,
	"state" jsonb,
	"active_player_id" uuid,
	"turn_deadline_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "matches_version_nonnegative" CHECK ("matches"."version" >= 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"status" "user_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "match_actions" ADD CONSTRAINT "match_actions_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_actions" ADD CONSTRAINT "match_actions_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_active_player_id_users_id_fk" FOREIGN KEY ("active_player_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "match_actions_match_idx" ON "match_actions" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "match_events_match_sequence_idx" ON "match_events" USING btree ("match_id","sequence_number");--> statement-breakpoint
CREATE INDEX "match_participants_user_match_idx" ON "match_participants" USING btree ("user_id","match_id");--> statement-breakpoint
CREATE INDEX "matches_status_turn_deadline_idx" ON "matches" USING btree ("status","turn_deadline_at");--> statement-breakpoint
CREATE INDEX "matches_active_player_status_idx" ON "matches" USING btree ("active_player_id","status");--> statement-breakpoint
CREATE INDEX "matches_created_at_idx" ON "matches" USING btree ("created_at");