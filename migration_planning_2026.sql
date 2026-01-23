CREATE TABLE IF NOT EXISTS "planning_products_base" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"segment" text,
	"dose_per_ha" numeric(10, 3),
	"price" numeric(10, 2),
	"unit" text,
	"season_id" varchar REFERENCES "seasons"("id"),
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "sales_planning" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL REFERENCES "user_client_links"("id") ON DELETE cascade,
	"user_id" varchar NOT NULL REFERENCES "users"("id"),
	"season_id" varchar NOT NULL REFERENCES "seasons"("id"),
	"total_planting_area" numeric(10, 2),
	"fungicides_area" numeric(10, 2) DEFAULT '0.00',
	"insecticides_area" numeric(10, 2) DEFAULT '0.00',
	"herbicides_area" numeric(10, 2) DEFAULT '0.00',
	"seed_treatment_area" numeric(10, 2) DEFAULT '0.00',
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sales_planning_unique" UNIQUE("client_id","season_id")
);

CREATE TABLE IF NOT EXISTS "sales_planning_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planning_id" varchar NOT NULL REFERENCES "sales_planning"("id") ON DELETE cascade,
	"product_id" varchar NOT NULL REFERENCES "planning_products_base"("id"),
	"quantity" numeric(15, 2) NOT NULL,
	"total_amount" numeric(15, 2) NOT NULL
);
