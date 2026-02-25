import { db, dbReady } from "./server/db.js";
import { users, farmExpenses, farmInvoices } from "./shared/schema.js";
import { eq, or, sql, desc } from "drizzle-orm";

async function run() {
    await dbReady;
    try {
        const limit = 5;
        // Mocking the farmer[0].id to bypass the users table query which has schema differences locally vs prod
        const farmers = [{ id: "mock-id-123" }];

        const expenses = await db.select().from(farmExpenses)
            .where(eq(farmExpenses.farmerId, farmers[0].id))
            .orderBy(desc(farmExpenses.createdAt))
            .limit(Number(limit));

        const invoices = await db.select().from(farmInvoices)
            .where(eq(farmInvoices.farmerId, farmers[0].id))
            .orderBy(desc(farmInvoices.createdAt))
            .limit(Number(limit));

        const res = {
            despesas: expenses.map((e: any) => ({
                descricao: e.description,
                valor: parseFloat(e.amount).toFixed(2),
                categoria: e.category,
                data: new Date(e.createdAt).toLocaleDateString("pt-BR"),
                status: e.status
            })),
            faturas: invoices.map((i: any) => ({
                fornecedor: i.supplier,
                valorTotal: parseFloat(i.totalAmount || "0").toFixed(2),
                data: new Date(i.createdAt).toLocaleDateString("pt-BR"),
                status: i.status
            }))
        };
        console.log("Success", res);
    } catch (e) {
        console.error("ERROR CAUGHT:");
        console.error(e);
    }
    process.exit(0);
}
run();
