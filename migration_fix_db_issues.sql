
-- 1. Add missing column season_id to farm_stock_movements (nullable, FK added later if farm_seasons exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'farm_stock_movements' AND column_name = 'season_id') THEN
        ALTER TABLE farm_stock_movements 
        ADD COLUMN season_id TEXT;
    END IF;
    
    -- Add foreign key constraint only if farm_seasons table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'farm_seasons') THEN
        -- Drop existing constraint if exists
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'farm_stock_movements_season_id_fkey') THEN
            ALTER TABLE farm_stock_movements DROP CONSTRAINT farm_stock_movements_season_id_fkey;
        END IF;
        -- Add foreign key constraint
        ALTER TABLE farm_stock_movements 
        ADD CONSTRAINT farm_stock_movements_season_id_fkey 
        FOREIGN KEY (season_id) REFERENCES farm_seasons(id);
    END IF;
END $$;

-- 2. Add season_id to farm_invoices (nullable, FK added later if farm_seasons exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'farm_invoices' AND column_name = 'season_id') THEN
        ALTER TABLE farm_invoices 
        ADD COLUMN season_id TEXT;
    END IF;
    
    -- Add foreign key constraint only if farm_seasons table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'farm_seasons') THEN
        -- Drop existing constraint if exists
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'farm_invoices_season_id_fkey') THEN
            ALTER TABLE farm_invoices DROP CONSTRAINT farm_invoices_season_id_fkey;
        END IF;
        -- Add foreign key constraint
        ALTER TABLE farm_invoices 
        ADD CONSTRAINT farm_invoices_season_id_fkey 
        FOREIGN KEY (season_id) REFERENCES farm_seasons(id);
    END IF;
END $$;

-- 3. Fix farm_applications foreign keys to CASCADE delete (allows property/plot deletion)
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

-- 4. Also fix farm_plots foreign key just in case (optional but good practice)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'farm_plots_property_id_fkey') THEN
        ALTER TABLE farm_plots DROP CONSTRAINT farm_plots_property_id_fkey;
    END IF;
END $$;

ALTER TABLE farm_plots
ADD CONSTRAINT farm_plots_property_id_fkey
FOREIGN KEY (property_id) REFERENCES farm_properties(id) ON DELETE CASCADE;
