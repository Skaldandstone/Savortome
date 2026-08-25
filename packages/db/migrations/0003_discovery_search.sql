ALTER TABLE "recipes" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (
        setweight(to_tsvector('english'::regconfig, coalesce("recipes"."title", '')), 'A') ||
        setweight(to_tsvector('english'::regconfig, coalesce("recipes"."cuisine", '')), 'B') ||
        setweight(to_tsvector('english'::regconfig, coalesce("recipes"."description", '')), 'C')
      ) STORED;--> statement-breakpoint
CREATE INDEX "recipes_search_idx" ON "recipes" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "recipes_tags_idx" ON "recipes" USING gin ("tags");