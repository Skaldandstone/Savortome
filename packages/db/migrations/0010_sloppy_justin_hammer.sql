ALTER TABLE "credit_purchases" ADD COLUMN "refunded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "credit_purchases" ADD COLUMN "refunded_cents" integer;