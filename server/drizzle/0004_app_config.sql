CREATE TABLE "app_config" (
  "id" integer PRIMARY KEY DEFAULT 1,
  "linkedin_max_posts" integer NOT NULL DEFAULT 25,
  "linkedin_posted_limit" text NOT NULL DEFAULT 'week',
  "google_news_max_results" integer NOT NULL DEFAULT 20,
  "collector_max_classifications" integer NOT NULL DEFAULT 30,
  "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
INSERT INTO "app_config" ("id") VALUES (1) ON CONFLICT DO NOTHING;
