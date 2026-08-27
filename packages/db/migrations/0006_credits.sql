CREATE TYPE "public"."credit_source" AS ENUM('allowance', 'purchased');--> statement-breakpoint
CREATE TYPE "public"."user_tier" AS ENUM('free', 'plus', 'pro');--> statement-breakpoint
CREATE TABLE "credit_spends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"month" text NOT NULL,
	"source" "credit_source" NOT NULL,
	"recipe_id" uuid,
	"method" "extraction_method" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "tier" "user_tier" DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "credits_purchased" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "credit_spends" ADD CONSTRAINT "credit_spends_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_spends" ADD CONSTRAINT "credit_spends_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_spends_user_month_idx" ON "credit_spends" USING btree ("user_id","month","source");--> statement-breakpoint
CREATE INDEX "credit_spends_user_source_idx" ON "credit_spends" USING btree ("user_id","source");