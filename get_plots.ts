import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL as string);

async function run() {
  const result = await sql`SELECT * FROM farm_plots;`;
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}
run();
