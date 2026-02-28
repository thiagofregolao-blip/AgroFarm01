CREATE TABLE IF NOT EXISTS "virtual_weather_stations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"farm_id" varchar,
	"user_id" varchar NOT NULL,
	"lat" numeric(10, 7) NOT NULL,
	"lng" numeric(10, 7) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "weather_history_logs" (
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

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'virtual_weather_stations_farm_id_farm_properties_id_fk') THEN
        ALTER TABLE "virtual_weather_stations" ADD CONSTRAINT "virtual_weather_stations_farm_id_farm_properties_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farm_properties"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'virtual_weather_stations_user_id_users_id_fk') THEN
        ALTER TABLE "virtual_weather_stations" ADD CONSTRAINT "virtual_weather_stations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'weather_history_logs_station_id_virtual_weather_stations_id_fk') THEN
        ALTER TABLE "weather_history_logs" ADD CONSTRAINT "weather_history_logs_station_id_virtual_weather_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."virtual_weather_stations"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
