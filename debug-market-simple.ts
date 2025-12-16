
import { db } from "./server/db";
import {
    clients,
    categories,
    clientCategoryPipeline,
    clientApplicationTracking,
    sales,
    userClientLinks
} from "./shared/schema";
import { eq, and } from "drizzle-orm";

async function runDebug() {
    console.log("--- DEBUG MARKET DATA ---");

    // 1. Get Categories
    const allCategories = await db.select().from(categories);
    console.log(`Categories found: ${allCategories.length}`);
    allCategories.forEach(c => console.log(`  - ${c.id}: ${c.name} (${c.type})`));

    // 2. Client Pipeline Statuses (General)
    const pipelines = await db.select().from(clientCategoryPipeline);
    console.log(`\nPipeline Statuses found: ${pipelines.length}`);
    pipelines.slice(0, 5).forEach(p => console.log(`  - Client: ${p.clientId} Cat: ${p.categoryId} Status: ${p.status}`));

    // 3. Client Application Tracking (Agroquímicos)
    const applications = await db.select().from(clientApplicationTracking);
    console.log(`\nApplications found: ${applications.length}`);
    applications.slice(0, 5).forEach(a => console.log(`  - Client: ${a.clientId} Cat: ${a.categoria} Status: ${a.status} Value: ${a.totalValue}`));

    // 4. Check specific matching for Agroquímicos
    console.log("\n--- AGROQUÍMICOS MATCHING TEST ---");
    const agroApps = applications.filter(a => a.categoria && a.categoria.toLowerCase().includes("fungi"));
    if (agroApps.length > 0) {
        console.log(`Found ${agroApps.length} fungicida apps.`);
        const app = agroApps[0];
        console.log(`Testing normalization for: '${app.categoria}'`);

        const normalizeCategoryName = (name: string): string => {
            const agroquimicoVariants = ['FUNGICIDAS', 'INSETICIDAS', 'DESSECAÇÃO', 'TRATAMENTO DE SEMENTE', 'TS'];
            const n = name.toUpperCase().trim(); // Basic trim
            if (agroquimicoVariants.includes(n)) return 'Agroquímicos';
            // Try strict include
            if (agroquimicoVariants.some(v => n.includes(v))) return 'Agroquímicos';
            return name;
        };

        console.log(`  -> Normalized Result: ${normalizeCategoryName(app.categoria)}`);
    } else {
        console.log("No fungicida apps found to test.");
    }

    process.exit(0);
}

runDebug().catch(console.error);
