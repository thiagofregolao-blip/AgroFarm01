
import { db } from "../server/db";
import { planningGlobalConfigurations } from "../shared/schema";
import { sql } from "drizzle-orm";

async function checkDuplicates() {
    console.log("Checking for duplicates in planning_global_configurations...");

    try {
        const results = await db.execute(sql`
      SELECT user_id, season_id, COUNT(*) as count, json_agg(json_build_object('id', id, 'updated_at', updated_at, 'product_count', jsonb_array_length(product_ids))) as items
      FROM planning_global_configurations
      GROUP BY user_id, season_id
      HAVING COUNT(*) > 1
    `);

        if (results.length === 0) {
            console.log("✅ No duplicates found.");
        } else {
            console.log(`⚠️ Found duplicates for ${results.length} user/season pairs:`);
            console.log(JSON.stringify(results, null, 2));

            // Auto-fix?
            console.log("Attempting to auto-fix by keeping the most recently updated record...");

            for (const group of results) {
                // Sort detail items by updated_at desc
                // @ts-ignore
                const items = group.items.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

                const winner = items[0];
                const losers = items.slice(1);

                console.log(`Keeping winner: ${winner.id} (${winner.updated_at}), deleting ${losers.length} losers.`);

                const loserIds = losers.map((l: any) => l.id);

                if (loserIds.length > 0) {
                    await db.execute(sql`DELETE FROM planning_global_configurations WHERE id IN ${sql(loserIds)}`);
                }
            }
            console.log("✅ Duplicates cleaned up.");
        }

        // Add Constraint if not exists
        console.log("Ensuring unique constraint...");
        try {
            await db.execute(sql`
            ALTER TABLE planning_global_configurations 
            ADD CONSTRAINT planning_global_configurations_user_id_season_id_unique UNIQUE (user_id, season_id);
        `);
            console.log("✅ Unique constraint added.");
        } catch (e: any) {
            if (e.message.includes('already exists')) {
                console.log("Constraint already exists.");
            } else {
                console.error("Error adding constraint:", e);
            }
        }

    } catch (error) {
        console.error("Error:", error);
    }
    process.exit(0);
}

checkDuplicates();
