-- Newsletter Themen-Cluster. Nur die wirklich neuen Objekte — alle übrigen
-- Spalten existieren bereits aus den handgeschriebenen Migrationen 0005–0010
-- (der Drizzle-Snapshot war veraltet und hätte sie fälschlich erneut angelegt).
DO $$ BEGIN
 CREATE TYPE "public"."cluster_delivery" AS ENUM('combined', 'separate');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."newsletter_cadence" AS ENUM('weekly', 'daily');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "newsletter_clusters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#3B82F6',
	"delivery" "cluster_delivery" DEFAULT 'combined' NOT NULL,
	"cadence" "newsletter_cadence" DEFAULT 'weekly' NOT NULL,
	"day" text DEFAULT 'monday',
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "watch_items" ADD COLUMN IF NOT EXISTS "cluster_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "newsletter_clusters" ADD CONSTRAINT "newsletter_clusters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_clusters_user" ON "newsletter_clusters" USING btree ("user_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "watch_items" ADD CONSTRAINT "watch_items_cluster_id_newsletter_clusters_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."newsletter_clusters"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
