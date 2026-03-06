CREATE TABLE IF NOT EXISTS global_silos (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL,
    branch_name TEXT,
    latitude TEXT NOT NULL,
    longitude TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

ALTER TABLE farm_romaneios ADD COLUMN IF NOT EXISTS global_silo_id VARCHAR REFERENCES global_silos(id);
