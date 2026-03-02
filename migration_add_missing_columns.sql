-- Add missing columns that exist in Drizzle schema but not in the database
-- This prevents PostgresError "column does not exist" crashes

-- farms table (CRM) - centroid column referenced in schema.ts
ALTER TABLE "farms" ADD COLUMN IF NOT EXISTS "centroid" text;

-- farm_plots table - coordinates and centroid columns referenced in schema.ts
ALTER TABLE "farm_plots" ADD COLUMN IF NOT EXISTS "coordinates" text;
ALTER TABLE "farm_plots" ADD COLUMN IF NOT EXISTS "centroid" text;
