-- Farm Employees table for diesel receipt facial recognition
CREATE TABLE IF NOT EXISTS farm_employees (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name text NOT NULL,
    role text NOT NULL,
    phone text,
    status text DEFAULT 'Ativo',
    photo_base64 text,
    signature_base64 text,
    created_at timestamp NOT NULL DEFAULT now()
);
