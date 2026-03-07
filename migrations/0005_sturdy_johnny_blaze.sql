CREATE TABLE "farm_grain_contracts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" varchar NOT NULL,
	"season_id" varchar,
	"buyer" text NOT NULL,
	"crop" text NOT NULL,
	"contract_number" text,
	"contract_type" text DEFAULT 'spot' NOT NULL,
	"total_quantity" numeric(15, 2) NOT NULL,
	"delivered_quantity" numeric(15, 2) DEFAULT '0' NOT NULL,
	"price_per_ton" numeric(15, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"total_value" numeric(15, 2) NOT NULL,
	"delivery_start_date" timestamp,
	"delivery_end_date" timestamp,
	"status" text DEFAULT 'aberto' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "farm_grain_deliveries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" varchar NOT NULL,
	"contract_id" varchar NOT NULL,
	"romaneio_id" varchar,
	"quantity" numeric(15, 2) NOT NULL,
	"delivery_date" timestamp DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "farm_grain_stock" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" varchar NOT NULL,
	"crop" text NOT NULL,
	"season_id" varchar,
	"quantity" numeric(15, 2) DEFAULT '0' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "farm_grain_stock_farmer_id_crop_season_id_unique" UNIQUE("farmer_id","crop","season_id")
);
--> statement-breakpoint
CREATE TABLE "global_silos" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" text NOT NULL,
	"branch_name" text,
	"latitude" text,
	"longitude" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "farm_romaneios" ADD COLUMN "driver" text;--> statement-breakpoint
ALTER TABLE "farm_romaneios" ADD COLUMN "document_number" text;--> statement-breakpoint
ALTER TABLE "farm_romaneios" ADD COLUMN "discounts" jsonb;--> statement-breakpoint
ALTER TABLE "farm_romaneios" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "farm_romaneios" ADD COLUMN "status" text DEFAULT 'confirmed' NOT NULL;--> statement-breakpoint
ALTER TABLE "farm_romaneios" ADD COLUMN "global_silo_id" varchar;--> statement-breakpoint
ALTER TABLE "farm_grain_contracts" ADD CONSTRAINT "farm_grain_contracts_farmer_id_users_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_grain_contracts" ADD CONSTRAINT "farm_grain_contracts_season_id_farm_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."farm_seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_grain_deliveries" ADD CONSTRAINT "farm_grain_deliveries_farmer_id_users_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_grain_deliveries" ADD CONSTRAINT "farm_grain_deliveries_contract_id_farm_grain_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."farm_grain_contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_grain_deliveries" ADD CONSTRAINT "farm_grain_deliveries_romaneio_id_farm_romaneios_id_fk" FOREIGN KEY ("romaneio_id") REFERENCES "public"."farm_romaneios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_grain_stock" ADD CONSTRAINT "farm_grain_stock_farmer_id_users_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_grain_stock" ADD CONSTRAINT "farm_grain_stock_season_id_farm_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."farm_seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_romaneios" ADD CONSTRAINT "farm_romaneios_global_silo_id_global_silos_id_fk" FOREIGN KEY ("global_silo_id") REFERENCES "public"."global_silos"("id") ON DELETE no action ON UPDATE no action;