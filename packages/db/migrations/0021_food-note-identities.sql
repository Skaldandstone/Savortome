CREATE TABLE "food_note_references" (
	"user_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "food_note_references_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
ALTER TABLE "food_note_references" ADD CONSTRAINT "food_note_references_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
-- Preserve retry identities for notes present at upgrade. IDs deleted before
-- this migration cannot be reconstructed and are not inferred from history.
INSERT INTO "food_note_references" ("user_id", "id")
SELECT "user_id", "id" FROM "food_log_entries"
ON CONFLICT ("user_id", "id") DO NOTHING;
