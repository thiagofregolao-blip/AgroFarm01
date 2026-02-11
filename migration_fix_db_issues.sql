
-- 1. Add missing column season_id to farm_stock_movements
ALTER TABLE farm_stock_movements 
ADD COLUMN IF NOT EXISTS season_id TEXT REFERENCES farm_seasons(id);

-- 2. Fix farm_applications foreign keys to CASCADE delete (allows property/plot deletion)
-- Drop existing constraints
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'farm_applications_plot_id_fkey') THEN
        ALTER TABLE farm_applications DROP CONSTRAINT farm_applications_plot_id_fkey;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'farm_applications_property_id_fkey') THEN
        ALTER TABLE farm_applications DROP CONSTRAINT farm_applications_property_id_fkey;
    END IF;
END $$;

-- Re-add constraints with ON DELETE CASCADE
ALTER TABLE farm_applications 
ADD CONSTRAINT farm_applications_plot_id_fkey 
FOREIGN KEY (plot_id) REFERENCES farm_plots(id) ON DELETE CASCADE;

ALTER TABLE farm_applications 
ADD CONSTRAINT farm_applications_property_id_fkey 
FOREIGN KEY (property_id) REFERENCES farm_properties(id) ON DELETE CASCADE;

-- 3. Also fix farm_plots foreign key just in case (optional but good practice)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'farm_plots_property_id_fkey') THEN
        ALTER TABLE farm_plots DROP CONSTRAINT farm_plots_property_id_fkey;
    END IF;
END $$;

ALTER TABLE farm_plots
ADD CONSTRAINT farm_plots_property_id_fkey
FOREIGN KEY (property_id) REFERENCES farm_properties(id) ON DELETE CASCADE;
