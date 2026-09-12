-- What a cook can manage, and what a recipe asks for.
--
-- All of it is optional by design. The tier is one tap on first visit to the
-- cook section; the skill ratings and kitchen stock are offered afterwards and
-- may be skipped for good, so "not said" is a permanent, valid state and
-- ranking has to work without it.
--
-- Recipe steps are stored as JSONB and gain `activeSeconds` and `demands`
-- without any migration here; rows written before those fields existed simply
-- do not carry them, and the reading code treats absent as unknown.
ALTER TABLE "users" ADD COLUMN "cook_tier" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "cook_skills" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "kitchen_stock" text;--> statement-breakpoint
-- Nullable with no default: NULL means this recipe has never been analysed,
-- which is a different thing from analysed and found to ask nothing.
ALTER TABLE "recipes" ADD COLUMN "skill_demands" jsonb;
