import { db } from "./server/db";
import { farmProperties } from "./shared/schema";
import { sum } from "drizzle-orm";

async function run() {
  const result = await db.select({ totalArea: sum(farmProperties.totalAreaHa) }).from(farmProperties);
  console.log("Drizzle sum result:", result);
  process.exit(0);
}
run();
