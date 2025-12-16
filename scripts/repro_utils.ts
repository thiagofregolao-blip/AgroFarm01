import { db, dbReady } from "../server/db";
import { seasons, users } from "@shared/schema";
import { eq } from "drizzle-orm";

async function main() {
    try {
        await dbReady;
        const allSeasons = await db.select().from(seasons).limit(5);
        console.log("Seasons:", JSON.stringify(allSeasons, null, 2));

        const oneUser = await db.select().from(users).limit(1);
        console.log("User:", JSON.stringify(oneUser, null, 2));

    } catch (err) {
        console.error(err);
    }
    process.exit(0);
}

main();
