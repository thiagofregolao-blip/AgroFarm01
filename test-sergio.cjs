require('dotenv/config');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const result = await pool.query("SELECT id, name, role, manager_id FROM users WHERE name ILIKE '%sergio%'");
  console.log("Sergio:", result.rows);
  const thiago = await pool.query("SELECT id, name, role FROM users WHERE name ILIKE '%thiago%'");
  console.log("Thiago:", thiago.rows);
  pool.end();
}
run();
