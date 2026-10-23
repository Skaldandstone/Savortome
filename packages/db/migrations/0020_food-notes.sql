CREATE TABLE "food_log_entries" (
	"user_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"date" date NOT NULL,
	"title" text NOT NULL,
	"portion" text,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "food_log_entries_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
ALTER TABLE "food_log_entries" ADD CONSTRAINT "food_log_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "food_log_user_date_idx" ON "food_log_entries" USING btree ("user_id","date");