import { pool, dbReady } from "./server/db";

async function main() {
  await dbReady;

  try {
    const resUsers = await pool.unsafe("SELECT id, name, username, role FROM users WHERE name ILIKE '%Sergio%' OR name ILIKE '%Sérgio%' OR username ILIKE '%sergio%'");
    console.log("USERS:", resUsers);
  } catch (e) { console.error("users error", e.message); }

  try {
    const resFarmers = await pool.unsafe("SELECT id, name, username FROM farm_farmers WHERE name ILIKE '%Sergio%' OR name ILIKE '%Sérgio%' OR username ILIKE '%sergio%'");
    console.log("FARMERS:", resFarmers);
  } catch (e) { console.error("farmers error", e.message); }

  process.exit(0);
}
main().catch(console.error);
