
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function runMigration() {
    console.log("Running migration: add image_base64 to farm_products_catalog...");

    try {
        await db.execute(sql`
      ALTER TABLE farm_products_catalog 
      ADD COLUMN IF NOT EXISTS image_base64 text;
    `);
        console.log("Migration completed successfully.");
    } catch (error) {
        console.error("Migration failed:", error);
    }
    process.exit(0);
}

runMigration();
