import type { Express } from "express";
import { requireFarmer } from "./farm-middleware";

export function registerFarmFinancialRoutes(app: Express) {

    // ============================================================================
    // CONTAS A PAGAR
    // ============================================================================

    app.get("/api/farm/accounts-payable", requireFarmer, async (req, res) => {
        try {
            const { farmAccountsPayable } = await import("../shared/schema");
            const { eq, and, desc } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            const conditions: any[] = [eq(farmAccountsPayable.farmerId, farmerId)];
            if (req.query.status) conditions.push(eq(farmAccountsPayable.status, req.query.status as string));

            const accounts = await db.select().from(farmAccountsPayable)
                .where(and(...conditions))
                .orderBy(desc(farmAccountsPayable.dueDate));
            res.json(accounts);
        } catch (error) {
            console.error("[ACCOUNTS_PAYABLE_GET]", error);
            res.status(500).json({ error: "Failed to get accounts payable" });
        }
    });

    app.post("/api/farm/accounts-payable", requireFarmer, async (req, res) => {
        try {
            const { farmAccountsPayable } = await import("../shared/schema");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            const totalInstallments = parseInt(req.body.totalInstallments) || 1;
            const firstDueDate = req.body.dueDate ? new Date(req.body.dueDate) : new Date();
            const perInstallmentAmount = (parseFloat(req.body.totalAmount) / totalInstallments).toFixed(2);

            if (totalInstallments <= 1) {
                // Single entry — original behavior
                const [ap] = await db.insert(farmAccountsPayable).values({
                    ...req.body,
                    farmerId,
                    installmentNumber: 1,
                    totalInstallments: 1,
                    dueDate: firstDueDate,
                }).returning();
                return res.json(ap);
            }

            // Generate N installments automatically
            const created = [];
            for (let i = 0; i < totalInstallments; i++) {
                const instDue = new Date(firstDueDate);
                instDue.setMonth(instDue.getMonth() + i);
                const [ap] = await db.insert(farmAccountsPayable).values({
                    supplier: req.body.supplier,
                    description: `${req.body.description || req.body.supplier} — Parcela ${i + 1}/${totalInstallments}`,
                    totalAmount: perInstallmentAmount,
                    currency: req.body.currency || "USD",
                    farmerId,
                    installmentNumber: i + 1,
                    totalInstallments,
                    dueDate: instDue,
                    status: "aberto",
                }).returning();
                created.push(ap);
            }
            res.json(created);
        } catch (error) {
            console.error("[ACCOUNTS_PAYABLE_CREATE]", error);
            res.status(500).json({ error: "Failed to create account payable" });
        }
    });

    app.put("/api/farm/accounts-payable/:id", requireFarmer, async (req, res) => {
        try {
            const { farmAccountsPayable } = await import("../shared/schema");
            const { eq, and } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            const [updated] = await db.update(farmAccountsPayable).set(req.body).where(
                and(eq(farmAccountsPayable.id, req.params.id), eq(farmAccountsPayable.farmerId, farmerId))
            ).returning();
            res.json(updated);
        } catch (error) {
            console.error("[ACCOUNTS_PAYABLE_UPDATE]", error);
            res.status(500).json({ error: "Failed to update account payable" });
        }
    });

    // Pay action — creates cash flow transaction
    app.post("/api/farm/accounts-payable/:id/pay", requireFarmer, async (req, res) => {
        try {
            const { farmAccountsPayable, farmCashTransactions, farmCashAccounts } = await import("../shared/schema");
            const { eq, and } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;
            const { accountId, amount, paymentMethod } = req.body;

            // Get the account payable
            const [ap] = await db.select().from(farmAccountsPayable).where(
                and(eq(farmAccountsPayable.id, req.params.id), eq(farmAccountsPayable.farmerId, farmerId))
            );
            if (!ap) return res.status(404).json({ error: "Not found" });

            const payAmount = parseFloat(amount || ap.totalAmount);
            const previousPaid = parseFloat(ap.paidAmount || "0");
            const newPaidTotal = previousPaid + payAmount;
            const totalDue = parseFloat(ap.totalAmount);

            // Create cash flow transaction (SAIDA)
            const [tx] = await db.insert(farmCashTransactions).values({
                farmerId,
                accountId,
                type: "saida",
                amount: String(payAmount),
                currency: ap.currency,
                category: "pagamento_titulo",
                description: `Pgto: ${ap.supplier} - ${ap.description || ''}`.trim(),
                paymentMethod: paymentMethod || "transferencia",
                referenceType: "pagamento_conta",
            }).returning();

            // Update account balance
            const { sql: sqlFn } = await import("drizzle-orm");
            await db.update(farmCashAccounts)
                .set({ currentBalance: sqlFn`current_balance - ${payAmount}` })
                .where(and(eq(farmCashAccounts.id, accountId), eq(farmCashAccounts.farmerId, farmerId)));

            // Update account payable status
            const newStatus = newPaidTotal >= totalDue ? "pago" : "parcial";
            await db.update(farmAccountsPayable).set({
                paidAmount: String(newPaidTotal),
                paidDate: new Date(),
                status: newStatus,
                cashTransactionId: tx.id,
            }).where(eq(farmAccountsPayable.id, req.params.id));

            res.json({ success: true, status: newStatus, transaction: tx });
        } catch (error) {
            console.error("[ACCOUNTS_PAYABLE_PAY]", error);
            res.status(500).json({ error: "Failed to pay account" });
        }
    });

    app.delete("/api/farm/accounts-payable/:id", requireFarmer, async (req, res) => {
        try {
            const { farmAccountsPayable } = await import("../shared/schema");
            const { eq, and } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            await db.delete(farmAccountsPayable).where(
                and(eq(farmAccountsPayable.id, req.params.id), eq(farmAccountsPayable.farmerId, farmerId))
            );
            res.json({ success: true });
        } catch (error) {
            console.error("[ACCOUNTS_PAYABLE_DELETE]", error);
            res.status(500).json({ error: "Failed to delete account payable" });
        }
    });

    // Backfill: sync all confirmed invoices into accounts payable
    app.post("/api/farm/accounts-payable/backfill-invoices", requireFarmer, async (req, res) => {
        try {
            const { farmAccountsPayable, farmInvoices } = await import("../shared/schema");
            const { eq, and, isNull } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            // Get all confirmed invoices for this farmer
            const confirmedInvoices = await db.select().from(farmInvoices)
                .where(and(eq(farmInvoices.farmerId, farmerId), eq(farmInvoices.status, "confirmed")));

            // Get all existing AP entries with invoice links
            const existingAPs = await db.select().from(farmAccountsPayable)
                .where(eq(farmAccountsPayable.farmerId, farmerId));
            const linkedInvoiceIds = new Set(existingAPs.filter(ap => ap.invoiceId).map(ap => ap.invoiceId));

            let created = 0;
            for (const invoice of confirmedInvoices) {
                if (linkedInvoiceIds.has(invoice.id)) continue;
                if (!invoice.totalAmount || parseFloat(invoice.totalAmount) <= 0) continue;

                const issueDate = invoice.issueDate ? new Date(invoice.issueDate) : new Date();
                const dueDate = new Date(issueDate);
                dueDate.setDate(dueDate.getDate() + 30);

                await db.insert(farmAccountsPayable).values({
                    farmerId,
                    invoiceId: invoice.id,
                    supplier: invoice.supplier || "Fornecedor",
                    description: `Fatura #${invoice.invoiceNumber || invoice.id.slice(0, 8)}`,
                    totalAmount: String(invoice.totalAmount),
                    currency: invoice.currency || "USD",
                    dueDate,
                    status: "aberto",
                });
                created++;
            }

            res.json({
                message: `Backfill concluido: ${created} fatura(s) adicionadas ao Contas a Pagar.`,
                total: confirmedInvoices.length,
                created,
                alreadyLinked: confirmedInvoices.length - created,
            });
        } catch (error) {
            console.error("[ACCOUNTS_PAYABLE_BACKFILL]", error);
            res.status(500).json({ error: "Failed to backfill invoices" });
        }
    });

    // ============================================================================
    // CONTAS A RECEBER
    // ============================================================================

    app.get("/api/farm/accounts-receivable", requireFarmer, async (req, res) => {
        try {
            const { farmAccountsReceivable } = await import("../shared/schema");
            const { eq, and, desc } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            const conditions: any[] = [eq(farmAccountsReceivable.farmerId, farmerId)];
            if (req.query.status) conditions.push(eq(farmAccountsReceivable.status, req.query.status as string));

            const accounts = await db.select().from(farmAccountsReceivable)
                .where(and(...conditions))
                .orderBy(desc(farmAccountsReceivable.dueDate));
            res.json(accounts);
        } catch (error) {
            console.error("[ACCOUNTS_RECEIVABLE_GET]", error);
            res.status(500).json({ error: "Failed to get accounts receivable" });
        }
    });

    app.post("/api/farm/accounts-receivable", requireFarmer, async (req, res) => {
        try {
            const { farmAccountsReceivable } = await import("../shared/schema");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            const [ar] = await db.insert(farmAccountsReceivable).values({
                ...req.body,
                farmerId,
                dueDate: req.body.dueDate ? new Date(req.body.dueDate) : new Date(),
            }).returning();
            res.json(ar);
        } catch (error) {
            console.error("[ACCOUNTS_RECEIVABLE_CREATE]", error);
            res.status(500).json({ error: "Failed to create account receivable" });
        }
    });

    // Receive action — creates cash flow transaction (ENTRADA)
    app.post("/api/farm/accounts-receivable/:id/receive", requireFarmer, async (req, res) => {
        try {
            const { farmAccountsReceivable, farmCashTransactions, farmCashAccounts } = await import("../shared/schema");
            const { eq, and } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;
            const { accountId, amount, paymentMethod } = req.body;

            const [ar] = await db.select().from(farmAccountsReceivable).where(
                and(eq(farmAccountsReceivable.id, req.params.id), eq(farmAccountsReceivable.farmerId, farmerId))
            );
            if (!ar) return res.status(404).json({ error: "Not found" });

            const receiveAmount = parseFloat(amount || ar.totalAmount);
            const previousReceived = parseFloat(ar.receivedAmount || "0");
            const newReceivedTotal = previousReceived + receiveAmount;
            const totalExpected = parseFloat(ar.totalAmount);

            // Create cash flow transaction (ENTRADA)
            const [tx] = await db.insert(farmCashTransactions).values({
                farmerId,
                accountId,
                type: "entrada",
                amount: String(receiveAmount),
                currency: ar.currency,
                category: "recebimento_venda",
                description: `Receb: ${ar.buyer} - ${ar.description || ''}`.trim(),
                paymentMethod: paymentMethod || "transferencia",
                referenceType: "recebimento_conta",
            }).returning();

            // Update account balance
            const { sql: sqlFn } = await import("drizzle-orm");
            await db.update(farmCashAccounts)
                .set({ currentBalance: sqlFn`current_balance + ${receiveAmount}` })
                .where(and(eq(farmCashAccounts.id, accountId), eq(farmCashAccounts.farmerId, farmerId)));

            // Update account receivable status
            const newStatus = newReceivedTotal >= totalExpected ? "recebido" : "parcial";
            await db.update(farmAccountsReceivable).set({
                receivedAmount: String(newReceivedTotal),
                receivedDate: new Date(),
                status: newStatus,
                cashTransactionId: tx.id,
            }).where(eq(farmAccountsReceivable.id, req.params.id));

            res.json({ success: true, status: newStatus, transaction: tx });
        } catch (error) {
            console.error("[ACCOUNTS_RECEIVABLE_RECEIVE]", error);
            res.status(500).json({ error: "Failed to receive payment" });
        }
    });

    app.delete("/api/farm/accounts-receivable/:id", requireFarmer, async (req, res) => {
        try {
            const { farmAccountsReceivable } = await import("../shared/schema");
            const { eq, and } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            await db.delete(farmAccountsReceivable).where(
                and(eq(farmAccountsReceivable.id, req.params.id), eq(farmAccountsReceivable.farmerId, farmerId))
            );
            res.json({ success: true });
        } catch (error) {
            console.error("[ACCOUNTS_RECEIVABLE_DELETE]", error);
            res.status(500).json({ error: "Failed to delete account receivable" });
        }
    });

    app.put("/api/farm/accounts-receivable/:id", requireFarmer, async (req, res) => {
        try {
            const { farmAccountsReceivable } = await import("../shared/schema");
            const { eq, and } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            const [updated] = await db.update(farmAccountsReceivable).set(req.body).where(
                and(eq(farmAccountsReceivable.id, req.params.id), eq(farmAccountsReceivable.farmerId, farmerId))
            ).returning();
            res.json(updated);
        } catch (error) {
            console.error("[ACCOUNTS_RECEIVABLE_UPDATE]", error);
            res.status(500).json({ error: "Failed to update account receivable" });
        }
    });

    // ============================================================================
    // DRE — Estado de Resultados por Safra (read-only aggregation)
    // ============================================================================

    app.get("/api/farm/dre", requireFarmer, async (req, res) => {
        try {
            const {
                farmAccountsReceivable, farmAccountsPayable,
                farmExpenses, farmApplications, farmStock,
                farmCashTransactions, farmGrainContracts
            } = await import("../shared/schema");
            const { eq, and, sql } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            // RECEITAS: Contas a Receber (recebido)
            const [receivableSum] = await db.select({
                total: sql<string>`COALESCE(SUM(CAST(${farmAccountsReceivable.receivedAmount} AS NUMERIC)), 0)`,
            }).from(farmAccountsReceivable).where(eq(farmAccountsReceivable.farmerId, farmerId));

            // RECEITAS: Contratos de graos (valor total dos concluidos/parciais)
            const [contractRevenueSum] = await db.select({
                total: sql<string>`COALESCE(SUM(CAST(${farmGrainContracts.totalValue} AS NUMERIC) * CAST(${farmGrainContracts.deliveredQuantity} AS NUMERIC) / NULLIF(CAST(${farmGrainContracts.totalQuantity} AS NUMERIC), 0)), 0)`,
            }).from(farmGrainContracts).where(
                and(eq(farmGrainContracts.farmerId, farmerId), sql`${farmGrainContracts.status} != 'cancelado'`)
            );

            // CUSTOS DE PRODUCAO: applications x avg cost
            const [appCostSum] = await db.select({
                total: sql<string>`COALESCE(SUM(CAST(${farmApplications.quantity} AS NUMERIC) * CAST(${farmStock.averageCost} AS NUMERIC)), 0)`,
            }).from(farmApplications)
                .leftJoin(farmStock, and(
                    eq(farmApplications.productId, farmStock.productId),
                    eq(farmApplications.farmerId, farmStock.farmerId),
                ))
                .where(eq(farmApplications.farmerId, farmerId));

            // DESPESAS com talhao (custo de producao)
            const [plotExpenseSum] = await db.select({
                total: sql<string>`COALESCE(SUM(CAST(${farmExpenses.amount} AS NUMERIC)), 0)`,
            }).from(farmExpenses).where(
                and(eq(farmExpenses.farmerId, farmerId), sql`${farmExpenses.plotId} IS NOT NULL`)
            );

            // DESPESAS sem talhao (operacionais)
            const [opExpenseSum] = await db.select({
                total: sql<string>`COALESCE(SUM(CAST(${farmExpenses.amount} AS NUMERIC)), 0)`,
            }).from(farmExpenses).where(
                and(eq(farmExpenses.farmerId, farmerId), sql`${farmExpenses.plotId} IS NULL`)
            );

            // CONTAS A PAGAR pagas (financeiro)
            const [payableSum] = await db.select({
                total: sql<string>`COALESCE(SUM(CAST(${farmAccountsPayable.paidAmount} AS NUMERIC)), 0)`,
            }).from(farmAccountsPayable).where(eq(farmAccountsPayable.farmerId, farmerId));

            const receitasAR = parseFloat(receivableSum.total);
            const receitasContratos = parseFloat(contractRevenueSum.total);
            const receitas = receitasAR + receitasContratos;
            const custoProducao = parseFloat(appCostSum.total) + parseFloat(plotExpenseSum.total);
            const lucroBruto = receitas - custoProducao;
            const despesasOp = parseFloat(opExpenseSum.total);
            const resultadoOp = lucroBruto - despesasOp;
            const resultadoLiquido = resultadoOp;

            res.json({
                receitas,
                custoProducao,
                lucroBruto,
                despesasOperacionais: despesasOp,
                resultadoOperacional: resultadoOp,
                resultadoLiquido,
                detail: {
                    receitasRecebidas: receitasAR,
                    receitasContratos,
                    custoInsumos: parseFloat(appCostSum.total),
                    despesasTalhao: parseFloat(plotExpenseSum.total),
                    despesasGerais: despesasOp,
                    totalPago: parseFloat(payableSum.total),
                },
            });
        } catch (error) {
            console.error("[DRE_GET]", error);
            res.status(500).json({ error: "Failed to generate DRE" });
        }
    });

    // ============================================================================
    // ORCAMENTO POR SAFRA
    // ============================================================================

    app.get("/api/farm/budgets", requireFarmer, async (req, res) => {
        try {
            const { farmBudgets, farmExpenses } = await import("../shared/schema");
            const { eq, and, sql } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            const budgets = await db.select().from(farmBudgets)
                .where(eq(farmBudgets.farmerId, farmerId));

            // Get actual expenses by category for comparison
            const actualExpenses = await db.select({
                category: farmExpenses.category,
                actualAmount: sql<string>`COALESCE(SUM(CAST(${farmExpenses.amount} AS NUMERIC)), 0)`,
            }).from(farmExpenses)
                .where(eq(farmExpenses.farmerId, farmerId))
                .groupBy(farmExpenses.category);

            const actualMap = new Map(actualExpenses.map((e: any) => [e.category, parseFloat(e.actualAmount)]));

            res.json(budgets.map((b: any) => ({
                ...b,
                actualAmount: actualMap.get(b.category) || 0,
                percentUsed: parseFloat(String(b.plannedAmount)) > 0
                    ? (((actualMap.get(b.category) || 0) / parseFloat(String(b.plannedAmount))) * 100).toFixed(1)
                    : "0",
            })));
        } catch (error) {
            console.error("[BUDGETS_GET]", error);
            res.status(500).json({ error: "Failed to get budgets" });
        }
    });

    app.post("/api/farm/budgets", requireFarmer, async (req, res) => {
        try {
            const { farmBudgets } = await import("../shared/schema");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            const [budget] = await db.insert(farmBudgets).values({
                ...req.body,
                farmerId,
            }).returning();
            res.json(budget);
        } catch (error) {
            console.error("[BUDGET_CREATE]", error);
            res.status(500).json({ error: "Failed to create budget" });
        }
    });

    app.put("/api/farm/budgets/:id", requireFarmer, async (req, res) => {
        try {
            const { farmBudgets } = await import("../shared/schema");
            const { eq, and } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            const [updated] = await db.update(farmBudgets).set(req.body).where(
                and(eq(farmBudgets.id, req.params.id), eq(farmBudgets.farmerId, farmerId))
            ).returning();
            res.json(updated);
        } catch (error) {
            console.error("[BUDGET_UPDATE]", error);
            res.status(500).json({ error: "Failed to update budget" });
        }
    });

    app.delete("/api/farm/budgets/:id", requireFarmer, async (req, res) => {
        try {
            const { farmBudgets } = await import("../shared/schema");
            const { eq, and } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            await db.delete(farmBudgets).where(
                and(eq(farmBudgets.id, req.params.id), eq(farmBudgets.farmerId, farmerId))
            );
            res.json({ success: true });
        } catch (error) {
            console.error("[BUDGET_DELETE]", error);
            res.status(500).json({ error: "Failed to delete budget" });
        }
    });

    // ============================================================================
    // CONCILIACAO BANCARIA
    // ============================================================================

    app.get("/api/farm/bank-statements", requireFarmer, async (req, res) => {
        try {
            const { farmBankStatements } = await import("../shared/schema");
            const { eq, and, desc } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            const conditions: any[] = [eq(farmBankStatements.farmerId, farmerId)];
            if (req.query.accountId) conditions.push(eq(farmBankStatements.accountId, req.query.accountId as string));
            if (req.query.status) conditions.push(eq(farmBankStatements.status, req.query.status as string));

            const statements = await db.select().from(farmBankStatements)
                .where(and(...conditions))
                .orderBy(desc(farmBankStatements.transactionDate));
            res.json(statements);
        } catch (error) {
            console.error("[BANK_STATEMENTS_GET]", error);
            res.status(500).json({ error: "Failed to get bank statements" });
        }
    });

    app.post("/api/farm/bank-statements", requireFarmer, async (req, res) => {
        try {
            const { farmBankStatements } = await import("../shared/schema");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            // Support batch import (array of statements)
            const items = Array.isArray(req.body) ? req.body : [req.body];
            const importBatch = `import-${Date.now()}`;

            const inserted = [];
            for (const item of items) {
                const [stmt] = await db.insert(farmBankStatements).values({
                    ...item,
                    farmerId,
                    importBatch,
                }).returning();
                inserted.push(stmt);
            }
            res.json(inserted);
        } catch (error) {
            console.error("[BANK_STATEMENT_CREATE]", error);
            res.status(500).json({ error: "Failed to import bank statements" });
        }
    });

    // Match bank statement to cash flow transaction
    app.post("/api/farm/bank-statements/:id/match", requireFarmer, async (req, res) => {
        try {
            const { farmBankStatements } = await import("../shared/schema");
            const { eq, and } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;
            const { transactionId } = req.body;

            const [updated] = await db.update(farmBankStatements).set({
                matchedTransactionId: transactionId,
                status: "matched",
            }).where(
                and(eq(farmBankStatements.id, req.params.id), eq(farmBankStatements.farmerId, farmerId))
            ).returning();
            res.json(updated);
        } catch (error) {
            console.error("[BANK_STATEMENT_MATCH]", error);
            res.status(500).json({ error: "Failed to match statement" });
        }
    });

    // ============================================================================
    // ESTOQUE DE GRAOS
    // ============================================================================

    app.get("/api/farm/grain-stock", requireFarmer, async (req, res) => {
        try {
            const { farmGrainStock } = await import("../shared/schema");
            const { eq, desc } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            const stock = await db.select().from(farmGrainStock)
                .where(eq(farmGrainStock.farmerId, farmerId))
                .orderBy(desc(farmGrainStock.updatedAt));
            res.json(stock);
        } catch (error) {
            console.error("[GRAIN_STOCK_GET]", error);
            res.status(500).json({ error: "Failed to get grain stock" });
        }
    });

    // ============================================================================
    // COMERCIALIZACAO — CONTRATOS DE GRAOS
    // ============================================================================

    app.get("/api/farm/grain-contracts", requireFarmer, async (req, res) => {
        try {
            const { farmGrainContracts } = await import("../shared/schema");
            const { eq, desc } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            const contracts = await db.select().from(farmGrainContracts)
                .where(eq(farmGrainContracts.farmerId, farmerId))
                .orderBy(desc(farmGrainContracts.createdAt));
            res.json(contracts);
        } catch (error) {
            console.error("[GRAIN_CONTRACTS_GET]", error);
            res.status(500).json({ error: "Failed to get grain contracts" });
        }
    });

    app.post("/api/farm/grain-contracts", requireFarmer, async (req, res) => {
        try {
            const { farmGrainContracts } = await import("../shared/schema");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            const { buyer, crop, contractNumber, contractType, totalQuantity, pricePerTon, currency, deliveryStartDate, deliveryEndDate, seasonId, notes } = req.body;
            if (!buyer || !crop || !totalQuantity || !pricePerTon) {
                return res.status(400).json({ error: "buyer, crop, totalQuantity, pricePerTon sao obrigatorios" });
            }

            const qty = parseFloat(totalQuantity);
            const price = parseFloat(pricePerTon);
            const totalValue = (qty / 1000) * price; // kg → ton x price/ton

            const [contract] = await db.insert(farmGrainContracts).values({
                farmerId,
                buyer, crop,
                contractNumber: contractNumber || null,
                contractType: contractType || "spot",
                totalQuantity: String(qty),
                pricePerTon: String(price),
                currency: currency || "USD",
                totalValue: String(totalValue.toFixed(2)),
                deliveryStartDate: deliveryStartDate ? new Date(deliveryStartDate) : null,
                deliveryEndDate: deliveryEndDate ? new Date(deliveryEndDate) : null,
                seasonId: seasonId || null,
                notes: notes || null,
            }).returning();

            res.json(contract);
        } catch (error) {
            console.error("[GRAIN_CONTRACT_CREATE]", error);
            res.status(500).json({ error: "Failed to create grain contract" });
        }
    });

    app.put("/api/farm/grain-contracts/:id", requireFarmer, async (req, res) => {
        try {
            const { farmGrainContracts } = await import("../shared/schema");
            const { eq, and } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            const updateData = { ...req.body };
            delete updateData.id;
            delete updateData.farmerId;

            // Recalculate totalValue if quantity or price changed
            if (updateData.totalQuantity || updateData.pricePerTon) {
                const qty = parseFloat(updateData.totalQuantity || req.body.totalQuantity);
                const price = parseFloat(updateData.pricePerTon || req.body.pricePerTon);
                if (qty && price) updateData.totalValue = String(((qty / 1000) * price).toFixed(2));
            }

            const [updated] = await db.update(farmGrainContracts).set(updateData).where(
                and(eq(farmGrainContracts.id, req.params.id), eq(farmGrainContracts.farmerId, farmerId))
            ).returning();
            res.json(updated);
        } catch (error) {
            console.error("[GRAIN_CONTRACT_UPDATE]", error);
            res.status(500).json({ error: "Failed to update grain contract" });
        }
    });

    app.delete("/api/farm/grain-contracts/:id", requireFarmer, async (req, res) => {
        try {
            const { farmGrainContracts } = await import("../shared/schema");
            const { eq, and } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            await db.delete(farmGrainContracts).where(
                and(eq(farmGrainContracts.id, req.params.id), eq(farmGrainContracts.farmerId, farmerId))
            );
            res.status(204).send();
        } catch (error) {
            console.error("[GRAIN_CONTRACT_DELETE]", error);
            res.status(500).json({ error: "Failed to delete grain contract" });
        }
    });

    // ============================================================================
    // ENTREGAS DE GRAOS (abate contrato + saida estoque + AR automatica)
    // ============================================================================

    app.get("/api/farm/grain-deliveries", requireFarmer, async (req, res) => {
        try {
            const { farmGrainDeliveries } = await import("../shared/schema");
            const { eq, desc } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            const deliveries = await db.select().from(farmGrainDeliveries)
                .where(eq(farmGrainDeliveries.farmerId, farmerId))
                .orderBy(desc(farmGrainDeliveries.deliveryDate));
            res.json(deliveries);
        } catch (error) {
            console.error("[GRAIN_DELIVERIES_GET]", error);
            res.status(500).json({ error: "Failed to get grain deliveries" });
        }
    });

    app.post("/api/farm/grain-deliveries", requireFarmer, async (req, res) => {
        try {
            const { farmGrainDeliveries, farmGrainContracts, farmGrainStock, farmAccountsReceivable } = await import("../shared/schema");
            const { eq, and, sql: sqlFn } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            const { contractId, romaneioId, quantity, deliveryDate, notes } = req.body;
            if (!contractId || !quantity) {
                return res.status(400).json({ error: "contractId e quantity sao obrigatorios" });
            }

            // Get the contract
            const [contract] = await db.select().from(farmGrainContracts).where(
                and(eq(farmGrainContracts.id, contractId), eq(farmGrainContracts.farmerId, farmerId))
            );
            if (!contract) return res.status(404).json({ error: "Contrato nao encontrado" });

            const deliverQty = parseFloat(quantity);

            // 1. Create delivery record
            const [delivery] = await db.insert(farmGrainDeliveries).values({
                farmerId,
                contractId,
                romaneioId: romaneioId || null,
                quantity: String(deliverQty),
                deliveryDate: deliveryDate ? new Date(deliveryDate) : new Date(),
                notes: notes || null,
            }).returning();

            // 2. AUTO: Update contract delivered quantity + status
            const newDelivered = parseFloat(contract.deliveredQuantity) + deliverQty;
            const totalQty = parseFloat(contract.totalQuantity);
            const newStatus = newDelivered >= totalQty ? "concluido" : "parcial";

            await db.update(farmGrainContracts).set({
                deliveredQuantity: String(newDelivered),
                status: newStatus,
            }).where(eq(farmGrainContracts.id, contractId));

            // 3. AUTO: Saida do estoque de graos
            try {
                const cropNorm = contract.crop.toLowerCase().trim();
                const existing = await db.select().from(farmGrainStock).where(
                    and(eq(farmGrainStock.farmerId, farmerId), eq(farmGrainStock.crop, cropNorm))
                );
                if (existing.length > 0) {
                    await db.update(farmGrainStock)
                        .set({ quantity: sqlFn`GREATEST(CAST(${farmGrainStock.quantity} AS NUMERIC) - ${deliverQty}, 0)`, updatedAt: new Date() })
                        .where(eq(farmGrainStock.id, existing[0].id));
                }
                console.log(`[DELIVERY→GRAIN_STOCK] -${deliverQty}kg ${cropNorm}`);
            } catch (gsErr) {
                console.error("[DELIVERY→GRAIN_STOCK_ERROR]", gsErr);
            }

            // 4. AUTO: Criar Conta a Receber proporcional
            try {
                const deliveryValue = (deliverQty / 1000) * parseFloat(contract.pricePerTon);
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + 30);

                await db.insert(farmAccountsReceivable).values({
                    farmerId,
                    buyer: contract.buyer,
                    description: `Entrega ${contract.crop} - Contrato #${contract.contractNumber || contract.id.slice(0, 8)} - ${(deliverQty / 1000).toFixed(2)} ton`,
                    totalAmount: String(deliveryValue.toFixed(2)),
                    currency: contract.currency,
                    dueDate,
                    status: "pendente",
                });
                console.log(`[DELIVERY→AR] Auto-created AR for ${deliveryValue.toFixed(2)} ${contract.currency}`);
            } catch (arErr) {
                console.error("[DELIVERY→AR_ERROR]", arErr);
            }

            res.json({ success: true, delivery, contractStatus: newStatus, deliveredTotal: newDelivered });
        } catch (error) {
            console.error("[GRAIN_DELIVERY_CREATE]", error);
            res.status(500).json({ error: "Failed to create grain delivery" });
        }
    });

    // ============================================================================
    // ALERTAS FINANCEIROS (AP/AR vencimento)
    // ============================================================================

    app.get("/api/farm/financial-alerts", requireFarmer, async (req, res) => {
        try {
            const { farmAccountsPayable, farmAccountsReceivable } = await import("../shared/schema");
            const { eq, and, lte, sql } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            const now = new Date();
            const in7days = new Date();
            in7days.setDate(in7days.getDate() + 7);

            // AP vencidas ou vencendo em 7 dias
            const apAlerts = await db.select().from(farmAccountsPayable).where(
                and(
                    eq(farmAccountsPayable.farmerId, farmerId),
                    sql`${farmAccountsPayable.status} IN ('aberto', 'parcial')`,
                    lte(farmAccountsPayable.dueDate, in7days)
                )
            );

            // AR vencidas ou vencendo em 7 dias
            const arAlerts = await db.select().from(farmAccountsReceivable).where(
                and(
                    eq(farmAccountsReceivable.farmerId, farmerId),
                    sql`${farmAccountsReceivable.status} IN ('pendente', 'parcial')`,
                    lte(farmAccountsReceivable.dueDate, in7days)
                )
            );

            const alerts = [
                ...apAlerts.map((ap: any) => ({
                    type: "ap" as const,
                    id: ap.id,
                    description: ap.description || ap.supplier,
                    amount: ap.totalAmount,
                    paidAmount: ap.paidAmount,
                    dueDate: ap.dueDate,
                    isOverdue: new Date(ap.dueDate) < now,
                    daysUntilDue: Math.ceil((new Date(ap.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
                })),
                ...arAlerts.map((ar: any) => ({
                    type: "ar" as const,
                    id: ar.id,
                    description: ar.description || ar.buyer,
                    amount: ar.totalAmount,
                    receivedAmount: ar.receivedAmount,
                    dueDate: ar.dueDate,
                    isOverdue: new Date(ar.dueDate) < now,
                    daysUntilDue: Math.ceil((new Date(ar.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
                })),
            ].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

            res.json({
                total: alerts.length,
                overdue: alerts.filter(a => a.isOverdue).length,
                upcoming: alerts.filter(a => !a.isOverdue).length,
                alerts,
            });
        } catch (error) {
            console.error("[FINANCIAL_ALERTS]", error);
            res.status(500).json({ error: "Failed to get financial alerts" });
        }
    });

}
