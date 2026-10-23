-- Retry metadata only; do not reset first capture time or discard old keys.
ALTER TABLE "pending_photo_deletions" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "pending_photo_deletions" ADD COLUMN "last_attempt_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "pending_photo_deletions" ADD COLUMN "retry_after" timestamp with time zone DEFAULT now() NOT NULL;
