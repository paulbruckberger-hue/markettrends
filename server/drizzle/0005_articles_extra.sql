ALTER TABLE "articles"
  ADD COLUMN "full_text" text,
  ADD COLUMN "comments_count" integer DEFAULT 0,
  ADD COLUMN "shares_count" integer DEFAULT 0,
  ADD COLUMN "author_info" text,
  ADD COLUMN "author_type" text,
  ADD COLUMN "extra_data" jsonb;
