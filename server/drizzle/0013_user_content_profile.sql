CREATE TABLE IF NOT EXISTS "user_content_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"profile" text NOT NULL,
	"feedback_count" integer DEFAULT 0 NOT NULL,
	"built_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_content_profiles" ADD CONSTRAINT "user_content_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
