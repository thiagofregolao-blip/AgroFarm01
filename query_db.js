import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
async function run() {
  await client.connect();
  const res = await client.query('SELECT id, name, "totalAreaHa" FROM farm_properties;');
  console.log(res.rows);
  await client.end();
}
run();
