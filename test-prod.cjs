require('dotenv/config');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  try {
    const res = await pool.query("SELECT id, invoice_number, farmer_id FROM farm_invoices LIMIT 5");
    console.log("Invoices:", res.rows);
    
    // Check sphere items specifically
    const items = await pool.query("SELECT invoice_id, product_name, unit_price FROM farm_invoice_items WHERE product_name ILIKE '%SPHERE%'");
    console.log("SPHERE ITEMS:", items.rows);
    
    // Check user id 
    const users = await pool.query("SELECT id, username FROM users WHERE whatsapp_number LIKE '%595986848326%'");
    console.log("USER:", users.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
run();
