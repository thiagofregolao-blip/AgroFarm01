
import { db, dbReady } from "../server/db";
import { clientApplicationTracking, sales, userClientLinks } from "../shared/schema";
import { desc, eq } from "drizzle-orm";

async function main() {
    try {
        await dbReady;

        console.log("Searching for user with Sales...");
        const sale = await db.select().from(sales).limit(1);
        if (sale.length > 0) {
            console.log("Found Sale:", sale[0]);
            console.log("User ID from Sale:", sale[0].userId);
            console.log("Season ID from Sale:", sale[0].seasonId);
        } else {
            console.log("No Sales found.");
        }

        console.log("Searching for user with Apps...");
        const app = await db.select().from(clientApplicationTracking).limit(1);
        if (app.length > 0) {
            console.log("Found App:", app[0]);
            console.log("User ID from App:", app[0].userId);
            console.log("Season ID from App:", app[0].seasonId);
        } else {
            console.log("No Apps found.");
        }

    } catch (err) {
        console.error(err);
    }
    process.exit(0);
}

main();
