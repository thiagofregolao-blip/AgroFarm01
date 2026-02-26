-- Backfill farm_price_history from existing confirmed invoice items
-- quantity and unit_price are already numeric columns, no text conversion needed

INSERT INTO farm_price_history (id, farmer_id, purchase_date, supplier, product_name, quantity, unit_price, active_ingredient, created_at)
SELECT
    gen_random_uuid(),
    fi.farmer_id,
    COALESCE(fi.issue_date, fi.created_at),
    COALESCE(fi.supplier, 'Fornecedor Local'),
    COALESCE(fii.product_name, 'Produto'),
    COALESCE(fii.quantity, '0'),
    COALESCE(fii.unit_price, '0'),
    (SELECT fpc.active_ingredient FROM farm_products_catalog fpc WHERE fpc.id = fii.product_id LIMIT 1),
    NOW()
FROM farm_invoice_items fii
JOIN farm_invoices fi ON fi.id = fii.invoice_id
WHERE fi.status = 'confirmed'
  AND fii.product_name IS NOT NULL
  AND fii.product_name != ''
  AND fii.quantity IS NOT NULL
  AND fii.unit_price IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM farm_price_history fph
    WHERE fph.farmer_id = fi.farmer_id
      AND fph.product_name = fii.product_name
      AND fph.purchase_date = COALESCE(fi.issue_date, fi.created_at)
  );
