CREATE TYPE "public"."ai_model" AS ENUM('claude', 'gemini', 'deepseek');--> statement-breakpoint
CREATE TYPE "public"."geo_filter" AS ENUM('global', 'dach', 'austria');--> statement-breakpoint
CREATE TYPE "public"."sentiment" AS ENUM('positive', 'negative', 'neutral');--> statement-breakpoint
CREATE TYPE "public"."signal_type" AS ENUM('product_launch', 'expansion', 'partnership', 'personnel', 'funding', 'regulatory', 'earnings', 'general');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('linkedin_post', 'linkedin_company', 'google_news', 'rss', 'newsroom');--> statement-breakpoint
CREATE TYPE "public"."watch_type" AS ENUM('topic', 'company');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_hash" text NOT NULL,
	"source_url" text NOT NULL,
	"source_type" "source_type" NOT NULL,
	"source_name" text,
	"original_title" text,
	"raw_excerpt" text,
	"author" text,
	"reactions" integer DEFAULT 0,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "articles_content_hash_unique" UNIQUE("content_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "classifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"search_term_id" uuid NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"rank" integer NOT NULL,
	"rank_reason" text,
	"sentiment" "sentiment",
	"tags" jsonb DEFAULT '[]'::jsonb,
	"signal_type" "signal_type",
	"ai_model_used" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "uniq_article_term" UNIQUE("article_id","search_term_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"search_term_id" uuid,
	"trigger" text,
	"status" text DEFAULT 'running' NOT NULL,
	"articles_found" integer DEFAULT 0,
	"articles_new" integer DEFAULT 0,
	"classifications_new" integer DEFAULT 0,
	"error_message" text,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rss_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"category" text NOT NULL,
	"language" text DEFAULT 'en',
	"is_active" boolean DEFAULT true,
	"last_ok_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "rss_sources_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "search_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "watch_type" NOT NULL,
	"query_normalized" text NOT NULL,
	"query_display" text NOT NULL,
	"geo_filter" "geo_filter" DEFAULT 'global' NOT NULL,
	"company_linkedin_id" text,
	"company_newsroom_url" text,
	"company_domain" text,
	"sources_config" jsonb DEFAULT '{"linkedin_posts":true,"linkedin_company_page":false,"google_news":true,"rss":true,"newsroom":false}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "uniq_search_term" UNIQUE("type","query_normalized","geo_filter")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"ai_model" "ai_model" DEFAULT 'claude' NOT NULL,
	"ai_model_variant" text DEFAULT 'claude-sonnet-4-20250514',
	"telegram_chat_id" text,
	"telegram_connected" boolean DEFAULT false,
	"notify_rank_1" boolean DEFAULT true,
	"notify_rank_2" boolean DEFAULT false,
	"newsletter_email" text,
	"newsletter_enabled" boolean DEFAULT false,
	"newsletter_day" text DEFAULT 'monday',
	"newsletter_time" text DEFAULT '07:00',
	"newsletter_last_sent" timestamp,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_article_state" (
	"user_id" uuid NOT NULL,
	"classification_id" uuid NOT NULL,
	"is_read" boolean DEFAULT false,
	"is_bookmarked" boolean DEFAULT false,
	"user_rank_override" integer,
	"telegram_sent" boolean DEFAULT false,
	"telegram_sent_at" timestamp,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_article_state_user_id_classification_id_pk" PRIMARY KEY("user_id","classification_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"email" text,
	"role" text DEFAULT 'user' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "watch_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"search_term_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"label" text,
	"color" text DEFAULT '#3B82F6',
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "uniq_user_term" UNIQUE("user_id","search_term_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "classifications" ADD CONSTRAINT "classifications_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "classifications" ADD CONSTRAINT "classifications_search_term_id_search_terms_id_fk" FOREIGN KEY ("search_term_id") REFERENCES "public"."search_terms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_search_term_id_search_terms_id_fk" FOREIGN KEY ("search_term_id") REFERENCES "public"."search_terms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_article_state" ADD CONSTRAINT "user_article_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_article_state" ADD CONSTRAINT "user_article_state_classification_id_classifications_id_fk" FOREIGN KEY ("classification_id") REFERENCES "public"."classifications"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "watch_items" ADD CONSTRAINT "watch_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "watch_items" ADD CONSTRAINT "watch_items_search_term_id_search_terms_id_fk" FOREIGN KEY ("search_term_id") REFERENCES "public"."search_terms"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_articles_published" ON "articles" USING btree ("published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_classifications_term_rank" ON "classifications" USING btree ("search_term_id","rank","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_classifications_article" ON "classifications" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_search_terms_active" ON "search_terms" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_watch_items_user" ON "watch_items" USING btree ("user_id","is_active");