/**
 * Farm Expense Routes — Applications, Plot Costs, Expenses, Expense Categories
 * Extracted from farm-routes.ts
 */
import { Express } from "express";
import { requireFarmer, getEffectiveFarmerId, parseLocalDate } from "./farm-middleware";
import { farmStorage } from "./farm-storage";
import { db } from "./db";
import { sql } from "drizzle-orm";

export function registerFarmExpenseRoutes(app: Express) {

    // ==================== APPLICATIONS ====================

    app.get("/api/farm/applications", requireFarmer, async (req, res) => {
        try {
            const plotId = req.query.plotId ? String(req.query.plotId) : undefined;
            const farmerId = await getEffectiveFarmerId(req);
            if (!farmerId) return res.status(403).json({ error: "Farmer not found" });
            const applications = await farmStorage.getApplications(farmerId, plotId);
            res.json(applications);
        } catch (error) {
            console.error("[FARM_APPLICATIONS_GET]", error);
            res.status(500).json({ error: "Failed to get applications" });
        }
    });

    // ==================== PLOT COSTS ====================

    app.get("/api/farm/plot-costs", requireFarmer, async (req, res) => {
        try {
            const farmerId = await getEffectiveFarmerId(req);
            if (!farmerId) return res.status(403).json({ error: "Farmer not found" });
            const seasonFilter = req.query.seasonId as string | undefined;
            const { db } = await import("./db");
            const { farmApplications, farmProductsCatalog, farmPlots, farmProperties, farmStock, farmSeasons } = await import("../shared/schema");
            const { eq, and, sql } = await import("drizzle-orm");

            // Get active seasons for filter dropdown
            const seasons = await db.select().from(farmSeasons).where(
                and(eq(farmSeasons.farmerId, farmerId), eq(farmSeasons.isActive, true))
            );

            // Build where conditions
            const conditions = [eq(farmApplications.farmerId, farmerId)];
            if (seasonFilter) {
                conditions.push(eq(farmApplications.seasonId, seasonFilter));
            }

            // Get all applications with product and plot info
            const apps = await db.select({
                appId: farmApplications.id,
                productId: farmApplications.productId,
                plotId: farmApplications.plotId,
                propertyId: farmApplications.propertyId,
                quantity: farmApplications.quantity,
                appliedAt: farmApplications.appliedAt,
                seasonId: farmApplications.seasonId,
                productName: farmProductsCatalog.name,
                productUnit: farmProductsCatalog.unit,
                productCategory: farmProductsCatalog.category,
                productDosePerHa: farmProductsCatalog.dosePerHa,
                productImageUrl: farmProductsCatalog.imageUrl,
                plotName: farmPlots.name,
                plotAreaHa: farmPlots.areaHa,
                plotCrop: farmPlots.crop,
                plotCoordinates: farmPlots.coordinates,
                propertyName: farmProperties.name,
            })
                .from(farmApplications)
                .innerJoin(farmProductsCatalog, eq(farmApplications.productId, farmProductsCatalog.id))
                .leftJoin(farmPlots, eq(farmApplications.plotId, farmPlots.id))
                .leftJoin(farmProperties, eq(farmApplications.propertyId, farmProperties.id))
                .where(and(...conditions))
                .orderBy(farmApplications.appliedAt);

            // Get stock with averageCost for each product
            const stockData = await db.select({
                productId: farmStock.productId,
                averageCost: farmStock.averageCost,
                currentQty: farmStock.quantity,
            })
                .from(farmStock)
                .where(eq(farmStock.farmerId, farmerId));

            const costMap: Record<string, number> = {};
            for (const s of stockData) {
                const cost = parseFloat(s.averageCost || "0");
                // Keep the highest non-zero cost across multiple deposits for the same product
                if (cost > 0 || costMap[s.productId] === undefined) {
                    costMap[s.productId] = cost;
                }
            }

            // Build aggregated data
            const plotData: Record<string, {
                plotId: string;
                plotName: string;
                plotAreaHa: number;
                plotCrop: string | null;
                plotCoordinates: string | null;
                propertyId: string;
                propertyName: string;
                totalCost: number;
                appliedAtSet: Set<string>; // distinct timestamps = distinct application events
                totalQtyByProduct: Record<string, { productId: string; productName: string; productUnit: string; category: string | null; imageUrl: string | null; quantity: number; unitCost: number; totalCost: number; dosePerHa: number | null }>;
                applications: typeof apps;
            }> = {};

            for (const app of apps) {
                // Skip applications without a plot (e.g. diesel fueling)
                if (!app.plotId) continue;

                const plotKey = app.plotId;
                if (!plotData[plotKey]) {
                    plotData[plotKey] = {
                        plotId: app.plotId,
                        plotName: app.plotName || "Sem talhão",
                        plotAreaHa: parseFloat(app.plotAreaHa || "0"),
                        plotCrop: app.plotCrop,
                        plotCoordinates: app.plotCoordinates || null,
                        propertyId: app.propertyId || "",
                        propertyName: app.propertyName || "Sem propriedade",
                        totalCost: 0,
                        appliedAtSet: new Set<string>(),
                        totalQtyByProduct: {},
                        applications: [],
                    };
                }

                const qty = parseFloat(app.quantity || "0");
                const unitCost = costMap[app.productId] || 0;
                const appCost = qty * unitCost;

                plotData[plotKey].totalCost += appCost;
                // Track distinct applied_at timestamps — same timestamp = same application event (same cart submission)
                if (app.appliedAt) {
                    plotData[plotKey].appliedAtSet.add(new Date(app.appliedAt).toISOString());
                }
                plotData[plotKey].applications.push(app);

                if (!plotData[plotKey].totalQtyByProduct[app.productId]) {
                    plotData[plotKey].totalQtyByProduct[app.productId] = {
                        productId: app.productId,
                        productName: app.productName,
                        productUnit: app.productUnit,
                        category: app.productCategory,
                        imageUrl: app.productImageUrl,
                        quantity: 0,
                        unitCost,
                        totalCost: 0,
                        dosePerHa: app.productDosePerHa ? parseFloat(app.productDosePerHa) : null,
                    };
                }
                plotData[plotKey].totalQtyByProduct[app.productId].quantity += qty;
                plotData[plotKey].totalQtyByProduct[app.productId].totalCost += appCost;
            }

            // Convert to array and compute per-hectare for each plot
            const result = Object.values(plotData).map(p => ({
                ...p,
                costPerHa: p.plotAreaHa > 0 ? p.totalCost / p.plotAreaHa : 0,
                products: Object.values(p.totalQtyByProduct),
                applications: undefined,
                plotCoordinates: p.plotCoordinates || null,
                applicationCount: p.appliedAtSet.size, // distinct events, not product lines
                appliedAtSet: undefined, // don't serialize the Set
            }));

            // Normalize category names (lowercase, singular) to avoid duplicates
            const normalizeCategory = (cat: string | null): string => {
                if (!cat) return "outro";
                const lower = cat.toLowerCase().trim();
                if (lower.includes("herbicida")) return "herbicida";
                if (lower.includes("fungicida")) return "fungicida";
                if (lower.includes("inseticida") || lower.includes("insecticida")) return "inseticida";
                if (lower.includes("fertilizante") || lower.includes("foliar")) return "fertilizante";
                if (lower.includes("semente") || lower.includes("curasemilla")) return "semente";
                if (lower.includes("adjuvante") || lower.includes("coadyuvante")) return "adjuvante";
                if (lower.includes("combustível") || lower.includes("diesel")) return "combustivel";
                return "outro";
            };

            // Apply normalization to product categories
            for (const p of result) {
                for (const prod of p.products) {
                    prod.category = normalizeCategory(prod.category);
                }
            }

            // Category totals (normalized)
            const categoryTotals: Record<string, number> = {};
            for (const p of result) {
                for (const prod of p.products) {
                    const cat = prod.category || "outro";
                    categoryTotals[cat] = (categoryTotals[cat] || 0) + prod.totalCost;
                }
            }

            res.json({
                plots: result,
                categoryTotals,
                totalCost: result.reduce((s, p) => s + p.totalCost, 0),
                totalArea: result.reduce((s, p) => s + p.plotAreaHa, 0),
                seasons,
            });
        } catch (error) {
            console.error("[FARM_PLOT_COSTS]", error);
            res.status(500).json({ error: "Failed to get plot costs" });
        }
    });

    // ==================== EXPENSES ====================

    app.get("/api/farm/expenses", requireFarmer, async (req, res) => {
        try {
            const farmerId = await getEffectiveFarmerId(req);
            if (!farmerId) return res.status(403).json({ error: "Farmer not found" });
            const expenses = await farmStorage.getExpenses(farmerId);
            const sanitized = (expenses as any[]).map(({ imageBase64, ...rest }) => ({
                ...rest,
                hasImage: !!imageBase64,
            }));
            res.json(sanitized);
        } catch (error) {
            console.error("[FARM_EXPENSES_GET]", error);
            res.status(500).json({ error: "Failed to get expenses" });
        }
    });

    app.post("/api/farm/expenses", requireFarmer, async (req, res) => {
        try {
            const {
                plotId, propertyId, seasonId, category, description, amount,
                expenseDate, paymentType, dueDate, installments, supplier,
                frequency, repeatTimes, invoiceId, accountId,
            } = req.body;
            if (!category || !amount) return res.status(400).json({ error: "Category and amount required" });

            const farmerId = await getEffectiveFarmerId(req);
            if (!farmerId) return res.status(403).json({ error: "Farmer not found" });
            const repeats = repeatTimes && parseInt(repeatTimes) > 1 ? parseInt(repeatTimes) : 1;
            const freq = frequency || "mensal";
            const baseDate = parseLocalDate(expenseDate) || new Date();

            // Helper: advance date by frequency
            const advanceDate = (date: Date, n: number): Date => {
                const d = new Date(date);
                if (freq === "semanal") d.setDate(d.getDate() + 7 * n);
                else if (freq === "anual") d.setFullYear(d.getFullYear() + n);
                else d.setMonth(d.getMonth() + n); // mensal
                return d;
            };

            const createdExpenses = [];

            for (let r = 0; r < repeats; r++) {
                const occurrenceDate = advanceDate(baseDate, r);
                const sanitize = (v: any) => (!v || v === "__none__" || v === "undefined") ? null : v;
                const expense = await farmStorage.createExpense({
                    farmerId,
                    plotId: sanitize(plotId),
                    propertyId: sanitize(propertyId),
                    invoiceId: sanitize(invoiceId),
                    seasonId: sanitize(seasonId),
                    category,
                    description: repeats > 1 ? `${description || category} (${r + 1}/${repeats})` : (description || undefined),
                    amount: String(amount),
                    expenseDate: occurrenceDate,
                    paymentType: paymentType || "a_vista",
                    dueDate: parseLocalDate(dueDate) || undefined,
                    installments: installments ? parseInt(installments) : 1,
                    supplier: supplier || undefined,
                });
                createdExpenses.push(expense);

                // AUTO: Toda despesa gera Conta a Pagar
                try {
                    const { farmAccountsPayable, farmCashTransactions, farmCashAccounts } = await import("../shared/schema");
                    const { db } = await import("./db");
                    const { eq, and, sql: sqlFn } = await import("drizzle-orm");

                    if (paymentType === "a_prazo") {
                        const apDueDate = parseLocalDate(dueDate) || new Date(occurrenceDate);
                        if (!dueDate) apDueDate.setDate(apDueDate.getDate() + 30);

                        const totalInst = installments ? parseInt(installments) : 1;
                        const instAmount = parseFloat(String(amount)) / totalInst;

                        for (let i = 0; i < totalInst; i++) {
                            const instDue = new Date(apDueDate);
                            instDue.setMonth(instDue.getMonth() + i);
                            await db.insert(farmAccountsPayable).values({
                                farmerId,
                                expenseId: expense.id,
                                supplier: supplier || category,
                                description: totalInst > 1 ? `${description || category} - Parcela ${i + 1}/${totalInst}` : (description || category),
                                totalAmount: String(instAmount.toFixed(2)),
                                currency: "USD",
                                installmentNumber: i + 1,
                                totalInstallments: totalInst,
                                dueDate: instDue,
                                status: "aberto",
                            });
                        }
                        console.log(`[EXPENSE→AP] Auto-created ${totalInst} AP entries for expense ${expense.id}`);
                    } else {
                        // a_vista: cria AP como pago + movimentacao no fluxo de caixa
                        const [ap] = await db.insert(farmAccountsPayable).values({
                            farmerId,
                            expenseId: expense.id,
                            supplier: supplier || category,
                            description: description || category,
                            totalAmount: String(amount),
                            currency: "USD",
                            dueDate: occurrenceDate,
                            status: accountId ? "pago" : "aberto",
                            paidAmount: accountId ? String(amount) : "0",
                            paidDate: accountId ? occurrenceDate : null,
                        }).returning();

                        // Se accountId informado, debitar da conta automaticamente
                        if (accountId) {
                            const payAmt = parseFloat(String(amount));
                            await db.insert(farmCashTransactions).values({
                                farmerId,
                                accountId,
                                type: "saida",
                                amount: String(payAmt),
                                currency: "USD",
                                category: category || "despesa",
                                description: `Despesa: ${supplier || ''} - ${description || category}`.trim(),
                                paymentMethod: "transferencia",
                                referenceType: "pagamento_despesa",
                            });
                            await db.update(farmCashAccounts)
                                .set({ currentBalance: sqlFn`current_balance - ${payAmt}` })
                                .where(and(eq(farmCashAccounts.id, accountId), eq(farmCashAccounts.farmerId, farmerId)));
                            console.log(`[EXPENSE→CASH] Auto-debited ${payAmt} from account ${accountId} for expense ${expense.id}`);
                        }
                        console.log(`[EXPENSE→AP] Auto-created AP (a_vista) for expense ${expense.id}`);
                    }
                } catch (apErr) {
                    console.error("[EXPENSE→AP_ERROR]", apErr);
                }
            }

            console.log(`[EXPENSE_CREATE] Farmer ${farmerId}: created ${repeats} expense(s) with freq=${freq}`);
            res.status(201).json(repeats > 1 ? createdExpenses : createdExpenses[0]);
        } catch (error: any) {
            console.error("[FARM_EXPENSE_CREATE]", error?.message || error, JSON.stringify(req.body));
            res.status(500).json({ error: `Failed to create expense: ${error?.message || 'unknown'}` });
        }
    });


    app.post("/api/farm/expenses/:id/confirm", requireFarmer, async (req, res) => {
        try {
            const { farmExpenses, farmCashTransactions, farmCashAccounts } = await import("../shared/schema");
            const { db } = await import("./db");
            const { eq, and, sql: sqlFn } = await import("drizzle-orm");

            const farmerId = await getEffectiveFarmerId(req);
            if (!farmerId) return res.status(403).json({ error: "Farmer not found" });
            const { accountId, paymentMethod, paymentStatus, paymentType, dueDate, installments } = req.body || {};

            const [expense] = await db.select().from(farmExpenses).where(
                and(eq(farmExpenses.id, req.params.id), eq(farmExpenses.farmerId, farmerId))
            ).limit(1);

            if (!expense) return res.status(404).json({ error: "Expense not found" });

            const amount = parseFloat(expense.amount as string) || 0;
            const isPago = paymentStatus === "pago" || (!paymentStatus && accountId);

            const updateData: any = {
                status: "confirmed",
                paymentStatus: paymentStatus || (accountId ? "pago" : "pendente"),
                paymentType: paymentType || "a_vista",
            };
            if (dueDate) updateData.dueDate = parseLocalDate(dueDate);
            if (installments) updateData.installments = parseInt(installments);
            if (isPago) {
                updateData.paidAmount = String(amount);
                updateData.installmentsPaid = updateData.installments || 1;
            }

            await db.update(farmExpenses).set(updateData).where(eq(farmExpenses.id, expense.id));

            if (accountId && isPago) {
                await db.insert(farmCashTransactions).values({
                    farmerId, accountId, type: "saida",
                    amount: String(amount), currency: "USD", category: expense.category,
                    description: expense.description?.replace(/\[Via WhatsApp\]\s*(\[[^\]]*\]\s*)?/, "").trim() || "Despesa aprovada",
                    paymentMethod: paymentMethod || "efetivo",
                    expenseId: expense.id, referenceType: "aprovacao_despesa",
                });
                await db.update(farmCashAccounts)
                    .set({ currentBalance: sqlFn`current_balance - ${amount}` })
                    .where(and(eq(farmCashAccounts.id, accountId), eq(farmCashAccounts.farmerId, farmerId)));
            }

            res.json({ success: true });
        } catch (error) {
            console.error("[FARM_EXPENSE_CONFIRM]", error);
            res.status(500).json({ error: "Failed to confirm expense" });
        }
    });

    app.post("/api/farm/expenses/:id/pay", requireFarmer, async (req, res) => {
        try {
            const { farmExpenses, farmCashTransactions, farmCashAccounts } = await import("../shared/schema");
            const { db } = await import("./db");
            const { eq, and, sql: sqlFn } = await import("drizzle-orm");

            const farmerId = await getEffectiveFarmerId(req);
            if (!farmerId) return res.status(403).json({ error: "Farmer not found" });
            const { accountId, paymentMethod, amount: payAmount } = req.body;
            if (!accountId) return res.status(400).json({ error: "accountId obrigatório" });

            const [expense] = await db.select().from(farmExpenses).where(
                and(eq(farmExpenses.id, req.params.id), eq(farmExpenses.farmerId, farmerId))
            ).limit(1);
            if (!expense) return res.status(404).json({ error: "Expense not found" });

            const totalAmount = parseFloat(expense.amount as string) || 0;
            const previouslyPaid = parseFloat(expense.paidAmount as string) || 0;
            const thisPayment = payAmount ? parseFloat(payAmount) : totalAmount - previouslyPaid;
            const newPaid = previouslyPaid + thisPayment;
            const newInstPaid = (expense.installmentsPaid || 0) + 1;
            const fullyPaid = newPaid >= totalAmount;

            await db.update(farmExpenses).set({
                paidAmount: String(newPaid),
                installmentsPaid: newInstPaid,
                paymentStatus: fullyPaid ? "pago" : "parcial",
            }).where(eq(farmExpenses.id, expense.id));

            await db.insert(farmCashTransactions).values({
                farmerId, accountId, type: "saida",
                amount: String(thisPayment), currency: "USD", category: expense.category,
                description: `Pagamento ${newInstPaid}/${expense.installments || 1} - ${expense.description?.replace(/\[Via WhatsApp\]\s*(\[[^\]]*\]\s*)?/, "").trim() || "Despesa"}`,
                paymentMethod: paymentMethod || "efetivo",
                expenseId: expense.id, referenceType: "aprovacao_despesa",
            });
            await db.update(farmCashAccounts)
                .set({ currentBalance: sqlFn`current_balance - ${thisPayment}` })
                .where(and(eq(farmCashAccounts.id, accountId), eq(farmCashAccounts.farmerId, farmerId)));

            res.json({ success: true, fullyPaid, paidAmount: newPaid, remaining: totalAmount - newPaid });
        } catch (error) {
            console.error("[FARM_EXPENSE_PAY]", error);
            res.status(500).json({ error: "Failed to pay expense" });
        }
    });

    app.delete("/api/farm/expenses/:id", requireFarmer, async (req, res) => {
        try {
            const farmerId = await getEffectiveFarmerId(req);
            if (!farmerId) return res.status(403).json({ error: "Farmer not found" });
            const { farmExpenses } = await import("../shared/schema");
            const { db } = await import("./db");
            const { eq, and } = await import("drizzle-orm");

            await db.delete(farmExpenses).where(
                and(
                    eq(farmExpenses.id, req.params.id),
                    eq(farmExpenses.farmerId, farmerId)
                )
            );

            res.status(204).send();
        } catch (error) {
            console.error("[FARM_EXPENSE_DELETE]", error);
            res.status(500).json({ error: "Failed to delete expense" });
        }
    });

    app.get("/api/farm/expenses/:id", requireFarmer, async (req, res) => {
        try {
            const farmerId = await getEffectiveFarmerId(req);
            if (!farmerId) return res.status(403).json({ error: "Farmer not found" });
            const { farmExpenses, farmExpenseItems } = await import("../shared/schema");
            const { db } = await import("./db");
            const { eq, and } = await import("drizzle-orm");

            const [expense] = await db.select().from(farmExpenses).where(
                and(
                    eq(farmExpenses.id, req.params.id),
                    eq(farmExpenses.farmerId, farmerId)
                )
            ).limit(1);

            if (!expense) {
                return res.status(404).json({ error: "Expense not found" });
            }

            const items = await db.select().from(farmExpenseItems).where(
                eq(farmExpenseItems.expenseId, expense.id)
            );

            res.json({
                ...expense,
                imageBase64: expense.imageBase64 ? `data:image/jpeg;base64,${expense.imageBase64.substring(0, 50)}...` : null,
                hasImage: !!expense.imageBase64,
                items,
            });
        } catch (error) {
            console.error("[FARM_EXPENSE_DETAIL]", error);
            res.status(500).json({ error: "Failed to get expense detail" });
        }
    });

    app.get("/api/farm/expenses/:id/image", requireFarmer, async (req, res) => {
        try {
            const farmerId = await getEffectiveFarmerId(req);
            if (!farmerId) return res.status(403).json({ error: "Farmer not found" });
            const { farmExpenses } = await import("../shared/schema");
            const { db } = await import("./db");
            const { eq, and } = await import("drizzle-orm");

            const [expense] = await db.select({ imageBase64: farmExpenses.imageBase64 }).from(farmExpenses).where(
                and(
                    eq(farmExpenses.id, req.params.id),
                    eq(farmExpenses.farmerId, farmerId)
                )
            ).limit(1);

            if (!expense?.imageBase64) {
                return res.status(404).json({ error: "Image not found" });
            }

            const buffer = Buffer.from(expense.imageBase64, "base64");
            res.setHeader("Content-Type", "image/jpeg");
            res.setHeader("Content-Length", buffer.length);
            res.send(buffer);
        } catch (error) {
            console.error("[FARM_EXPENSE_IMAGE]", error);
            res.status(500).json({ error: "Failed to get expense image" });
        }
    });

    // ==================== CATEGORIAS PERSONALIZADAS ====================

    app.get("/api/farm/expense-categories", requireFarmer, async (req, res) => {
        try {
            const { farmExpenseCategories } = await import("../shared/schema");
            const { db } = await import("./db");
            const { eq } = await import("drizzle-orm");
            const farmerId = await getEffectiveFarmerId(req);
            if (!farmerId) return res.status(403).json({ error: "Farmer not found" });
            const categories = await db.select().from(farmExpenseCategories).where(eq(farmExpenseCategories.farmerId, farmerId));
            res.json(categories);
        } catch (error) {
            res.status(500).json({ error: "Failed to load categories" });
        }
    });

    app.post("/api/farm/expense-categories", requireFarmer, async (req, res) => {
        try {
            const { farmExpenseCategories } = await import("../shared/schema");
            const { db } = await import("./db");
            const farmerId = await getEffectiveFarmerId(req);
            if (!farmerId) return res.status(403).json({ error: "Farmer not found" });
            const { name, type } = req.body;
            if (!name) return res.status(400).json({ error: "Nome é obrigatório" });
            const [cat] = await db.insert(farmExpenseCategories).values({
                farmerId, name, type: type || "saida",
            }).returning();
            res.json(cat);
        } catch (error) {
            res.status(500).json({ error: "Failed to create category" });
        }
    });

    app.put("/api/farm/expense-categories/:id", requireFarmer, async (req, res) => {
        try {
            const { farmExpenseCategories } = await import("../shared/schema");
            const { db } = await import("./db");
            const { eq, and } = await import("drizzle-orm");
            const farmerId = await getEffectiveFarmerId(req);
            if (!farmerId) return res.status(403).json({ error: "Farmer not found" });
            const { name, type } = req.body;
            if (!name) return res.status(400).json({ error: "Nome é obrigatório" });
            const [updated] = await db.update(farmExpenseCategories)
                .set({ name, type })
                .where(and(eq(farmExpenseCategories.id, req.params.id), eq(farmExpenseCategories.farmerId, farmerId)))
                .returning();
            res.json(updated);
        } catch (error) {
            res.status(500).json({ error: "Failed to update category" });
        }
    });

    app.delete("/api/farm/expense-categories/:id", requireFarmer, async (req, res) => {
        try {
            const { farmExpenseCategories } = await import("../shared/schema");
            const { db } = await import("./db");
            const { eq, and } = await import("drizzle-orm");
            const farmerId = await getEffectiveFarmerId(req);
            if (!farmerId) return res.status(403).json({ error: "Farmer not found" });
            await db.delete(farmExpenseCategories).where(
                and(eq(farmExpenseCategories.id, req.params.id), eq(farmExpenseCategories.farmerId, farmerId))
            );
            res.json({ ok: true });
        } catch (error) {
            res.status(500).json({ error: "Failed to delete category" });
        }
    });

}
