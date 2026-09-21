ALTER TABLE "pantry_items" ADD COLUMN "resurface_after" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pantry_items" ADD COLUMN "resurface_hidden" boolean DEFAULT false NOT NULL;