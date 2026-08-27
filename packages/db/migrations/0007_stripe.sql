CREATE TABLE "credit_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" text NOT NULL,
	"cents" integer NOT NULL,
	"credits" integer DEFAULT 0 NOT NULL,
	"tier" "user_tier",
	"stripe_session_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "credit_purchases" ADD CONSTRAINT "credit_purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_purchases_user_idx" ON "credit_purchases" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_purchases_session_idx" ON "credit_purchases" USING btree ("stripe_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_stripe_customer_idx" ON "users" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "users_stripe_subscription_idx" ON "users" USING btree ("stripe_subscription_id");