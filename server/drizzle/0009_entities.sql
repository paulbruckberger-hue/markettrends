ALTER TABLE "classifications"
  ADD COLUMN "entities" jsonb DEFAULT '[]'::jsonb;
