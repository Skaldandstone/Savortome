CREATE TYPE "public"."extraction_method" AS ENUM('schema-org', 'article-llm', 'transcript-llm', 'caption-llm', 'manual');--> statement-breakpoint
CREATE TYPE "public"."friendship_status" AS ENUM('pending', 'accepted', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('queued', 'resolving', 'extracting', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."shelf_type" AS ENUM('want_to_cook', 'cooking', 'cooked', 'custom');--> statement-breakpoint
CREATE TYPE "public"."source_kind" AS ENUM('youtube', 'tiktok', 'instagram', 'facebook', 'web', 'manual', 'text');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('private', 'friends', 'public');--> statement-breakpoint
CREATE TABLE "cart_handoffs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"handoff_url" text NOT NULL,
	"unmatched_items" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"user_id" uuid NOT NULL,
	"friend_id" uuid NOT NULL,
	"status" "friendship_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friendships_user_id_friend_id_pk" PRIMARY KEY("user_id","friend_id")
);
--> statement-breakpoint
CREATE TABLE "imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"url" text,
	"raw_text" text,
	"status" "import_status" DEFAULT 'queued' NOT NULL,
	"recipe_id" uuid,
	"trace" text[] DEFAULT '{}' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "pantry_items" (
	"user_id" uuid NOT NULL,
	"canonical_item" text NOT NULL,
	"display_name" text NOT NULL,
	"quantity" real,
	"unit" text,
	"is_staple" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pantry_items_user_id_canonical_item_pk" PRIMARY KEY("user_id","canonical_item")
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"user_id" uuid NOT NULL,
	"recipe_id" uuid NOT NULL,
	"stars" integer NOT NULL,
	"review" text,
	"times_cooked" integer DEFAULT 0 NOT NULL,
	"last_cooked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ratings_user_id_recipe_id_pk" PRIMARY KEY("user_id","recipe_id")
);
--> statement-breakpoint
CREATE TABLE "recipe_ingredients" (
	"recipe_id" uuid NOT NULL,
	"canonical_item" text NOT NULL,
	"optional" boolean DEFAULT false NOT NULL,
	"is_staple" boolean DEFAULT false NOT NULL,
	CONSTRAINT "recipe_ingredients_recipe_id_canonical_item_pk" PRIMARY KEY("recipe_id","canonical_item")
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"image_url" text,
	"servings" integer,
	"servings_note" text,
	"prep_minutes" integer,
	"cook_minutes" integer,
	"total_minutes" integer,
	"ingredients" jsonb NOT NULL,
	"steps" jsonb NOT NULL,
	"equipment" text[] DEFAULT '{}' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"cuisine" text,
	"course" text,
	"difficulty" text,
	"source_kind" "source_kind" NOT NULL,
	"source_url" text,
	"source_author" text,
	"source_site_name" text,
	"extraction_method" "extraction_method" NOT NULL,
	"confidence" real DEFAULT 1 NOT NULL,
	"extraction_notes" text[] DEFAULT '{}' NOT NULL,
	"verified_at" timestamp with time zone,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"embedding" vector(1024),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shelf_recipes" (
	"shelf_id" uuid NOT NULL,
	"recipe_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shelf_recipes_shelf_id_recipe_id_pk" PRIMARY KEY("shelf_id","recipe_id")
);
--> statement-breakpoint
CREATE TABLE "shelves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "shelf_type" DEFAULT 'custom' NOT NULL,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shelves_user_name_key" UNIQUE("user_id","name")
);
--> statement-breakpoint
CREATE TABLE "shopping_list_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"canonical_item" text NOT NULL,
	"display_name" text NOT NULL,
	"quantity" real,
	"unit" text,
	"recipe_ids" uuid[] DEFAULT '{}' NOT NULL,
	"checked" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text DEFAULT 'Shopping list' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_id" text,
	"email" text NOT NULL,
	"handle" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cart_handoffs" ADD CONSTRAINT "cart_handoffs_list_id_shopping_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."shopping_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_friend_id_users_id_fk" FOREIGN KEY ("friend_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "imports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "imports_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pantry_items" ADD CONSTRAINT "pantry_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shelf_recipes" ADD CONSTRAINT "shelf_recipes_shelf_id_shelves_id_fk" FOREIGN KEY ("shelf_id") REFERENCES "public"."shelves"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shelf_recipes" ADD CONSTRAINT "shelf_recipes_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shelves" ADD CONSTRAINT "shelves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_list_id_shopping_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."shopping_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cart_handoffs_list_idx" ON "cart_handoffs" USING btree ("list_id");--> statement-breakpoint
CREATE INDEX "friendships_friend_idx" ON "friendships" USING btree ("friend_id");--> statement-breakpoint
CREATE INDEX "imports_user_idx" ON "imports" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ratings_recipe_idx" ON "ratings" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_ingredients_item_idx" ON "recipe_ingredients" USING btree ("canonical_item");--> statement-breakpoint
CREATE INDEX "recipes_owner_idx" ON "recipes" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "recipes_visibility_idx" ON "recipes" USING btree ("visibility","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "recipes_owner_source_idx" ON "recipes" USING btree ("owner_id","source_url") WHERE "recipes"."source_url" is not null;--> statement-breakpoint
CREATE INDEX "shelf_recipes_recipe_idx" ON "shelf_recipes" USING btree ("recipe_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shelves_user_status_idx" ON "shelves" USING btree ("user_id","type") WHERE "shelves"."type" <> 'custom';--> statement-breakpoint
CREATE INDEX "shopping_list_items_list_idx" ON "shopping_list_items" USING btree ("list_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_clerk_idx" ON "users" USING btree ("clerk_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_handle_idx" ON "users" USING btree ("handle");