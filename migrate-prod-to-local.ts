import pg from 'pg';
import fs from 'fs';

const PRODUCTION_URL = "postgresql://neondb_owner:npg_ANrbL4Phpzg0@ep-orange-surf-ae5taxnh.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";
const LOCAL_URL = "postgresql://localhost:3000/agrofarm";

// Tables to export (in order of dependencies)
const TABLES = [
    'users',
    'regions',
    'categories',
    'subcategories',
    'products',
    'seasons',
    'master_clients',
    'user_client_links',
    'sales',
    'season_goals',
    'client_market_rates',
    'client_market_values',
    'market_benchmarks',
    'external_purchases',
    'purchase_history',
    'purchase_history_items',
    'client_family_relations',
    'alert_settings',
    'alerts',
    'barter_simulations',
    'barter_simulation_items',
    'farms',
    'fields',
    'sales_history',
    'password_reset_tokens',
    'products_price_table',
    'global_management_applications',
    'client_application_tracking',
    'client_category_pipeline',
    'manager_team_rates',
    'system_settings'
];

async function exportFromProduction() {
    console.log('🔗 Connecting to production database...');
    const prodClient = new pg.Client({
        connectionString: PRODUCTION_URL,
        ssl: { rejectUnauthorized: false }
    });
    await prodClient.connect();
    console.log('✅ Connected to production!\n');

    const data: Record<string, any[]> = {};

    for (const table of TABLES) {
        try {
            console.log(`📥 Exporting ${table}...`);
            const result = await prodClient.query(`SELECT * FROM "${table}"`);
            data[table] = result.rows;
            console.log(`   ✅ ${result.rows.length} rows`);
        } catch (error: any) {
            if (error.message?.includes('does not exist')) {
                console.log(`   ⚠️ Table ${table} does not exist, skipping`);
                data[table] = [];
            } else {
                console.error(`   ❌ Error: ${error.message}`);
                data[table] = [];
            }
        }
    }

    await prodClient.end();

    // Save to JSON file
    fs.writeFileSync('production_backup.json', JSON.stringify(data, null, 2));
    console.log('\n💾 Saved to production_backup.json');

    return data;
}

async function importToLocal(data: Record<string, any[]>) {
    console.log('\n🔗 Connecting to local database...');
    const client = new pg.Client({ connectionString: LOCAL_URL });
    await client.connect();
    console.log('✅ Connected to local!\n');

    // Disable foreign key checks temporarily
    await client.query('SET session_replication_role = replica;');

    for (const table of TABLES) {
        const rows = data[table];
        if (!rows || rows.length === 0) {
            console.log(`⏭️ Skipping ${table} (no data)`);
            continue;
        }

        try {
            // Clear existing data
            await client.query(`DELETE FROM "${table}"`);

            // Insert new data
            console.log(`📤 Importing ${table}... (${rows.length} rows)`);

            let imported = 0;
            for (const row of rows) {
                const columns = Object.keys(row);
                const values = Object.values(row);
                const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
                const columnNames = columns.map(c => `"${c}"`).join(', ');

                try {
                    await client.query(
                        `INSERT INTO "${table}" (${columnNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
                        values
                    );
                    imported++;
                } catch (insertError: any) {
                    // Skip individual row errors silently
                }
            }
            console.log(`   ✅ ${imported}/${rows.length} rows imported`);
        } catch (error: any) {
            console.error(`   ❌ Error importing ${table}: ${error.message}`);
        }
    }

    // Re-enable foreign key checks
    await client.query('SET session_replication_role = DEFAULT;');

    await client.end();
    console.log('\n✅ Import complete!');
}

async function main() {
    console.log('🚀 Starting database migration from Production to Local\n');

    const data = await exportFromProduction();
    await importToLocal(data);

    console.log('\n🎉 Migration completed successfully!');
    console.log('You can now run: npm run dev');
}

main().catch(console.error);
