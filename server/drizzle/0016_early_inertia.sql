CREATE TYPE "public"."plan_tier" AS ENUM('free', 'plus', 'pro');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bot_sessions" (
	"channel" text NOT NULL,
	"chat_id" text NOT NULL,
	"step" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb,
	"expires_at" timestamp,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "bot_sessions_channel_chat_id_pk" PRIMARY KEY("channel","chat_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"token" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"plan" "plan_tier" DEFAULT 'free' NOT NULL,
	"keyword_bonus" integer DEFAULT 0 NOT NULL,
	"invited_by" uuid,
	"accepted_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "user_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_completed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plan" "plan_tier" DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "keyword_bonus" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_comp" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "subscription_status" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "current_period_end" timestamp;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_invites" ADD CONSTRAINT "user_invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_invites_email" ON "user_invites" USING btree ("email");--> statement-breakpoint
-- Bestandsschutz (läuft einmalig): heutige Nutzer haben ihre Interessen schon
-- konfiguriert → Onboarding nicht erneut zeigen; bestehende Nicht-Admins voll
-- gratis schalten, damit sie nicht plötzlich auf die Free-Quota (1) limitiert sind.
UPDATE "users" SET "onboarding_completed" = true;--> statement-breakpoint
UPDATE "users" SET "is_comp" = true WHERE "role" <> 'admin';