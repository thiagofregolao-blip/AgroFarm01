-- Add additional fields to farm_farmers table
ALTER TABLE farm_farmers 
ADD COLUMN IF NOT EXISTS property_size DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS main_culture TEXT,
ADD COLUMN IF NOT EXISTS region TEXT;
