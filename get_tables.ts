import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL as string);

async function run() {
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND (table_name LIKE '%prop%' OR table_name LIKE '%farm%' OR table_name LIKE '%area%');
  `;
  console.log("Tables:", tables.map(t => t.table_name));
  process.exit(0);
}
run();
