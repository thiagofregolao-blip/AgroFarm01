import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function migrate() {
    console.log("Creating farm_manuals table...");
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "farm_manuals" (
            "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            "title" text NOT NULL,
            "segment" text NOT NULL,
            "content_text" text NOT NULL,
            "created_at" timestamp DEFAULT now() NOT NULL
        );
    `);
    console.log("Migration complete.");
    process.exit(0);
}

migrate().catch(err => {
    console.error(err);
    process.exit(1);
});
