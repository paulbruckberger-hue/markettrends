CREATE TABLE IF NOT EXISTS "linkedin_query_runs" (
	"query_norm" text NOT NULL,
	"posted_limit" text NOT NULL,
	"day_key" text NOT NULL,
	"last_run_at" timestamp DEFAULT now(),
	CONSTRAINT "linkedin_query_runs_query_norm_posted_limit_day_key_pk" PRIMARY KEY("query_norm","posted_limit","day_key")
);
