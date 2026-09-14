CREATE TABLE "pantry_intake_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"intake_id" uuid NOT NULL,
	"canonical_item" text NOT NULL,
	"display_name" text NOT NULL,
	"quantity" real,
	"unit" text
);
--> statement-breakpoint
CREATE TABLE "pantry_intakes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source" text NOT NULL,
	"external_reference" text,
	"source_label" text,
	"acquired_at" timestamp with time zone,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "pantry_items" ADD COLUMN "is_usual" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pantry_items" ADD COLUMN "storage_location" text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "pantry_items" ADD COLUMN "acquired_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pantry_items" ADD COLUMN "last_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pantry_items" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "pantry_items" ADD COLUMN "confidence" text DEFAULT 'confirmed' NOT NULL;--> statement-breakpoint
ALTER TABLE "pantry_items" ADD COLUMN "source_reference" text;--> statement-breakpoint
ALTER TABLE "pantry_intake_items" ADD CONSTRAINT "pantry_intake_items_intake_id_pantry_intakes_id_fk" FOREIGN KEY ("intake_id") REFERENCES "public"."pantry_intakes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pantry_intakes" ADD CONSTRAINT "pantry_intakes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pantry_intake_items_intake_idx" ON "pantry_intake_items" USING btree ("intake_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pantry_intake_items_item_idx" ON "pantry_intake_items" USING btree ("intake_id","canonical_item");--> statement-breakpoint
CREATE INDEX "pantry_intakes_owner_status_idx" ON "pantry_intakes" USING btree ("user_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pantry_intakes_source_ref_idx" ON "pantry_intakes" USING btree ("user_id","source","external_reference");
