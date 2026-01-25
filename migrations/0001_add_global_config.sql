CREATE TABLE "planning_global_configurations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"season_id" varchar NOT NULL,
	"product_ids" jsonb DEFAULT '[]' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "planning_global_configurations_user_id_season_id_unique" UNIQUE("user_id","season_id")
);
--> statement-breakpoint
ALTER TABLE "planning_global_configurations" ADD CONSTRAINT "planning_global_configurations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_global_configurations" ADD CONSTRAINT "planning_global_configurations_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;