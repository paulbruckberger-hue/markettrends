ALTER TABLE "search_terms"
  ADD COLUMN "aliases" jsonb DEFAULT '[]'::jsonb;
