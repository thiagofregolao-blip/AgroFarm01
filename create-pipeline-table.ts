import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('DATABASE_URL is required');
    process.exit(1);
}

const sql_neon = neon(connectionString);
const db = drizzle(sql_neon);

async function createMissingTables() {
    try {
        console.log('Creating client_category_pipeline table...');

        await db.execute(sql`
      CREATE TABLE IF NOT EXISTS client_category_pipeline (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id VARCHAR NOT NULL REFERENCES user_client_links(id) ON DELETE CASCADE,
        category_id VARCHAR NOT NULL REFERENCES categories(id),
        season_id VARCHAR NOT NULL REFERENCES seasons(id),
        user_id VARCHAR NOT NULL REFERENCES users(id),
        status TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE(client_id, season_id, category_id)
      )
    `);

        console.log('client_category_pipeline table created/exists!');

        console.log('Creating manager_team_rates table...');

        await db.execute(sql`
      CREATE TABLE IF NOT EXISTS manager_team_rates (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        manager_id VARCHAR NOT NULL REFERENCES users(id),
        season_id VARCHAR NOT NULL REFERENCES seasons(id),
        category_id VARCHAR NOT NULL REFERENCES categories(id),
        investment_per_ha DECIMAL(10, 2) NOT NULL,
        subcategories JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE(manager_id, season_id, category_id)
      )
    `);

        console.log('manager_team_rates table created/exists!');

        console.log('All tables created successfully!');
    } catch (error) {
        console.error('Error creating tables:', error);
    }
}

createMissingTables();
