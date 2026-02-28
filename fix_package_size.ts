import pg from 'pg';

const { Client } = pg;

async function main() {
  console.log('Running fix for package_size...');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    // Tenta primeiro um CAST com USING
    await client.query(`ALTER TABLE planning_products_base ALTER COLUMN package_size TYPE numeric(10,2) USING package_size::numeric(10,2);`);
    console.log('Successfully fixed package_size using CAST');
  } catch (error) {
    console.log('CAST failed, attempting manual numeric column swap process...', error);
    try {
      await client.query(`ALTER TABLE planning_products_base ADD COLUMN package_size_num numeric(10,2);`);
      await client.query(`UPDATE planning_products_base SET package_size_num = CASE WHEN package_size ~ '^([0-9]+[.]?[0-9]*|[.][0-9]+)$' THEN package_size::numeric(10,2) ELSE NULL END;`);
      await client.query(`ALTER TABLE planning_products_base DROP COLUMN package_size;`);
      await client.query(`ALTER TABLE planning_products_base RENAME COLUMN package_size_num TO package_size;`);
      console.log('Successfully fixed package_size using column swap strategy.');
    } catch (innerError) {
      console.log('Column swap strategy failed:', innerError);
    }
  } finally {
    await client.end();
  }
}

main().then(() => process.exit(0)).catch(() => process.exit(1));
