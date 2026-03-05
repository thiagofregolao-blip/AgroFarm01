-- Migration: Create farm_romaneios table + new AI import fields
-- This creates the full table if it doesn't exist

CREATE TABLE IF NOT EXISTS farm_romaneios (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plot_id VARCHAR REFERENCES farm_plots(id),
    property_id VARCHAR REFERENCES farm_properties(id),
    season_id VARCHAR REFERENCES farm_seasons(id),
    buyer TEXT NOT NULL,
    crop TEXT NOT NULL,
    delivery_date TIMESTAMP NOT NULL,
    gross_weight NUMERIC(15,2) NOT NULL,
    tare NUMERIC(15,2) NOT NULL,
    net_weight NUMERIC(15,2) NOT NULL,
    moisture NUMERIC(5,2),
    impurities NUMERIC(5,2),
    moisture_discount NUMERIC(15,2) DEFAULT 0,
    impurity_discount NUMERIC(15,2) DEFAULT 0,
    final_weight NUMERIC(15,2) NOT NULL,
    price_per_ton NUMERIC(15,2),
    currency TEXT NOT NULL DEFAULT 'USD',
    total_value NUMERIC(15,2),
    truck_plate TEXT,
    ticket_number TEXT,
    driver TEXT,
    document_number TEXT,
    discounts JSONB,
    source TEXT NOT NULL DEFAULT 'manual',
    status TEXT NOT NULL DEFAULT 'confirmed',
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Add new columns if table already existed without them
ALTER TABLE farm_romaneios ADD COLUMN IF NOT EXISTS driver TEXT;
ALTER TABLE farm_romaneios ADD COLUMN IF NOT EXISTS document_number TEXT;
ALTER TABLE farm_romaneios ADD COLUMN IF NOT EXISTS discounts JSONB;
ALTER TABLE farm_romaneios ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE farm_romaneios ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'confirmed';

-- Also ensure farm_accounts_receivable table exists (for romaneio -> conta a receber)
CREATE TABLE IF NOT EXISTS farm_accounts_receivable (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    romaneio_id VARCHAR REFERENCES farm_romaneios(id),
    buyer TEXT NOT NULL,
    description TEXT,
    total_amount NUMERIC(15,2),
    currency TEXT NOT NULL DEFAULT 'USD',
    due_date TEXT,
    status TEXT NOT NULL DEFAULT 'pendente',
    created_at TIMESTAMP NOT NULL DEFAULT now()
);
