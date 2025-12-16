import pg from 'pg';
import fs from 'fs';

const LOCAL_URL = "postgresql://localhost:3000/agrofarm";

async function fixImport() {
  const data = JSON.parse(fs.readFileSync('production_backup.json', 'utf-8'));
  
  console.log('🔗 Connecting to local database...');
  const client = new pg.Client({ connectionString: LOCAL_URL });
  await client.connect();
  
  // Disable ALL constraints
  await client.query('SET session_replication_role = replica;');
  
  // Force import user_client_links
  const rows = data.user_client_links;
  console.log(`📤 Force importing user_client_links... (${rows.length} rows)`);
  
  await client.query('DELETE FROM "user_client_links"');
  
  let imported = 0;
  for (const row of rows) {
    const columns = Object.keys(row);
    const values = Object.values(row);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const columnNames = columns.map(c => `"${c}"`).join(', ');
    
    try {
      await client.query(
        `INSERT INTO "user_client_links" (${columnNames}) VALUES (${placeholders})`,
        values
      );
      imported++;
    } catch (e: any) {
      console.log(`Error on row: ${e.message}`);
    }
  }
  
  console.log(`✅ ${imported}/${rows.length} rows imported`);
  
  // Also import farms
  const farms = data.farms;
  if (farms && farms.length > 0) {
    console.log(`📤 Force importing farms... (${farms.length} rows)`);
    await client.query('DELETE FROM "farms"');
    for (const row of farms) {
      const columns = Object.keys(row);
      const values = Object.values(row);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const columnNames = columns.map(c => `"${c}"`).join(', ');
      try {
        await client.query(
          `INSERT INTO "farms" (${columnNames}) VALUES (${placeholders})`,
          values
        );
      } catch (e: any) {
        console.log(`Farm error: ${e.message}`);
      }
    }
  }
  
  await client.query('SET session_replication_role = DEFAULT;');
  await client.end();
  
  console.log('✅ Done!');
}

fixImport().catch(console.error);
