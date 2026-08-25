ALTER TABLE "recipes" ADD COLUMN "shared_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "copied_from_id" uuid;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_copied_from_id_recipes_id_fk" FOREIGN KEY ("copied_from_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recipes_copied_from_idx" ON "recipes" USING btree ("copied_from_id");