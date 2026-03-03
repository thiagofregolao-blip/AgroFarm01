ALTER TABLE farm_expenses
ADD COLUMN IF NOT EXISTS equipment_id VARCHAR(255) REFERENCES farm_equipment(id);

