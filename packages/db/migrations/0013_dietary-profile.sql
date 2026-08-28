ALTER TABLE "users" ADD COLUMN "dietary_tags" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "allergens" text[] DEFAULT '{}' NOT NULL;