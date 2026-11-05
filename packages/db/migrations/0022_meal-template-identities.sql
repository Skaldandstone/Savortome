CREATE TABLE "meal_template_references" (
  "id" uuid PRIMARY KEY NOT NULL,
  "owner_id" uuid NOT NULL,
  "deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meal_template_references" ADD CONSTRAINT "meal_template_references_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
-- Preserve current grouping identities. IDs deleted before upgrade cannot be
-- reconstructed; no food names or recipe history are stored in this ledger.
INSERT INTO "meal_template_references" ("id", "owner_id")
SELECT "id", "owner_id" FROM "meal_templates"
ON CONFLICT ("id") DO NOTHING;
