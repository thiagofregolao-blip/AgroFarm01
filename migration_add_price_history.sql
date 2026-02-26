CREATE TABLE IF NOT EXISTS farm_price_history (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purchase_date timestamp NOT NULL,
    supplier text,
    product_name text NOT NULL,
    quantity numeric(15, 2) NOT NULL,
    unit_price numeric(15, 2) NOT NULL,
    active_ingredient text,
    created_at timestamp NOT NULL DEFAULT now()
);
