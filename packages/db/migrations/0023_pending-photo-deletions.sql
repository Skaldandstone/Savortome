-- Keys must survive account cascades. No user FK, URL, image bytes or error text.
-- This records future removals only; it cannot recover historic orphan keys.
CREATE TABLE "pending_photo_deletions" (
  "key" text PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE FUNCTION "capture_removed_recipe_photos"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  photo jsonb;
  object_key text;
  remaining jsonb := '[]'::jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN remaining := COALESCE(NEW.photos, '[]'::jsonb); END IF;
  FOR photo IN SELECT value FROM jsonb_array_elements(COALESCE(OLD.photos, '[]'::jsonb)) LOOP
    object_key := photo->>'key';
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(remaining) AS retained(value)
                   WHERE retained.value->>'key' = object_key) THEN
      -- Never make another account/recipe's key eligible for erasure. Invalid
      -- legacy descriptors fail closed and require explicit source repair.
      IF object_key IS NULL OR length(object_key) > 1024
         OR left(object_key, length('recipes/' || OLD.owner_id::text || '/' || OLD.id::text || '/'))
            <> 'recipes/' || OLD.owner_id::text || '/' || OLD.id::text || '/'
         OR object_key !~ '^recipes/[0-9a-f-]+/[0-9a-f-]+/[0-9a-f-]+\.(jpg|png|webp)$' THEN
        RAISE EXCEPTION 'Invalid recipe photo deletion reference';
      END IF;
      INSERT INTO pending_photo_deletions(key) VALUES (object_key) ON CONFLICT (key) DO NOTHING;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "recipe_photo_deletion_capture"
AFTER DELETE OR UPDATE OF photos ON "recipes"
FOR EACH ROW EXECUTE FUNCTION "capture_removed_recipe_photos"();
