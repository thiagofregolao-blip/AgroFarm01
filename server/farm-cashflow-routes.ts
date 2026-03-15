import { Express } from "express";
import { requireFarmer, parseLocalDate } from "./farm-middleware";
import { farmStorage } from "./farm-storage";
import { db } from "./db";
import { sql } from "drizzle-orm";

export function registerFarmCashFlowRoutes(app: Express) {

    // ==================== FLUXO DE CAIXA ====================

    app.get("/api/farm/cash-accounts", requireFarmer, async (req, res) => {
        try {
            const { farmCashAccounts } = await import("../shared/schema");
            const { db } = await import("./db");
            const { eq } = await import("drizzle-orm");
            const accounts = await db.select().from(farmCashAccounts).where(eq(farmCashAccounts.farmerId, (req.user as any).id));
            res.json(accounts);
        } catch (error) {
            console.error("[CASH_ACCOUNTS_GET]", error);
            res.status(500).json({ error: "Failed to get cash accounts" });
        }
    });

    app.post("/api/farm/cash-accounts", requireFarmer, async (req, res) => {
        try {
            const { farmCashAccounts } = await import("../shared/schema");
            const { db } = await import("./db");
            const { name, bankName, accountType, currency, initialBalance } = req.body;
            if (!name || !accountType) return res.status(400).json({ error: "name and accountType required" });

            const balance = parseFloat(initialBalance) || 0;
            const [account] = await db.insert(farmCashAccounts).values({
                farmerId: (req.user as any).id,
                name,
                bankName: bankName || null,
                accountType,
                currency: currency || "USD",
                initialBalance: String(balance),
                currentBalance: String(balance),
            }).returning();
            res.status(201).json(account);
        } catch (error) {
            console.error("[CASH_ACCOUNT_CREATE]", error);
            res.status(500).json({ error: "Failed to create cash account" });
        }
    });

    app.put("/api/farm/cash-accounts/:id", requireFarmer, async (req, res) => {
        try {
            const { farmCashAccounts } = await import("../shared/schema");
            const { db } = await import("./db");
            const { eq, and } = await import("drizzle-orm");
            const { name, bankName, accountType, currency, isActive } = req.body;

            const updates: any = {};
            if (name !== undefined) updates.name = name;
            if (bankName !== undefined) updates.bankName = bankName;
            if (accountType !== undefined) updates.accountType = accountType;
            if (currency !== undefined) updates.currency = currency;
            if (isActive !== undefined) updates.isActive = isActive;

            const [updated] = await db.update(farmCashAccounts).set(updates).where(
                and(eq(farmCashAccounts.id, req.params.id), eq(farmCashAccounts.farmerId, (req.user as any).id))
            ).returning();
            res.json(updated);
        } catch (error) {
            console.error("[CASH_ACCOUNT_UPDATE]", error);
            res.status(500).json({ error: "Failed to update cash account" });
        }
    });

    app.delete("/api/farm/cash-accounts/:id", requireFarmer, async (req, res) => {
        try {
            const { farmCashAccounts } = await import("../shared/schema");
            const { db } = await import("./db");
            const { eq, and } = await import("drizzle-orm");
            await db.delete(farmCashAccounts).where(
                and(eq(farmCashAccounts.id, req.params.id), eq(farmCashAccounts.farmerId, (req.user as any).id))
            );
            res.status(204).send();
        } catch (error) {
            console.error("[CASH_ACCOUNT_DELETE]", error);
            res.status(500).json({ error: "Failed to delete cash account" });
        }
    });

    app.get("/api/farm/cash-transactions", requireFarmer, async (req, res) => {
        try {
            const { farmCashTransactions } = await import("../shared/schema");
            const { db } = await import("./db");
            const { eq, and, gte, lte, desc } = await import("drizzle-orm");

            const farmerId = (req.user as any).id;
            const conditions: any[] = [eq(farmCashTransactions.farmerId, farmerId)];

            if (req.query.accountId) {
                conditions.push(eq(farmCashTransactions.accountId, req.query.accountId as string));
            }
            if (req.query.type) {
                conditions.push(eq(farmCashTransactions.type, req.query.type as string));
            }
            if (req.query.category) {
                conditions.push(eq(farmCashTransactions.category, req.query.category as string));
            }
            if (req.query.startDate) {
                conditions.push(gte(farmCashTransactions.transactionDate, new Date(req.query.startDate as string)));
            }
            if (req.query.endDate) {
                conditions.push(lte(farmCashTransactions.transactionDate, new Date(req.query.endDate as string)));
            }

            const transactions = await db.select().from(farmCashTransactions)
                .where(and(...conditions))
                .orderBy(desc(farmCashTransactions.transactionDate))
                .limit(500);
            res.json(transactions);
        } catch (error) {
            console.error("[CASH_TRANSACTIONS_GET]", error);
            res.status(500).json({ error: "Failed to get transactions" });
        }
    });

    app.post("/api/farm/cash-transactions", requireFarmer, async (req, res) => {
        try {
            const { farmCashTransactions, farmCashAccounts } = await import("../shared/schema");
            const { db } = await import("./db");
            const { eq, and, sql: sqlFn } = await import("drizzle-orm");

            const { accountId, type, amount, currency, category, description, paymentMethod, transactionDate, referenceType, expenseId, invoiceId } = req.body;
            if (!accountId || !type || !amount || !category) {
                return res.status(400).json({ error: "accountId, type, amount, category required" });
            }

            const farmerId = (req.user as any).id;
            const parsedAmount = parseFloat(amount);
            if (isNaN(parsedAmount) || parsedAmount <= 0) {
                return res.status(400).json({ error: "Invalid amount" });
            }

            const [tx] = await db.insert(farmCashTransactions).values({
                farmerId,
                accountId,
                type,
                amount: String(parsedAmount),
                currency: currency || "USD",
                category,
                description: description || null,
                paymentMethod: paymentMethod || "efetivo",
                referenceType: referenceType || "manual",
                expenseId: expenseId || null,
                invoiceId: invoiceId || null,
                transactionDate: parseLocalDate(transactionDate) || new Date(),
            }).returning();

            const balanceChange = type === "entrada" ? parsedAmount : -parsedAmount;
            await db.update(farmCashAccounts)
                .set({ currentBalance: sqlFn`current_balance + ${balanceChange}` })
                .where(and(eq(farmCashAccounts.id, accountId), eq(farmCashAccounts.farmerId, farmerId)));

            res.status(201).json(tx);
        } catch (error) {
            console.error("[CASH_TRANSACTION_CREATE]", error);
            res.status(500).json({ error: "Failed to create transaction" });
        }
    });

    app.get("/api/farm/cash-summary", requireFarmer, async (req, res) => {
        try {
            const { farmCashTransactions, farmCashAccounts } = await import("../shared/schema");
            const { db } = await import("./db");
            const { eq, and, gte, sql: sqlFn } = await import("drizzle-orm");

            const farmerId = (req.user as any).id;

            const accounts = await db.select().from(farmCashAccounts).where(eq(farmCashAccounts.farmerId, farmerId));

            const firstOfMonth = new Date();
            firstOfMonth.setDate(1);
            firstOfMonth.setHours(0, 0, 0, 0);

            const monthTransactions = await db.select().from(farmCashTransactions).where(
                and(eq(farmCashTransactions.farmerId, farmerId), gte(farmCashTransactions.transactionDate, firstOfMonth))
            );

            let totalEntradas = 0;
            let totalSaidas = 0;
            for (const t of monthTransactions) {
                const val = parseFloat(t.amount as string) || 0;
                if (t.type === "entrada") totalEntradas += val;
                else totalSaidas += val;
            }

            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
            sixMonthsAgo.setDate(1);
            sixMonthsAgo.setHours(0, 0, 0, 0);

            const allRecent = await db.select().from(farmCashTransactions).where(
                and(eq(farmCashTransactions.farmerId, farmerId), gte(farmCashTransactions.transactionDate, sixMonthsAgo))
            );

            const monthlyData: Record<string, { entradas: number; saidas: number }> = {};
            for (let i = 5; i >= 0; i--) {
                const d = new Date();
                d.setMonth(d.getMonth() - i);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                monthlyData[key] = { entradas: 0, saidas: 0 };
            }
            for (const t of allRecent) {
                const d = new Date(t.transactionDate as any);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                if (monthlyData[key]) {
                    const val = parseFloat(t.amount as string) || 0;
                    if (t.type === "entrada") monthlyData[key].entradas += val;
                    else monthlyData[key].saidas += val;
                }
            }

            const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
            const chartData = Object.entries(monthlyData).map(([key, v]) => ({
                month: monthNames[parseInt(key.split("-")[1]) - 1],
                entradas: Math.round(v.entradas * 100) / 100,
                saidas: Math.round(v.saidas * 100) / 100,
            }));

            const byCategoryRaw: Record<string, number> = {};
            for (const t of monthTransactions) {
                if (t.type === "saida") {
                    const val = parseFloat(t.amount as string) || 0;
                    byCategoryRaw[t.category] = (byCategoryRaw[t.category] || 0) + val;
                }
            }
            const byCategory = Object.entries(byCategoryRaw).map(([cat, val]) => ({ category: cat, value: Math.round(val * 100) / 100 }))
                .sort((a, b) => b.value - a.value);

            const { farmExpenses } = await import("../shared/schema");
            const { or } = await import("drizzle-orm");
            const unpaidExpenses = await db.select().from(farmExpenses).where(
                and(
                    eq(farmExpenses.farmerId, farmerId),
                    eq(farmExpenses.status, "confirmed"),
                    or(eq(farmExpenses.paymentStatus, "pendente"), eq(farmExpenses.paymentStatus, "parcial"))
                )
            );
            const contasAPagar = unpaidExpenses.map(e => ({
                id: e.id,
                description: e.description?.replace(/\[Via WhatsApp\]\s*(\[[^\]]*\]\s*)?/, "").trim(),
                supplier: e.supplier,
                category: e.category,
                amount: parseFloat(e.amount as string) || 0,
                paidAmount: parseFloat(e.paidAmount as string) || 0,
                remaining: (parseFloat(e.amount as string) || 0) - (parseFloat(e.paidAmount as string) || 0),
                dueDate: e.dueDate,
                paymentType: e.paymentType,
                installments: e.installments,
                installmentsPaid: e.installmentsPaid,
            }));

            res.json({
                accounts,
                monthSummary: {
                    totalEntradas,
                    totalSaidas,
                    saldoLiquido: totalEntradas - totalSaidas,
                    transactionCount: monthTransactions.length,
                },
                chartData,
                byCategory,
                contasAPagar,
            });
        } catch (error) {
            console.error("[CASH_SUMMARY]", error);
            res.status(500).json({ error: "Failed to get summary" });
        }
    });

    app.put("/api/farm/cash-transactions/:id", requireFarmer, async (req, res) => {
        try {
            const { farmCashTransactions } = await import("../shared/schema");
            const { db } = await import("./db");
            const { eq, and } = await import("drizzle-orm");

            const farmerId = (req.user as any).id;
            const { description, amount, transactionDate } = req.body;

            const updates: any = {};
            if (description !== undefined) updates.description = description;
            if (amount !== undefined) updates.amount = String(parseFloat(amount));
            if (transactionDate !== undefined) updates.transactionDate = parseLocalDate(transactionDate);

            if (Object.keys(updates).length === 0) {
                return res.status(400).json({ error: "No fields to update" });
            }

            const [updated] = await db.update(farmCashTransactions).set(updates).where(
                and(eq(farmCashTransactions.id, req.params.id), eq(farmCashTransactions.farmerId, farmerId))
            ).returning();

            if (!updated) return res.status(404).json({ error: "Transaction not found" });
            res.json(updated);
        } catch (error) {
            console.error("[CASH_TRANSACTION_UPDATE]", error);
            res.status(500).json({ error: "Failed to update transaction" });
        }
    });

    app.delete("/api/farm/cash-transactions/:id", requireFarmer, async (req, res) => {
        try {
            const { farmCashTransactions, farmCashAccounts } = await import("../shared/schema");
            const { db } = await import("./db");
            const { eq, and, sql: sqlFn } = await import("drizzle-orm");

            const farmerId = (req.user as any).id;
            const [tx] = await db.select().from(farmCashTransactions).where(
                and(eq(farmCashTransactions.id, req.params.id), eq(farmCashTransactions.farmerId, farmerId))
            ).limit(1);

            if (!tx) return res.status(404).json({ error: "Transaction not found" });

            const reversal = tx.type === "entrada" ? -parseFloat(tx.amount as string) : parseFloat(tx.amount as string);
            await db.update(farmCashAccounts)
                .set({ currentBalance: sqlFn`current_balance + ${reversal}` })
                .where(and(eq(farmCashAccounts.id, tx.accountId), eq(farmCashAccounts.farmerId, farmerId)));

            await db.delete(farmCashTransactions).where(eq(farmCashTransactions.id, req.params.id));
            res.status(204).send();
        } catch (error) {
            console.error("[CASH_TRANSACTION_DELETE]", error);
            res.status(500).json({ error: "Failed to delete transaction" });
        }
    });

}
