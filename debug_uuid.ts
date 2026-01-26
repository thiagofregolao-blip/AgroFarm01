
import 'dotenv/config';
import { db, dbReady } from "./server/db";
import { users, planningGlobalConfigurations, seasons } from "./shared/schema";
import { eq } from "drizzle-orm";

async function main() {
    console.log("--- DEBUGGER UUID SEARCH ---");
    await dbReady;

    const targetId = '510006a3-ad3e-4338-8f30-a348b80acf69';
    console.log(`Searching for ID: ${targetId}`);

    // Check Seasons
    const season = await db.select().from(seasons).where(eq(seasons.id, targetId));
    if (season.length > 0) {
        console.log(`FOUND in Seasons: ${season[0].name} (Active: ${season[0].isActive})`);
    } else {
        console.log("Not found in Seasons.");
    }

    // Check Users
    const user = await db.select().from(users).where(eq(users.id, targetId));
    if (user.length > 0) {
        console.log(`FOUND in Users: ${user[0].username}`);
    }

    process.exit(0);
}

main().catch(console.error);
