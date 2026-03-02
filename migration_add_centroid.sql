-- Adding the centroid column safe execution
ALTER TABLE "virtual_weather_stations" ADD COLUMN IF NOT EXISTS "centroid" text;
