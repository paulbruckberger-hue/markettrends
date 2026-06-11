ALTER TABLE "classifications" ADD COLUMN IF NOT EXISTS "breaking" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "daily_push_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "daily_push_hour" integer DEFAULT 8 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "daily_push_last_sent" timestamp;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "breaking_alerts_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "newsletter_frequency" text DEFAULT 'weekly' NOT NULL;
