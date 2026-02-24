import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL as string);

async function run() {
  const props = await sql`SELECT id, name, total_area_ha as area, farmer_id FROM farm_properties;`;
  console.log(JSON.stringify(props, null, 2));
  process.exit(0);
}
run();
