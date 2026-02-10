
import "dotenv/config";
import { storage } from "../server/storage";
import { db, ensureSchema } from "../server/db";
import { sql } from "drizzle-orm";

async function debug() {
    await ensureSchema();

    console.log("--- Debugging Season ---");

    // 1. Get logic-determined active season
    const active = await storage.getActiveSeason();
    console.log("Storage.getActiveSeason() returns:", active ? `${active.name} (${active.id})` : "undefined");

    // 2. Check where products are
    const productSample = await db.execute(sql`SELECT season_id, count(*) as c FROM planning_products_base GROUP BY season_id`);
    console.log("Product Distribution:", productSample);

    // 3. Check dates of all active seasons
    const allActive = await db.execute(sql`SELECT id, name, start_date, end_date FROM seasons WHERE is_active = true`);
    console.log("All Active Seasons:", allActive.map((s: any) => ({
        name: s.name,
        id: s.id,
        start: new Date(s.start_date).toISOString().split('T')[0],
        end: new Date(s.end_date).toISOString().split('T')[0]
    })));

    process.exit(0);
}

debug();
