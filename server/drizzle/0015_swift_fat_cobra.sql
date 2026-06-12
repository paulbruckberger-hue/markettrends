ALTER TABLE "settings" ADD COLUMN "push_channel" text DEFAULT 'telegram' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "whatsapp_phone" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "whatsapp_apikey" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "whatsapp_connected" boolean DEFAULT false NOT NULL;