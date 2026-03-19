import type { Express } from "express";
import { requireFarmer, parseLocalDate } from "./farm-middleware";

// Feature #24b: Deduct quantity from farm_grain_stock for grain AR items
async function deductGrainStock(db: any, farmerId: string, items: any[]) {
    const { sql } = await import("drizzle-orm");
    const grainItems = items.filter((it: any) => it.grainCrop);
    for (const item of grainItems) {
        const qtyKg = item.unit === "TON"
            ? (parseFloat(item.quantity) || 0) * 1000
            : (parseFloat(item.quantity) || 0);
        if (qtyKg <= 0) continue;
        try {
            if (item.grainSeasonId) {
                await db.execute(sql`
                    UPDATE farm_grain_stock
                    SET quantity = GREATEST(0, quantity - ${qtyKg})
                    WHERE farmer_id = ${farmerId} AND crop = ${item.grainCrop} AND season_id = ${item.grainSeasonId}
                `);
            } else {
                await db.execute(sql`
                    UPDATE farm_grain_stock
                    SET quantity = GREATEST(0, quantity - ${qtyKg})
                    WHERE farmer_id = ${farmerId} AND crop = ${item.grainCrop}
                    ORDER BY updated_at DESC
                    LIMIT 1
                `);
            }
            console.log(`[GRAIN_STOCK] Deducted ${qtyKg}kg of ${item.grainCrop} for farmer ${farmerId}`);
        } catch (err) {
            console.error("[GRAIN_STOCK_DEDUCT]", err);
        }
    }
}

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
            const firstDueDate = parseLocalDate(req.body.dueDate) || new Date();
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
            const { db } = await import("./db");
            const { sql } = await import("drizzle-orm");
            const farmerId = (req.user as any).id;
            const { supplier, description, totalAmount, dueDate, seasonId } = req.body;

            const result = await db.execute(sql`
                UPDATE farm_accounts_payable
                SET supplier = ${supplier},
                    description = ${description || null},
                    total_amount = ${parseFloat(totalAmount)},
                    due_date = ${dueDate}::timestamp,
                    season_id = ${seasonId || null}
                WHERE id = ${req.params.id} AND farmer_id = ${farmerId}
                RETURNING *
            `);
            const rows = (result as any).rows ?? result;
            if (!rows.length) return res.status(404).json({ error: "Not found" });
            res.json(rows[0]);
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
            const { sql: sqlFn } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;
            const { accountId, amount, paymentMethod, accountRows } = req.body;

            // Get the account payable
            const [ap] = await db.select().from(farmAccountsPayable).where(
                and(eq(farmAccountsPayable.id, req.params.id), eq(farmAccountsPayable.farmerId, farmerId))
            );
            if (!ap) return res.status(404).json({ error: "Not found" });

            const payAmount = parseFloat(amount || ap.totalAmount);
            const previousPaid = parseFloat(ap.paidAmount || "0");
            const newPaidTotal = previousPaid + payAmount;
            const totalDue = parseFloat(ap.totalAmount);
            const txDesc = `Pgto: ${ap.supplier} - ${ap.description || ''}`.trim();

            let firstTxId: string | null = null;

            if (accountRows && Array.isArray(accountRows) && accountRows.length > 1) {
                // Multi-account payment: create one transaction per account row (Bug #21 fix)
                for (const row of accountRows) {
                    const rowAmount = parseFloat(row.amount);
                    if (!rowAmount || !row.accountId) continue;
                    const [rowTx] = await db.insert(farmCashTransactions).values({
                        farmerId,
                        accountId: row.accountId,
                        type: "saida",
                        amount: String(rowAmount),
                        currency: ap.currency,
                        category: "pagamento_titulo",
                        description: txDesc,
                        paymentMethod: paymentMethod || "transferencia",
                        referenceType: "pagamento_conta",
                        transactionDate: new Date(),
                    }).returning();
                    if (!firstTxId) firstTxId = rowTx.id;
                    await db.update(farmCashAccounts)
                        .set({ currentBalance: sqlFn`current_balance - ${rowAmount}` })
                        .where(and(eq(farmCashAccounts.id, row.accountId), eq(farmCashAccounts.farmerId, farmerId)));
                }
            } else {
                // Single-account payment
                const [tx] = await db.insert(farmCashTransactions).values({
                    farmerId,
                    accountId,
                    type: "saida",
                    amount: String(payAmount),
                    currency: ap.currency,
                    category: "pagamento_titulo",
                    description: txDesc,
                    paymentMethod: paymentMethod || "transferencia",
                    referenceType: "pagamento_conta",
                    transactionDate: new Date(),
                }).returning();
                firstTxId = tx.id;
                await db.update(farmCashAccounts)
                    .set({ currentBalance: sqlFn`current_balance - ${payAmount}` })
                    .where(and(eq(farmCashAccounts.id, accountId), eq(farmCashAccounts.farmerId, farmerId)));
            }

            // Update account payable status
            const newStatus = newPaidTotal >= totalDue ? "pago" : "parcial";
            await db.update(farmAccountsPayable).set({
                paidAmount: String(newPaidTotal),
                paidDate: new Date(),
                status: newStatus,
                cashTransactionId: firstTxId,
            }).where(eq(farmAccountsPayable.id, req.params.id));

            // Bug #1 fix: sync farmExpenses when payment made via AP
            if (ap.expenseId) {
                const { farmExpenses } = await import("../shared/schema");
                await db.update(farmExpenses).set({
                    paymentStatus: newStatus === "pago" ? "pago" : "parcial",
                    paidAmount: String(newPaidTotal),
                }).where(eq(farmExpenses.id, ap.expenseId));
            }

            res.json({ success: true, status: newStatus });
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

    // Detail with items
    app.get("/api/farm/accounts-receivable/:id", requireFarmer, async (req, res) => {
        try {
            const { farmAccountsReceivable, farmReceivableItems } = await import("../shared/schema");
            const { eq, and } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            const [ar] = await db.select().from(farmAccountsReceivable).where(
                and(eq(farmAccountsReceivable.id, req.params.id), eq(farmAccountsReceivable.farmerId, farmerId))
            );
            if (!ar) return res.status(404).json({ error: "Not found" });

            const items = await db.select().from(farmReceivableItems).where(eq(farmReceivableItems.receivableId, ar.id));
            res.json({ ...ar, items });
        } catch (error) {
            console.error("[ACCOUNTS_RECEIVABLE_DETAIL]", error);
            res.status(500).json({ error: "Failed to get AR detail" });
        }
    });

    app.post("/api/farm/accounts-receivable", requireFarmer, async (req, res) => {
        try {
            const { farmAccountsReceivable, farmReceivableItems } = await import("../shared/schema");
            const { db } = await import("./db");
            const { sql } = await import("drizzle-orm");
            const farmerId = (req.user as any).id;

            // Check invoice number uniqueness (skip if no invoice number)
            if (req.body.invoiceNumber) {
                const existing = await db.execute(sql`
                    SELECT id FROM farm_accounts_receivable
                    WHERE farmer_id = ${farmerId} AND invoice_number = ${req.body.invoiceNumber}
                    AND status != 'anulado'
                    LIMIT 1
                `);
                if (((existing as any).rows ?? existing).length > 0) {
                    return res.status(409).json({ error: `Numero de fatura ${req.body.invoiceNumber} ja existe em Contas a Receber` });
                }
            }

            const totalInstallments = parseInt(req.body.totalInstallments) || 1;
            const firstDueDate = parseLocalDate(req.body.dueDate) || new Date();
            const totalAmount = parseFloat(req.body.totalAmount) || 0;
            const perInstallmentAmount = (totalAmount / totalInstallments).toFixed(2);
            const items = req.body.items || [];

            // Calculate IVA from items
            let subtotalExenta = 0, subtotalGravada5 = 0, subtotalGravada10 = 0;
            for (const item of items) {
                const total = parseFloat(item.totalPrice) || 0;
                if (item.ivaRate === "exenta") subtotalExenta += total;
                else if (item.ivaRate === "5") subtotalGravada5 += total;
                else subtotalGravada10 += total;
            }
            const iva5 = subtotalGravada5 / 21;
            const iva10 = subtotalGravada10 / 11;

            const baseValues = {
                farmerId,
                romaneioId: req.body.romaneioId || null,
                buyer: req.body.buyer,
                currency: req.body.currency || "USD",
                status: "pendente",
                seasonId: req.body.seasonId || null,
                invoiceNumber: req.body.invoiceNumber || null,
                paymentCondition: req.body.paymentCondition || "contado",
                customerRuc: req.body.customerRuc || null,
                customerAddress: req.body.customerAddress || null,
                subtotalExenta: subtotalExenta.toFixed(2),
                subtotalGravada5: subtotalGravada5.toFixed(2),
                subtotalGravada10: subtotalGravada10.toFixed(2),
                iva5: iva5.toFixed(2),
                iva10: iva10.toFixed(2),
                observation: req.body.observation || null,
                supplierId: req.body.supplier_id || req.body.supplierId || null,
            };

            const insertItems = (receivableId: string) => {
                if (items.length === 0) return Promise.resolve();
                return db.insert(farmReceivableItems).values(
                    items.map((item: any) => ({
                        receivableId,
                        productId: item.productId || null,
                        productName: item.productName,
                        unit: item.unit || "UN",
                        quantity: String(item.quantity),
                        unitPrice: String(item.unitPrice),
                        ivaRate: item.ivaRate || "10",
                        totalPrice: String(item.totalPrice),
                        grainCrop: item.grainCrop || null,
                        grainSeasonId: item.grainSeasonId || null,
                    }))
                );
            };

            if (totalInstallments <= 1) {
                const [ar] = await db.insert(farmAccountsReceivable).values({
                    ...baseValues,
                    description: req.body.description || null,
                    totalAmount: totalAmount.toFixed(2),
                    dueDate: firstDueDate,
                    installmentNumber: 1,
                    totalInstallments: 1,
                }).returning();

                await insertItems(ar.id);
                await deductGrainStock(db, farmerId, items);
                return res.json(ar);
            }

            // Generate N installments
            const instSubtotalExenta = (subtotalExenta / totalInstallments).toFixed(2);
            const instSubtotalGravada5 = (subtotalGravada5 / totalInstallments).toFixed(2);
            const instSubtotalGravada10 = (subtotalGravada10 / totalInstallments).toFixed(2);
            const instIva5 = (iva5 / totalInstallments).toFixed(2);
            const instIva10 = (iva10 / totalInstallments).toFixed(2);
            const created = [];
            for (let i = 0; i < totalInstallments; i++) {
                const instDue = new Date(firstDueDate);
                instDue.setMonth(instDue.getMonth() + i);
                const instDesc = `${req.body.description || req.body.buyer} — Parcela ${i + 1}/${totalInstallments}`;
                const [ar] = await db.insert(farmAccountsReceivable).values({
                    ...baseValues,
                    description: instDesc,
                    totalAmount: perInstallmentAmount,
                    dueDate: instDue,
                    installmentNumber: i + 1,
                    totalInstallments,
                    subtotalExenta: instSubtotalExenta,
                    subtotalGravada5: instSubtotalGravada5,
                    subtotalGravada10: instSubtotalGravada10,
                    iva5: instIva5,
                    iva10: instIva10,
                }).returning();
                created.push(ar);

                if (i === 0) await insertItems(ar.id);
            }
            await deductGrainStock(db, farmerId, items);
            res.json(created);
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
            if (ar.status === "recebido") return res.status(409).json({ error: "Conta ja recebida integralmente" });

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
                transactionDate: new Date(),
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

            // Create cheque record if payment method is cheque
            if (paymentMethod === "cheque" && req.body.chequeData) {
                const cd = req.body.chequeData;
                const { sql: sqlFn2 } = await import("drizzle-orm");
                await db.execute(sqlFn2`
                    INSERT INTO farm_cheques
                        (farmer_id, account_id, type, cheque_number, bank, holder, amount, currency,
                         issue_date, due_date, status, related_receivable_id, cash_transaction_id)
                    VALUES
                        (${farmerId}, ${accountId || null}, ${'recebido'},
                         ${String(cd.chequeNumber || cd.numero || '')},
                         ${String(cd.bank || cd.banco || '')},
                         ${String(cd.holder || cd.titular || ar.buyer)},
                         ${String(receiveAmount)}, ${ar.currency},
                         ${new Date()}, ${cd.dueDate ? new Date(cd.dueDate) : null},
                         ${'emitido'}, ${req.params.id}, ${tx.id})
                `);
            }

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

    // Annulment: mark as "anulado" instead of deleting (preserves audit trail)
    app.post("/api/farm/accounts-receivable/:id/anular", requireFarmer, async (req, res) => {
        try {
            const { db } = await import("./db");
            const { sql } = await import("drizzle-orm");
            const farmerId = (req.user as any).id;
            const reason = req.body.reason || "Anulado pelo usuario";
            await db.execute(sql`
                UPDATE farm_accounts_receivable
                SET status = 'anulado', observation = ${reason}
                WHERE id = ${req.params.id} AND farmer_id = ${farmerId}
            `);
            res.json({ success: true });
        } catch (error) {
            console.error("[AR_ANULAR]", error);
            res.status(500).json({ error: "Failed to annul account receivable" });
        }
    });

    app.put("/api/farm/accounts-receivable/:id", requireFarmer, async (req, res) => {
        try {
            const { sql } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;
            const { buyer, description, totalAmount, dueDate, supplier_id, seasonId, invoiceNumber,
                paymentCondition, customerRuc, customerAddress, subtotalExenta, subtotalGravada5,
                subtotalGravada10, iva5, iva10, observation } = req.body;

            const rows = await db.execute(sql`
                UPDATE farm_accounts_receivable SET
                    buyer = COALESCE(${buyer ?? null}, buyer),
                    description = COALESCE(${description ?? null}, description),
                    total_amount = COALESCE(${totalAmount ?? null}, total_amount),
                    due_date = COALESCE(${dueDate ? new Date(dueDate) : null}, due_date),
                    supplier_id = COALESCE(${supplier_id ?? null}, supplier_id),
                    season_id = COALESCE(${seasonId ?? null}, season_id),
                    invoice_number = COALESCE(${invoiceNumber ?? null}, invoice_number),
                    payment_condition = COALESCE(${paymentCondition ?? null}, payment_condition),
                    customer_ruc = COALESCE(${customerRuc ?? null}, customer_ruc),
                    customer_address = COALESCE(${customerAddress ?? null}, customer_address),
                    subtotal_exenta = COALESCE(${subtotalExenta ?? null}, subtotal_exenta),
                    subtotal_gravada_5 = COALESCE(${subtotalGravada5 ?? null}, subtotal_gravada_5),
                    subtotal_gravada_10 = COALESCE(${subtotalGravada10 ?? null}, subtotal_gravada_10),
                    iva_5 = COALESCE(${iva5 ?? null}, iva_5),
                    iva_10 = COALESCE(${iva10 ?? null}, iva_10),
                    observation = COALESCE(${observation ?? null}, observation)
                WHERE id = ${req.params.id} AND farmer_id = ${farmerId}
                RETURNING *
            `);
            const updated = ((rows as any).rows ?? rows)[0];
            res.json(updated);
        } catch (error) {
            console.error("[ACCOUNTS_RECEIVABLE_UPDATE]", error);
            res.status(500).json({ error: "Failed to update account receivable" });
        }
    });

    // ============================================================================
    // INVOICE CONFIG (Timbrado / Fatura Pre-Impressa)
    // ============================================================================

    app.get("/api/farm/invoice-config", requireFarmer, async (req, res) => {
        try {
            const { farmInvoiceConfig } = await import("../shared/schema");
            const { eq } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            const [config] = await db.select().from(farmInvoiceConfig).where(eq(farmInvoiceConfig.farmerId, farmerId));
            res.json(config || null);
        } catch (error) {
            console.error("[INVOICE_CONFIG_GET]", error);
            res.status(500).json({ error: "Failed to get invoice config" });
        }
    });

    app.post("/api/farm/invoice-config", requireFarmer, async (req, res) => {
        try {
            const { farmInvoiceConfig } = await import("../shared/schema");
            const { eq } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            const [existing] = await db.select().from(farmInvoiceConfig).where(eq(farmInvoiceConfig.farmerId, farmerId));

            if (existing) {
                const { sql: sqlFn } = await import("drizzle-orm");
                await db.execute(sqlFn`
                    UPDATE farm_invoice_config SET
                        timbrado = ${req.body.timbrado || existing.timbrado},
                        timbrado_start_date = ${req.body.timbradoStartDate ? new Date(req.body.timbradoStartDate) : existing.timbradoStartDate},
                        timbrado_end_date = ${req.body.timbradoEndDate ? new Date(req.body.timbradoEndDate) : existing.timbradoEndDate},
                        establecimiento = ${req.body.establecimiento || existing.establecimiento},
                        punto_expedicion = ${req.body.puntoExpedicion || existing.puntoExpedicion},
                        ruc = ${req.body.ruc || existing.ruc},
                        razon_social = ${req.body.razonSocial || existing.razonSocial},
                        direccion = ${req.body.direccion || existing.direccion}
                    WHERE id = ${existing.id}
                `);
                const [updated] = await db.select().from(farmInvoiceConfig).where(eq(farmInvoiceConfig.id, existing.id));
                return res.json(updated);
            }

            const [created] = await db.insert(farmInvoiceConfig).values({
                farmerId,
                timbrado: req.body.timbrado,
                timbradoStartDate: req.body.timbradoStartDate ? new Date(req.body.timbradoStartDate) : null,
                timbradoEndDate: req.body.timbradoEndDate ? new Date(req.body.timbradoEndDate) : null,
                establecimiento: req.body.establecimiento || "001",
                puntoExpedicion: req.body.puntoExpedicion || "001",
                ruc: req.body.ruc,
                razonSocial: req.body.razonSocial,
                direccion: req.body.direccion,
            }).returning();
            res.json(created);
        } catch (error) {
            console.error("[INVOICE_CONFIG_CREATE]", error);
            res.status(500).json({ error: "Failed to save invoice config" });
        }
    });

    // Generate next sequential invoice number
    app.post("/api/farm/invoice-config/next", requireFarmer, async (req, res) => {
        try {
            const { farmInvoiceConfig } = await import("../shared/schema");
            const { eq } = await import("drizzle-orm");
            const { db } = await import("./db");
            const { sql: sqlFn } = await import("drizzle-orm");
            const farmerId = (req.user as any).id;

            const [config] = await db.select().from(farmInvoiceConfig).where(eq(farmInvoiceConfig.farmerId, farmerId));
            if (!config) return res.status(400).json({ error: "Configure o timbrado primeiro" });

            // Validate timbrado is within validity
            const now = new Date();
            if (config.timbradoEndDate && now > new Date(config.timbradoEndDate)) {
                return res.status(400).json({ error: "Timbrado vencido! Atualize o timbrado." });
            }

            // Increment sequence atomically
            const newSeq = (config.lastSequence || 0) + 1;
            await db.execute(sqlFn`UPDATE farm_invoice_config SET last_sequence = ${newSeq} WHERE id = ${config.id}`);

            const est = config.establecimiento || "001";
            const pto = config.puntoExpedicion || "001";
            const num = String(newSeq).padStart(7, "0");
            const fullNumber = `${est}-${pto}-${num}`;

            res.json({ invoiceNumber: fullNumber, sequence: newSeq, timbrado: config.timbrado });
        } catch (error) {
            console.error("[INVOICE_CONFIG_NEXT]", error);
            res.status(500).json({ error: "Failed to generate invoice number" });
        }
    });

    // Print data — returns all info needed to print on pre-printed invoice
    app.get("/api/farm/accounts-receivable/:id/print-data", requireFarmer, async (req, res) => {
        try {
            const { farmAccountsReceivable, farmReceivableItems, farmInvoiceConfig } = await import("../shared/schema");
            const { eq, and } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            const [ar] = await db.select().from(farmAccountsReceivable).where(
                and(eq(farmAccountsReceivable.id, req.params.id), eq(farmAccountsReceivable.farmerId, farmerId))
            );
            if (!ar) return res.status(404).json({ error: "Not found" });

            const items = await db.select().from(farmReceivableItems).where(eq(farmReceivableItems.receivableId, ar.id));
            const [config] = await db.select().from(farmInvoiceConfig).where(eq(farmInvoiceConfig.farmerId, farmerId));

            res.json({
                // Emissor
                emissor: config ? {
                    ruc: config.ruc,
                    razonSocial: config.razonSocial,
                    direccion: config.direccion,
                    timbrado: config.timbrado,
                    timbradoStart: config.timbradoStartDate,
                    timbradoEnd: config.timbradoEndDate,
                } : null,
                // Fatura
                invoiceNumber: ar.invoiceNumber,
                issueDate: ar.createdAt,
                paymentCondition: ar.paymentCondition,
                dueDate: ar.dueDate,
                // Cliente
                customer: {
                    name: ar.buyer,
                    ruc: ar.customerRuc,
                    address: ar.customerAddress,
                },
                // Itens
                items: items.map(i => ({
                    productName: i.productName,
                    unit: i.unit,
                    quantity: i.quantity,
                    unitPrice: i.unitPrice,
                    ivaRate: i.ivaRate,
                    totalPrice: i.totalPrice,
                })),
                // Totais
                subtotalExenta: ar.subtotalExenta,
                subtotalGravada5: ar.subtotalGravada5,
                subtotalGravada10: ar.subtotalGravada10,
                iva5: ar.iva5,
                iva10: ar.iva10,
                totalAmount: ar.totalAmount,
                currency: ar.currency,
            });
        } catch (error) {
            console.error("[AR_PRINT_DATA]", error);
            res.status(500).json({ error: "Failed to get print data" });
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
            const { db } = await import("./db");
            const { sql } = await import("drizzle-orm");
            const farmerId = (req.user as any).id;

            // Aggregate grain stock from confirmed romaneios minus sold quantities
            const rows = await db.execute(sql`
                SELECT
                    r.crop,
                    r.season_id AS "seasonId",
                    SUM(CAST(r.final_weight AS numeric)) AS "totalWeight",
                    COUNT(*) AS "deliveries",
                    MAX(r.delivery_date) AS "lastDelivery",
                    s.name AS "seasonName",
                    COALESCE((
                        SELECT SUM(CAST(ri.quantity AS numeric))
                        FROM farm_receivable_items ri
                        JOIN farm_accounts_receivable ar2 ON ar2.id = ri.receivable_id
                        WHERE ar2.farmer_id = ${farmerId}
                          AND ri.grain_crop = r.crop
                          AND (ri.grain_season_id = r.season_id OR (ri.grain_season_id IS NULL AND r.season_id IS NULL))
                    ), 0) AS "soldWeight"
                FROM farm_romaneios r
                LEFT JOIN farm_seasons s ON s.id = r.season_id
                WHERE r.farmer_id = ${farmerId}
                  AND r.status = 'confirmed'
                  AND CAST(r.final_weight AS numeric) > 0
                GROUP BY r.crop, r.season_id, s.name
                ORDER BY MAX(r.delivery_date) DESC
            `);
            const result = ((rows as any).rows ?? rows).map((r: any) => ({
                id: `${r.crop}-${r.seasonId || 'none'}`,
                crop: r.crop,
                seasonId: r.seasonId,
                seasonName: r.seasonName,
                quantity: String(Math.max(0, parseFloat(r.totalWeight) - parseFloat(r.soldWeight))),
                totalWeight: r.totalWeight,
                soldWeight: r.soldWeight,
                deliveries: parseInt(r.deliveries),
                lastDelivery: r.lastDelivery,
            }));
            res.json(result);
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
