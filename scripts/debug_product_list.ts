import { db } from "../server/db";
import { seasons, planningProductsBase } from "../shared/schema";
import { eq, desc, and } from "drizzle-orm";

async function main() {
    console.log("=== DEBUGGING PRODUCT LIST DISPLAY ===\n");

    // 1. Check active seasons
    console.log("1. ACTIVE SEASONS:");
    const activeSeasons = await db.select().from(seasons).where(eq(seasons.isActive, true));
    console.log(`   Found ${activeSeasons.length} active season(s):`);
    activeSeasons.forEach(s => {
        console.log(`   - ID: ${s.id}`);
        console.log(`     Name: ${s.name}`);
        console.log(`     Start: ${s.startDate}, End: ${s.endDate}`);
    });

    // 2. Check which season getActiveSeason would return (simulating logic)
    console.log("\n2. GET ACTIVE SEASON LOGIC WOULD RETURN:");
    const now = new Date();
    const sortedSeasons = activeSeasons.sort((a, b) =>
        new Date(b.endDate).getTime() - new Date(a.endDate).getTime()
    );

    const activeByDate = sortedSeasons.find(s => {
        const start = new Date(s.startDate);
        const end = new Date(s.endDate);
        return start <= now && end >= now;
    });

    const selectedSeason = activeByDate || sortedSeasons[0];
    console.log(`   Selected: ${selectedSeason?.name} (ID: ${selectedSeason?.id})`);

    // 3. Check all products and their season IDs
    console.log("\n3. PRODUCTS IN planning_products_base:");
    const allProducts = await db.select().from(planningProductsBase);
    console.log(`   Total products: ${allProducts.length}`);

    // Group by seasonId
    const bySeasonId: Record<string, number> = {};
    allProducts.forEach(p => {
        const sid = p.seasonId || "NULL";
        bySeasonId[sid] = (bySeasonId[sid] || 0) + 1;
    });

    console.log("   Products by seasonId:");
    Object.entries(bySeasonId).forEach(([sid, count]) => {
        console.log(`   - ${sid}: ${count} products`);
    });

    // 4. Simulate getPlanningProducts call
    console.log("\n4. SIMULATING getPlanningProducts (NOW GLOBAL):");
    const productsFromQuery = await db.select().from(planningProductsBase).orderBy(planningProductsBase.name);
    console.log(`   Query returns: ${productsFromQuery.length} products`);

    if (productsFromQuery.length > 0) {
        console.log("   First 3 products:");
        productsFromQuery.slice(0, 3).forEach(p => {
            console.log(`   - ${p.name} (segment: ${p.segment}, seasonId: ${p.seasonId})`);
        });
    }

    // 5. Final diagnosis
    console.log("\n=== DIAGNOSIS ===");
    if (productsFromQuery.length === 0) {
        console.log("❌ NO PRODUCTS IN DATABASE! Need to reimport.");
    } else if (!selectedSeason) {
        console.log("❌ NO ACTIVE SEASON! Frontend can't load products.");
    } else {
        console.log("✅ Products exist and active season is set.");
        console.log("   If products still not showing:");
        console.log("   - Check if server has latest code (rebuild/restart?)");
        console.log("   - Check browser Network tab for API response");
        console.log("   - Check browser Console for errors");
    }

    process.exit(0);
}

main().catch(e => {
    console.error("Script error:", e);
    process.exit(1);
});
