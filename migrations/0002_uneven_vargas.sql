CREATE TABLE "farm_applications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"plot_id" varchar,
	"property_id" varchar NOT NULL,
	"equipment_id" varchar,
	"horimeter" integer,
	"odometer" integer,
	"quantity" numeric(15, 4) NOT NULL,
	"applied_at" timestamp DEFAULT now() NOT NULL,
	"applied_by" text,
	"notes" text,
	"synced_from_offline" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "farm_equipment" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" varchar NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'Ativo',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "farm_expenses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" varchar NOT NULL,
	"plot_id" varchar,
	"property_id" varchar,
	"category" text NOT NULL,
	"description" text,
	"amount" numeric(15, 2) NOT NULL,
	"status" text DEFAULT 'confirmed',
	"expense_date" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "farm_invoice_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" varchar NOT NULL,
	"product_id" varchar,
	"product_code" text,
	"product_name" text NOT NULL,
	"unit" text,
	"quantity" numeric(15, 4) NOT NULL,
	"unit_price" numeric(15, 4) NOT NULL,
	"discount" numeric(15, 2) DEFAULT '0',
	"total_price" numeric(15, 2) NOT NULL,
	"batch" text,
	"expiry_date" timestamp
);
--> statement-breakpoint
CREATE TABLE "farm_invoices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" varchar NOT NULL,
	"season_id" varchar,
	"invoice_number" text,
	"supplier" text,
	"issue_date" timestamp,
	"currency" text DEFAULT 'USD',
	"total_amount" numeric(15, 2),
	"status" text DEFAULT 'pending' NOT NULL,
	"skip_stock_entry" boolean DEFAULT false NOT NULL,
	"raw_pdf_data" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "farm_manuals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"segment" text NOT NULL,
	"content_text" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "farm_pdv_terminals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" varchar NOT NULL,
	"name" text NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"property_id" varchar,
	"type" text DEFAULT 'estoque' NOT NULL,
	"is_online" boolean DEFAULT false,
	"last_heartbeat" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "farm_pdv_terminals_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "farm_plots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" varchar NOT NULL,
	"name" text NOT NULL,
	"area_ha" numeric(12, 2) NOT NULL,
	"crop" text,
	"coordinates" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "farm_products_catalog" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"dose_per_ha" numeric(12, 4),
	"category" text,
	"active_ingredient" text,
	"image_url" text,
	"image_base64" text,
	"status" text DEFAULT 'active' NOT NULL,
	"is_draft" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "farm_properties" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" varchar NOT NULL,
	"name" text NOT NULL,
	"location" text,
	"total_area_ha" numeric(12, 2),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "farm_seasons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" varchar NOT NULL,
	"name" text NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "farm_stock" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"quantity" numeric(15, 4) DEFAULT '0' NOT NULL,
	"average_cost" numeric(15, 4) DEFAULT '0' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "farm_stock_farmer_id_product_id_unique" UNIQUE("farmer_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "farm_stock_movements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" varchar NOT NULL,
	"season_id" varchar,
	"product_id" varchar NOT NULL,
	"type" text NOT NULL,
	"quantity" numeric(15, 4) NOT NULL,
	"unit_cost" numeric(15, 4),
	"reference_type" text,
	"reference_id" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "farms" ADD COLUMN "centroid" text;--> statement-breakpoint
ALTER TABLE "user_client_links" ADD COLUMN "credit_limit" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "whatsapp_number" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "whatsapp_extra_numbers" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "document" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "property_size" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "main_culture" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "region" text;--> statement-breakpoint
ALTER TABLE "farm_applications" ADD CONSTRAINT "farm_applications_farmer_id_users_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_applications" ADD CONSTRAINT "farm_applications_product_id_farm_products_catalog_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."farm_products_catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_applications" ADD CONSTRAINT "farm_applications_plot_id_farm_plots_id_fk" FOREIGN KEY ("plot_id") REFERENCES "public"."farm_plots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_applications" ADD CONSTRAINT "farm_applications_property_id_farm_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."farm_properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_applications" ADD CONSTRAINT "farm_applications_equipment_id_farm_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."farm_equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_equipment" ADD CONSTRAINT "farm_equipment_farmer_id_users_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_expenses" ADD CONSTRAINT "farm_expenses_farmer_id_users_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_expenses" ADD CONSTRAINT "farm_expenses_plot_id_farm_plots_id_fk" FOREIGN KEY ("plot_id") REFERENCES "public"."farm_plots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_expenses" ADD CONSTRAINT "farm_expenses_property_id_farm_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."farm_properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_invoice_items" ADD CONSTRAINT "farm_invoice_items_invoice_id_farm_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."farm_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_invoice_items" ADD CONSTRAINT "farm_invoice_items_product_id_farm_products_catalog_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."farm_products_catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_invoices" ADD CONSTRAINT "farm_invoices_farmer_id_users_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_invoices" ADD CONSTRAINT "farm_invoices_season_id_farm_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."farm_seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_pdv_terminals" ADD CONSTRAINT "farm_pdv_terminals_farmer_id_users_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_pdv_terminals" ADD CONSTRAINT "farm_pdv_terminals_property_id_farm_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."farm_properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_plots" ADD CONSTRAINT "farm_plots_property_id_farm_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."farm_properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_properties" ADD CONSTRAINT "farm_properties_farmer_id_users_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_seasons" ADD CONSTRAINT "farm_seasons_farmer_id_users_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_stock" ADD CONSTRAINT "farm_stock_farmer_id_users_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_stock" ADD CONSTRAINT "farm_stock_product_id_farm_products_catalog_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."farm_products_catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_stock_movements" ADD CONSTRAINT "farm_stock_movements_farmer_id_users_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_stock_movements" ADD CONSTRAINT "farm_stock_movements_season_id_farm_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."farm_seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_stock_movements" ADD CONSTRAINT "farm_stock_movements_product_id_farm_products_catalog_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."farm_products_catalog"("id") ON DELETE no action ON UPDATE no action;