import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { db, dbReady } from "../server/db";
import { seasons } from "../shared/schema";
import { eq } from "drizzle-orm";
import { importPlanningProducts } from "../server/import-excel";

async function main() {
    await dbReady;
    console.log("Starting product import...");

    try {
        // 1. Get Active Season
        const activeSeasons = await db.select().from(seasons).where(eq(seasons.isActive, true)).limit(1);
        if (activeSeasons.length === 0) {
            console.error("No active season found!");
            process.exit(1);
        }
        const seasonId = activeSeasons[0].id;
        console.log(`Active Season found: ${activeSeasons[0].name} (${seasonId})`);

        // 2. Read Files
        const productsPath = path.resolve(process.cwd(), "Planejamento de Vendas 2026.xls");
        const dosesPath = path.resolve(process.cwd(), "Planilha de produtos.xlsx");

        if (!fs.existsSync(productsPath)) {
            console.error(`File not found: ${productsPath}`);
            process.exit(1);
        }
        if (!fs.existsSync(dosesPath)) {
            console.error(`File not found: ${dosesPath}`);
            process.exit(1);
        }

        const productsBuffer = fs.readFileSync(productsPath);
        const dosesBuffer = fs.readFileSync(dosesPath);

        // 3. Debug Headers
        const XLSX = await import('xlsx');
        const wb = XLSX.read(productsBuffer, { type: 'buffer' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);
        console.log("First row of products file:", rows[0]);

        const wbDoses = XLSX.read(dosesBuffer, { type: 'buffer' });
        const sheetDoses = wbDoses.Sheets[wbDoses.SheetNames[0]];
        const rowsDoses = XLSX.utils.sheet_to_json(sheetDoses);
        console.log("First row of doses file:", rowsDoses[0]);

        // 3. Run Import
        console.log("Importing products...");
        const result = await importPlanningProducts(productsBuffer, dosesBuffer, seasonId);

        console.log("Import Result:", result);

    } catch (error) {
        console.error("Import failed:", error);
    }
    process.exit(0);
}

main();
