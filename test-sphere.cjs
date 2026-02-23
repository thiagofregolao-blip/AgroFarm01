require('dotenv/config');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  const res = await pool.query("SELECT * FROM farm_invoice_items WHERE product_name ILIKE '%SPHERE%'");
  console.log('Invoices SPHERE:', res.rows);
  pool.end();
}
check();
