
import "dotenv/config";
import { db, ensureSchema } from "../server/db";
import { sql } from "drizzle-orm";

async function check() {
    console.log("Initializing database connection...");
    // Wait for DB to be configured
    await ensureSchema();

    console.log("Checking database tables...");

    try {
        const result = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

        const tables = result.map((r: any) => r.table_name);
        console.log("Tables found:", tables);

        const planningTables = tables.filter((t: string) => t.includes('planning') || t.includes('product'));
        console.log("Planning/Product related tables:", planningTables);

        // Check specific table content if they exist
        if (tables.includes('planning_products_base')) {
            const count = await db.execute(sql`SELECT count(*) as c FROM planning_products_base`);
            console.log(`planning_products_base count: ${count[0].c}`);

            // Check filtering column
            // Check filtering column
            const sample = await db.execute(sql`SELECT id, segment, season_id FROM planning_products_base LIMIT 5`);
            console.log("Product Sample IDs:", sample.map((p: any) => ({ pid: p.id, season: p.season_id })));

            // Check Sales Planning
            const planning = await db.execute(sql`SELECT id, season_id FROM sales_planning LIMIT 5`);
            console.log("Sales Planning Sample:", planning);

            // Check seasons
            const seasons = await db.execute(sql`SELECT id, name, start_date, end_date FROM seasons WHERE is_active = true`);
            console.log("Active Seasons:", seasons.map((s: any) => ({ id: s.id, name: s.name })));

            // Check mismatch
            const mismatched = sample.filter((p: any) => !seasons.some((s: any) => s.id === p.season_id));
            if (mismatched.length > 0) {
                console.warn("⚠️ POTENTIAL SEASON MISMATCH: Products exist but do not match any active season ID.");
                console.warn(`Product Season ID: ${mismatched[0].season_id}`);
                if (seasons.length > 0) console.warn(`Active Season ID: ${seasons[0].id}`);
            } else {
                console.log("✅ Products match active season.");
            }
        } else {
            console.error("CRITICAL: planning_products_base table MISSING!");
        }

    } catch (e) {
        console.error("Error querying DB:", e);
    }

    process.exit(0);
}

check();
