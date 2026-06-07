ALTER TABLE "user_article_state"
  ADD COLUMN "personal_rank" integer,
  ADD COLUMN "personal_rank_reason" text,
  ADD COLUMN "personal_rank_at" timestamp;
--> statement-breakpoint
ALTER TABLE "classifications"
  ADD COLUMN "rank_prompt_version" integer DEFAULT 0 NOT NULL;
