-- Backfill farm_price_history from existing confirmed invoice items
-- Uses safe filtering to skip any rows with non-numeric or empty values

INSERT INTO farm_price_history (id, farmer_id, purchase_date, supplier, product_name, quantity, unit_price, active_ingredient, created_at)
SELECT
    gen_random_uuid(),
    fi.farmer_id,
    COALESCE(fi.issue_date, fi.created_at),
    COALESCE(fi.supplier, 'Fornecedor Local'),
    COALESCE(fii.product_name, 'Produto'),
    REPLACE(fii.quantity, ',', '.')::numeric(15,2),
    REPLACE(fii.unit_price, ',', '.')::numeric(15,2),
    (SELECT fpc.active_ingredient FROM farm_products_catalog fpc WHERE fpc.id = fii.product_id LIMIT 1),
    NOW()
FROM farm_invoice_items fii
JOIN farm_invoices fi ON fi.id = fii.invoice_id
WHERE fi.status = 'confirmed'
  AND fii.product_name IS NOT NULL
  AND fii.product_name != ''
  AND fii.quantity IS NOT NULL
  AND fii.quantity != ''
  AND fii.unit_price IS NOT NULL
  AND fii.unit_price != ''
  AND REPLACE(fii.quantity, ',', '.') ~ '^[0-9]+\.?[0-9]*$'
  AND REPLACE(fii.unit_price, ',', '.') ~ '^[0-9]+\.?[0-9]*$'
  AND REPLACE(fii.quantity, ',', '.')::numeric > 0
  AND REPLACE(fii.unit_price, ',', '.')::numeric > 0
  AND NOT EXISTS (
    SELECT 1 FROM farm_price_history fph
    WHERE fph.farmer_id = fi.farmer_id
      AND fph.product_name = fii.product_name
      AND fph.purchase_date = COALESCE(fi.issue_date, fi.created_at)
  );
