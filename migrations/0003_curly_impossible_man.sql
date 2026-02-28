CREATE TABLE "farm_price_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" varchar NOT NULL,
	"purchase_date" timestamp NOT NULL,
	"supplier" text,
	"product_name" text NOT NULL,
	"quantity" numeric(15, 2) NOT NULL,
	"unit_price" numeric(15, 2) NOT NULL,
	"active_ingredient" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_modules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"module_key" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_modules_user_id_module_key_unique" UNIQUE("user_id","module_key")
);
--> statement-breakpoint
CREATE TABLE "virtual_weather_stations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"farm_id" varchar,
	"user_id" varchar NOT NULL,
	"lat" numeric(10, 7) NOT NULL,
	"lng" numeric(10, 7) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weather_history_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" varchar NOT NULL,
	"ts" timestamp NOT NULL,
	"temperature" numeric(5, 2),
	"precipitation" numeric(8, 2),
	"wind_speed" numeric(5, 2),
	"humidity" integer,
	"clouds" integer,
	"raw_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "farm_invoices" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "farm_invoices" ADD COLUMN "source_email_id" text;--> statement-breakpoint
ALTER TABLE "farm_invoices" ADD COLUMN "source_email_from" text;--> statement-breakpoint
ALTER TABLE "farm_invoices" ADD COLUMN "pdf_base64" text;--> statement-breakpoint
ALTER TABLE "farm_plots" ADD COLUMN "centroid" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "invoice_email" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "accountant_email" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "farm_latitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "farm_longitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "farm_city" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bulletin_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "farm_price_history" ADD CONSTRAINT "farm_price_history_farmer_id_users_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_modules" ADD CONSTRAINT "user_modules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "virtual_weather_stations" ADD CONSTRAINT "virtual_weather_stations_farm_id_farm_properties_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farm_properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "virtual_weather_stations" ADD CONSTRAINT "virtual_weather_stations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weather_history_logs" ADD CONSTRAINT "weather_history_logs_station_id_virtual_weather_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."virtual_weather_stations"("id") ON DELETE cascade ON UPDATE no action;