CREATE TYPE "public"."template_role" AS ENUM('main', 'side', 'drink', 'dessert');--> statement-breakpoint
CREATE TABLE "meal_template_items" (
	"template_id" uuid NOT NULL,
	"role" "template_role" NOT NULL,
	"recipe_id" uuid NOT NULL,
	CONSTRAINT "meal_template_items_template_id_role_pk" PRIMARY KEY("template_id","role")
);
--> statement-breakpoint
CREATE TABLE "meal_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meal_template_items" ADD CONSTRAINT "meal_template_items_template_id_meal_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."meal_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_template_items" ADD CONSTRAINT "meal_template_items_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_templates" ADD CONSTRAINT "meal_templates_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;