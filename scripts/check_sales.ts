
import 'dotenv/config';
import { db, dbReady } from "../server/db";
import { sales, masterClients, userClientLinks, products } from "../shared/schema";
import { eq, ilike } from "drizzle-orm";

async function main() {
    await dbReady;

    const masterClientList = await db.select().from(masterClients).where(ilike(masterClients.name, "%APARECIDO%"));

    for (const mc of masterClientList) {
        console.log(`\nMaster Client: ${mc.name} (ID: ${mc.id})`);

        const links = await db.select().from(userClientLinks).where(eq(userClientLinks.masterClientId, mc.id));

        for (const link of links) {
            console.log(`  User Link ID: ${link.id}`);

            // Replicate the exact query from the route
            const history = await db.selectDistinct({ productName: products.name })
                .from(sales)
                .innerJoin(products, eq(sales.productId, products.id)) // This is the critical join
                .where(eq(sales.clientId, link.id));

            console.log(`  Route Query Result: ${history.length} distinct products found.`);
            if (history.length > 0) {
                console.log(`  Sample products: ${history.map(h => h.productName).slice(0, 5).join(", ")}`);
            } else {
                // Debug why it failed if sales exist
                const salesCount = await db.select().from(sales).where(eq(sales.clientId, link.id));
                console.log(`  Raw Sales Count: ${salesCount.length}`);
                if (salesCount.length > 0) {
                    console.log("  Direct sales exist but join failed. Checking product IDs...");
                    const sampleSale = salesCount[0];
                    console.log(`  Sample Sale Product ID: ${sampleSale.productId}`);
                    const prod = await db.select().from(products).where(eq(products.id, sampleSale.productId));
                    console.log(`  Product lookup result: ${prod.length > 0 ? "Found" : "NOT FOUND"}`);
                }
            }
        }
    }
    process.exit(0);
}

main();
