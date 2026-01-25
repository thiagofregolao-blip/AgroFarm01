
import 'dotenv/config';
import { db, dbReady } from "../server/db";
import { planningProductsBase, sales, products } from "../shared/schema";
import { eq } from "drizzle-orm";

async function main() {
    await dbReady;

    // Get all planning products
    const planningProds = await db.select().from(planningProductsBase);
    console.log(`Total Planning Products: ${planningProds.length}`);
    if (planningProds.length > 0) {
        console.log("Sample Planning Names:", planningProds.slice(0, 5).map(p => p.name));
    }

    // Get sales distinct product names
    const history = await db.selectDistinct({ productName: products.name })
        .from(sales)
        .innerJoin(products, eq(sales.productId, products.id));

    console.log(`Total Historical Products: ${history.length}`);
    if (history.length > 0) {
        console.log("Sample Historical Names:", history.slice(0, 5).map(h => h.productName));
    }

    // Check for matches
    console.log("\nChecking for direct matches...");
    let directMatches = 0;
    let caseInsensitiveMatches = 0;

    const historyNames = new Set(history.map(h => h.productName));
    const historyNamesLower = new Set(history.map(h => h.productName.toLowerCase()));

    for (const pp of planningProds) {
        if (historyNames.has(pp.name)) {
            directMatches++;
        }
        if (historyNamesLower.has(pp.name.toLowerCase())) {
            caseInsensitiveMatches++;
        }
    }

    console.log(`Direct Matches: ${directMatches}`);
    console.log(`Case-Insensitive Matches: ${caseInsensitiveMatches}`);

    process.exit(0);
}

main();
