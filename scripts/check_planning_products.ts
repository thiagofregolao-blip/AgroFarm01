
import 'dotenv/config'; // Load env vars
import { db, dbReady } from "../server/db";
import { planningProductsBase } from "../shared/schema";

async function main() {
    await dbReady; // Wait for DB intialization
    console.log("Checking planning_products_base table...");
    try {
        const products = await db.select().from(planningProductsBase);
        console.log(`Total rows found: ${products.length}`);
        if (products.length > 0) {
            console.log("Sample rows:");
            console.table(products.slice(0, 5));
        } else {
            console.log("Table is empty.");
        }
    } catch (error) {
        console.error("Error querying database:", error);
    }
    process.exit(0);
}

main();
