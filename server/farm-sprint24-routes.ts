import { Express, Request, Response } from "express";
import { requireFarmer, parseLocalDate } from "./farm-middleware";
import { db } from "./db";
import { sql } from "drizzle-orm";

export function registerFarmSprint24Routes(app: Express) {

    // ═══════════════════════════════════════════════════════════════════════════
    // SPRINT 24-ITEMS: NEW ROUTES
    // ═══════════════════════════════════════════════════════════════════════════

    // ── #6: CRUD Fornecedores (Suppliers) ────────────────────────────────────
    app.get("/api/farm/suppliers", requireFarmer, async (req: Request, res: Response) => {
        try {
            const rows = await db.execute(sql`
                SELECT * FROM farm_suppliers WHERE farmer_id = ${req.user!.id} AND is_active = true ORDER BY name
            `);
            res.json((rows as any).rows ?? rows);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.post("/api/farm/suppliers", requireFarmer, async (req: Request, res: Response) => {
        try {
            const { name, ruc, phone, email, address, notes, personType, entityType } = req.body;
            // Validate RUC uniqueness
            if (ruc) {
                const existing = await db.execute(sql`
                    SELECT id FROM farm_suppliers WHERE farmer_id = ${req.user!.id} AND ruc = ${ruc} AND is_active = true LIMIT 1
                `);
                const existingRows = (existing as any).rows ?? existing;
                if (existingRows.length > 0) {
                    return res.status(409).json({ error: `Ja existe um fornecedor cadastrado com o RUC ${ruc}` });
                }
            }
            const rows = await db.execute(sql`
                INSERT INTO farm_suppliers (farmer_id, name, ruc, phone, email, address, notes, person_type, entity_type)
                VALUES (${req.user!.id}, ${name}, ${ruc ?? null}, ${phone ?? null}, ${email ?? null}, ${address ?? null}, ${notes ?? null}, ${personType ?? null}, ${entityType ?? null})
                RETURNING *
            `);
            res.json(((rows as any).rows ?? rows)[0]);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.put("/api/farm/suppliers/:id", requireFarmer, async (req: Request, res: Response) => {
        try {
            const { name, ruc, phone, email, address, notes, personType, entityType } = req.body;
            // Get old name before updating (for cascade)
            const oldRows = await db.execute(sql`
                SELECT name FROM farm_suppliers WHERE id=${req.params.id} AND farmer_id=${req.user!.id}
            `);
            const oldName = ((oldRows as any).rows ?? oldRows)[0]?.name;
            await db.execute(sql`
                UPDATE farm_suppliers SET name=${name}, ruc=${ruc ?? null}, phone=${phone ?? null},
                email=${email ?? null}, address=${address ?? null}, notes=${notes ?? null},
                person_type=${personType ?? null}, entity_type=${entityType ?? null}
                WHERE id=${req.params.id} AND farmer_id=${req.user!.id}
            `);
            // Cascade name change to accounts payable supplier field
            if (name && oldName && name !== oldName) {
                await db.execute(sql`
                    UPDATE farm_accounts_payable SET supplier=${name}
                    WHERE farmer_id=${req.user!.id} AND supplier=${oldName}
                `);
                await db.execute(sql`
                    UPDATE farm_invoices SET supplier=${name}
                    WHERE farmer_id=${req.user!.id} AND supplier=${oldName}
                `);
            }
            res.json({ ok: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.delete("/api/farm/suppliers/:id", requireFarmer, async (req: Request, res: Response) => {
        try {
            await db.execute(sql`
                UPDATE farm_suppliers SET is_active = false WHERE id=${req.params.id} AND farmer_id=${req.user!.id}
            `);
            res.json({ ok: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // ── Guarantors (Codeudor for Pagare) ─────────────────────────────────────
    app.get("/api/farm/guarantors", requireFarmer, async (req: Request, res: Response) => {
        try {
            const rows = await db.execute(sql`
                SELECT g.*, s.name as client_name FROM farm_guarantors g
                LEFT JOIN farm_suppliers s ON s.id = g.client_id
                WHERE g.farmer_id = ${req.user!.id} ORDER BY g.created_at DESC
            `);
            res.json((rows as any).rows ?? rows);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.post("/api/farm/guarantors", requireFarmer, async (req: Request, res: Response) => {
        try {
            const { clientId, guarantorName, guarantorRuc, guarantorPhone, guarantorAddress } = req.body;
            const rows = await db.execute(sql`
                INSERT INTO farm_guarantors (farmer_id, client_id, guarantor_name, guarantor_ruc, guarantor_phone, guarantor_address)
                VALUES (${req.user!.id}, ${clientId}, ${guarantorName}, ${guarantorRuc ?? null}, ${guarantorPhone ?? null}, ${guarantorAddress ?? null})
                RETURNING *
            `);
            res.json(((rows as any).rows ?? rows)[0]);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.delete("/api/farm/guarantors/:id", requireFarmer, async (req: Request, res: Response) => {
        try {
            await db.execute(sql`DELETE FROM farm_guarantors WHERE id = ${req.params.id} AND farmer_id = ${req.user!.id}`);
            res.json({ ok: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // ── Issued Invoices (Faturas Emitidas -> gera Conta a Receber) ─────────
    app.get("/api/farm/issued-invoices", requireFarmer, async (req: Request, res: Response) => {
        try {
            const rows = await db.execute(sql`
                SELECT i.*, s.name as client_name FROM farm_issued_invoices i
                LEFT JOIN farm_suppliers s ON s.id = i.client_id
                WHERE i.farmer_id = ${req.user!.id} ORDER BY i.created_at DESC
            `);
            res.json((rows as any).rows ?? rows);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.post("/api/farm/issued-invoices", requireFarmer, async (req: Request, res: Response) => {
        try {
            const { clientId, invoiceNumber, description, totalAmount, currency, issueDate, dueDate, notes, seasonId } = req.body;
            const farmerId = req.user!.id;

            // Create issued invoice
            const invRows = await db.execute(sql`
                INSERT INTO farm_issued_invoices (farmer_id, client_id, invoice_number, description, total_amount, currency, issue_date, due_date, notes, season_id)
                VALUES (${farmerId}, ${clientId ?? null}, ${invoiceNumber ?? null}, ${description ?? null}, ${totalAmount ?? '0'}, ${currency ?? 'USD'},
                    ${(parseLocalDate(issueDate) || new Date()).toISOString()}::timestamp,
                    ${parseLocalDate(dueDate)?.toISOString() ?? null}::timestamp,
                    ${notes ?? null}, ${seasonId ?? null})
                RETURNING *
            `);
            const inv = ((invRows as any).rows ?? invRows)[0];

            // Auto-create account receivable
            const { farmAccountsReceivable } = await import("../shared/schema");
            await db.insert(farmAccountsReceivable).values({
                farmerId,
                buyer: description || 'Fatura emitida',
                description: `Fatura #${invoiceNumber || inv.id} - ${description || ''}`,
                totalAmount: totalAmount || '0',
                currency: currency || 'USD',
                dueDate: parseLocalDate(dueDate) || new Date(),
                status: 'pendente',
                supplierId: clientId || null,
            });

            res.json(inv);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.delete("/api/farm/issued-invoices/:id", requireFarmer, async (req: Request, res: Response) => {
        try {
            await db.execute(sql`DELETE FROM farm_issued_invoices WHERE id = ${req.params.id} AND farmer_id = ${req.user!.id}`);
            res.json({ ok: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // ── #30: Produtividade por Talhao (enhanced) ──────────────────────────────
    app.get("/api/farm/productivity", requireFarmer, async (req: Request, res: Response) => {
        try {
            const farmerId = req.user!.id;
            const { seasonId, plotId } = req.query;

            let query = sql`
                SELECT
                    r.plot_id,
                    p.name as plot_name,
                    p2.name as property_name,
                    r.season_id,
                    s.name as season_name,
                    r.crop,
                    COUNT(r.id) as total_romaneios,
                    SUM(CAST(r.final_weight AS NUMERIC)) as total_production_kg,
                    SUM(CAST(r.final_weight AS NUMERIC)) / 1000.0 as total_production_ton
                FROM farm_romaneios r
                LEFT JOIN farm_plots p ON p.id = r.plot_id
                LEFT JOIN farm_properties p2 ON p2.id = p.property_id
                LEFT JOIN farm_seasons s ON s.id = r.season_id
                WHERE r.farmer_id = ${farmerId} AND r.plot_id IS NOT NULL
            `;

            if (seasonId && seasonId !== 'todos') {
                query = sql`${query} AND r.season_id = ${seasonId}`;
            }
            if (plotId && plotId !== 'todos') {
                query = sql`${query} AND r.plot_id = ${plotId}`;
            }

            query = sql`${query} GROUP BY r.plot_id, p.name, p2.name, r.season_id, s.name, r.crop ORDER BY total_production_kg DESC`;

            const rows = await db.execute(query);
            const data = (rows as any).rows ?? rows;

            // Also get costs per plot
            const costQuery = sql`
                SELECT
                    e.plot_id,
                    SUM(CAST(e.amount AS NUMERIC)) as total_cost
                FROM farm_expenses e
                WHERE e.farmer_id = ${farmerId} AND e.plot_id IS NOT NULL
                ${seasonId && seasonId !== 'todos' ? sql`AND e.season_id = ${seasonId}` : sql``}
                ${plotId && plotId !== 'todos' ? sql`AND e.plot_id = ${plotId}` : sql``}
                GROUP BY e.plot_id
            `;
            const costRows = await db.execute(costQuery);
            const costs = (costRows as any).rows ?? costRows;
            const costMap: Record<string, number> = {};
            for (const c of costs) { costMap[c.plot_id] = parseFloat(c.total_cost) || 0; }

            // Get plot areas
            const plotAreas = await db.execute(sql`
                SELECT id, area FROM farm_plots WHERE property_id IN (SELECT id FROM farm_properties WHERE farmer_id = ${farmerId})
            `);
            const areaMap: Record<string, number> = {};
            for (const pa of (plotAreas as any).rows ?? plotAreas) { areaMap[pa.id] = parseFloat(pa.area) || 1; }

            // Historical average
            const avgQuery = sql`
                SELECT r.plot_id, AVG(CAST(r.final_weight AS NUMERIC) / 1000.0) as avg_ton_per_romaneio,
                    COUNT(DISTINCT r.season_id) as seasons_count
                FROM farm_romaneios r
                WHERE r.farmer_id = ${farmerId} AND r.plot_id IS NOT NULL
                GROUP BY r.plot_id
            `;
            const avgRows = await db.execute(avgQuery);
            const avgMap: Record<string, any> = {};
            for (const a of (avgRows as any).rows ?? avgRows) { avgMap[a.plot_id] = a; }

            const result = data.map((d: any) => {
                const area = areaMap[d.plot_id] || 1;
                const totalTon = parseFloat(d.total_production_ton) || 0;
                const totalCost = costMap[d.plot_id] || 0;
                const avg = avgMap[d.plot_id];
                return {
                    ...d,
                    area_ha: area,
                    productivity_ton_ha: (totalTon / area).toFixed(2),
                    total_cost: totalCost.toFixed(2),
                    cost_per_ha: (totalCost / area).toFixed(2),
                    cost_per_ton: totalTon > 0 ? (totalCost / totalTon).toFixed(2) : "0.00",
                    margin: (totalTon * 350 - totalCost).toFixed(2),
                    avg_production_ton: avg ? parseFloat(avg.avg_ton_per_romaneio).toFixed(2) : "0.00",
                    seasons_count: avg?.seasons_count || 1,
                };
            });

            res.json(result);
        } catch (e: any) {
            console.error("[PRODUCTIVITY]", e);
            res.status(500).json({ error: e.message });
        }
    });

    // ── #5: DELETE + PUT Despesas (Expenses) ─────────────────────────────────
    app.delete("/api/farm/expenses/:id", requireFarmer, async (req: Request, res: Response) => {
        try {
            await db.execute(sql`DELETE FROM farm_expense_items WHERE expense_id = ${req.params.id}`);
            await db.execute(sql`DELETE FROM farm_expenses WHERE id = ${req.params.id} AND farmer_id = ${req.user!.id}`);
            res.json({ ok: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.put("/api/farm/expenses/:id", requireFarmer, async (req: Request, res: Response) => {
        try {
            const { category, supplier, description, amount, expenseDate, paymentType, dueDate, installments } = req.body;
            await db.execute(sql`
                UPDATE farm_expenses SET category=${category}, supplier=${supplier ?? null},
                description=${description ?? null}, amount=${amount}, expense_date=${parseLocalDate(expenseDate) || sql`now()`},
                payment_type=${paymentType ?? 'a_vista'}, due_date=${parseLocalDate(dueDate)},
                installments=${installments ?? 1}
                WHERE id=${req.params.id} AND farmer_id=${req.user!.id}
            `);
            res.json({ ok: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // ── #11: CRUD Cheques ────────────────────────────────────────────────────
    app.get("/api/farm/cheques", requireFarmer, async (req: Request, res: Response) => {
        try {
            const rows = await db.execute(sql`
                SELECT * FROM farm_cheques WHERE farmer_id = ${req.user!.id} ORDER BY created_at DESC
            `);
            res.json((rows as any).rows ?? rows);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.post("/api/farm/cheques", requireFarmer, async (req: Request, res: Response) => {
        try {
            const b = req.body;
            console.log("[CHEQUE_CREATE] body:", JSON.stringify(b));
            const safeAmount = String(b.amount || '0');
            const safeIssue = b.issueDate ? String(b.issueDate) : new Date().toISOString();
            const safeDue = b.dueDate ? String(b.dueDate) : null;
            const safeAccountId = b.accountId ? String(b.accountId) : null;
            const safeHolder = b.holder ? String(b.holder) : null;
            const safeOwnerType = b.ownerType ? String(b.ownerType) : null;
            const safeNotes = b.notes ? String(b.notes) : null;
            const safePayableId = b.relatedPayableId ? String(b.relatedPayableId) : null;
            const safeReceivableId = b.relatedReceivableId ? String(b.relatedReceivableId) : null;
            const farmerId = String(req.user!.id);
            const rows = await db.execute(sql`
                INSERT INTO farm_cheques (farmer_id, account_id, type, cheque_number, bank, holder, amount, currency,
                    issue_date, due_date, owner_type, notes, related_payable_id, related_receivable_id)
                VALUES (${farmerId}, ${safeAccountId}, ${String(b.type || 'recebido')}, ${String(b.chequeNumber || '')},
                    ${String(b.bank || '')}, ${safeHolder},
                    ${safeAmount}, ${String(b.currency || 'USD')}, ${safeIssue}::timestamp, ${safeDue}::timestamp,
                    ${safeOwnerType}, ${safeNotes},
                    ${safePayableId}, ${safeReceivableId})
                RETURNING *
            `);
            res.json(((rows as any).rows ?? rows)[0]);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // #11: Compensar cheque
    app.post("/api/farm/cheques/:id/compensate", requireFarmer, async (req: Request, res: Response) => {
        try {
            const { accountId } = req.body;
            const chequeRows = await db.execute(sql`
                SELECT * FROM farm_cheques WHERE id = ${req.params.id} AND farmer_id = ${req.user!.id}
            `);
            const cheque = ((chequeRows as any).rows ?? chequeRows)[0];
            if (!cheque) return res.status(404).json({ error: "Cheque not found" });

            const nowStr = new Date().toISOString();
            const targetAccountId = accountId ? String(accountId) : (cheque.account_id ? String(cheque.account_id) : null);
            if (!targetAccountId) return res.status(400).json({ error: "Conta nao informada" });
            const chequeId = String(req.params.id);
            const farmerId = String(req.user!.id);
            // Update cheque status
            await db.execute(sql`
                UPDATE farm_cheques SET status = 'compensado', compensation_date = ${nowStr}::timestamp
                WHERE id = ${chequeId}
            `);

            // Create cash transaction
            const txType = cheque.type === 'emitido' ? 'saida' : 'entrada';
            const chequeDesc = 'Cheque #' + String(cheque.cheque_number || '') + ' - ' + String(cheque.bank || '');
            const chequeAmount = String(cheque.amount);
            const chequeCurrency = String(cheque.currency || 'USD');
            const txRows = await db.execute(sql`
                INSERT INTO farm_cash_transactions (farmer_id, account_id, type, amount, currency, category, description,
                    payment_method, cheque_id, reference_type, transaction_date)
                VALUES (${farmerId}, ${targetAccountId}, ${txType}, ${chequeAmount}, ${chequeCurrency},
                    'cheque', ${chequeDesc}, 'cheque',
                    ${String(cheque.id)}, 'cheque', ${nowStr}::timestamp)
                RETURNING id
            `);
            const txId = ((txRows as any).rows ?? txRows)[0]?.id;

            // Update account balance
            if (txType === 'entrada') {
                await db.execute(sql`UPDATE farm_cash_accounts SET current_balance = current_balance + ${chequeAmount}::numeric WHERE id = ${targetAccountId}`);
            } else {
                await db.execute(sql`UPDATE farm_cash_accounts SET current_balance = current_balance - ${chequeAmount}::numeric WHERE id = ${targetAccountId}`);
            }

            await db.execute(sql`UPDATE farm_cheques SET cash_transaction_id = ${String(txId)} WHERE id = ${chequeId}`);
            res.json({ ok: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.put("/api/farm/cheques/:id/cancel", requireFarmer, async (req: Request, res: Response) => {
        try {
            await db.execute(sql`
                UPDATE farm_cheques SET status = 'cancelado' WHERE id = ${req.params.id} AND farmer_id = ${req.user!.id}
            `);
            res.json({ ok: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // ── #15: Receipts (Recibos) ──────────────────────────────────────────────
    app.get("/api/farm/receipts", requireFarmer, async (req: Request, res: Response) => {
        try {
            const rows = await db.execute(sql`
                SELECT * FROM farm_receipts WHERE farmer_id = ${req.user!.id} ORDER BY created_at DESC
            `);
            res.json((rows as any).rows ?? rows);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.post("/api/farm/receipts", requireFarmer, async (req: Request, res: Response) => {
        try {
            const { type, entity, totalAmount, currency, paymentType, paymentMethods, invoiceRefs, notes } = req.body;
            // Generate receipt number
            const countRows = await db.execute(sql`
                SELECT COUNT(*)::int as cnt FROM farm_receipts WHERE farmer_id = ${req.user!.id}
            `);
            const count = ((countRows as any).rows ?? countRows)[0]?.cnt ?? 0;
            const receiptNumber = String(count + 1).padStart(6, '0');

            const rows = await db.execute(sql`
                INSERT INTO farm_receipts (farmer_id, receipt_number, type, entity, total_amount, currency,
                    payment_type, payment_methods, invoice_refs, notes)
                VALUES (${req.user!.id}, ${receiptNumber}, ${type}, ${entity}, ${totalAmount}, ${currency ?? 'USD'},
                    ${paymentType ?? 'total'}, ${JSON.stringify(paymentMethods ?? [])}, ${JSON.stringify(invoiceRefs ?? [])},
                    ${notes ?? null})
                RETURNING *
            `);
            res.json(((rows as any).rows ?? rows)[0]);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // ── #21: Transfer between accounts with exchange rate ────────────────────
    app.post("/api/farm/cash-flow/transfer", requireFarmer, async (req: Request, res: Response) => {
        try {
            const { sourceAccountId, destAccountId, fromAccountId, toAccountId, amount, exchangeRate, description } = req.body;
            const srcId = sourceAccountId || fromAccountId;
            const dstId = destAccountId || toAccountId;
            const nowISO = (parseLocalDate(req.body.transferDate) || new Date()).toISOString();

            // Get source account info
            const srcRows = await db.execute(sql`SELECT * FROM farm_cash_accounts WHERE id = ${srcId} AND farmer_id = ${req.user!.id}`);
            const src = ((srcRows as any).rows ?? srcRows)[0];
            const dstRows = await db.execute(sql`SELECT * FROM farm_cash_accounts WHERE id = ${dstId} AND farmer_id = ${req.user!.id}`);
            const dst = ((dstRows as any).rows ?? dstRows)[0];
            if (!src || !dst) return res.status(404).json({ error: "Account not found" });

            const convertedAmount = exchangeRate ? (parseFloat(amount) * parseFloat(exchangeRate)).toFixed(2) : amount;
            const descText = description || `Transferencia ${src.currency} -> ${dst.currency} (cambio: ${exchangeRate || '1'})`;

            // Debit source
            await db.execute(sql`
                INSERT INTO farm_cash_transactions (farmer_id, account_id, type, amount, currency, category, description, payment_method, reference_type, transaction_date)
                VALUES (${req.user!.id}, ${srcId}, 'saida', ${amount}, ${src.currency}, 'transferencia', ${descText}, 'transferencia', 'transfer', ${nowISO}::timestamp)
            `);
            await db.execute(sql`UPDATE farm_cash_accounts SET current_balance = current_balance - ${amount} WHERE id = ${srcId}`);

            // Credit destination
            await db.execute(sql`
                INSERT INTO farm_cash_transactions (farmer_id, account_id, type, amount, currency, category, description, payment_method, reference_type, transaction_date)
                VALUES (${req.user!.id}, ${dstId}, 'entrada', ${convertedAmount}, ${dst.currency}, 'transferencia', ${descText}, 'transferencia', 'transfer', ${nowISO}::timestamp)
            `);
            await db.execute(sql`UPDATE farm_cash_accounts SET current_balance = current_balance + ${convertedAmount} WHERE id = ${dstId}`);

            res.json({ ok: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // ── #24: Remissions (Remissoes) ──────────────────────────────────────────
    app.get("/api/farm/remissions", requireFarmer, async (req: Request, res: Response) => {
        try {
            const rows = await db.execute(sql`
                SELECT r.*, json_agg(json_build_object('id', ri.id, 'productName', ri.product_name, 'quantity', ri.quantity, 'unit', ri.unit))
                    FILTER (WHERE ri.id IS NOT NULL) as items
                FROM farm_remissions r
                LEFT JOIN farm_remission_items ri ON ri.remission_id = r.id
                WHERE r.farmer_id = ${req.user!.id}
                GROUP BY r.id
                ORDER BY r.created_at DESC
            `);
            res.json((rows as any).rows ?? rows);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.post("/api/farm/remissions", requireFarmer, async (req: Request, res: Response) => {
        try {
            const { supplier, ruc, remissionNumber, issueDate, notes, items } = req.body;
            const remRows = await db.execute(sql`
                INSERT INTO farm_remissions (farmer_id, supplier, ruc, remission_number, issue_date, notes)
                VALUES (${req.user!.id}, ${supplier}, ${ruc ?? null}, ${remissionNumber ?? null},
                    ${issueDate ? new Date(issueDate) : null}, ${notes ?? null})
                RETURNING *
            `);
            const rem = ((remRows as any).rows ?? remRows)[0];

            // Insert items and create stock movements (entrada sem preco)
            if (items && Array.isArray(items)) {
                for (const item of items) {
                    await db.execute(sql`
                        INSERT INTO farm_remission_items (remission_id, product_id, product_name, quantity, unit)
                        VALUES (${rem.id}, ${item.productId ?? null}, ${item.productName}, ${item.quantity}, ${item.unit ?? null})
                    `);
                    // Enter stock with zero cost (will be corrected when invoice arrives)
                    if (item.productId) {
                        await db.execute(sql`
                            INSERT INTO farm_stock_movements (farmer_id, product_id, type, quantity, unit_cost, reference_type, reference_id, notes)
                            VALUES (${req.user!.id}, ${item.productId}, 'entrada', ${item.quantity}, 0, 'remission', ${rem.id},
                                ${'Remissao #' + (remissionNumber || rem.id)})
                        `);
                        await db.execute(sql`
                            INSERT INTO farm_stock (farmer_id, product_id, quantity, average_cost, updated_at)
                            VALUES (${req.user!.id}, ${item.productId}, ${item.quantity}, 0, now())
                            ON CONFLICT (farmer_id, product_id) DO UPDATE SET
                                quantity = farm_stock.quantity + ${item.quantity},
                                updated_at = now()
                        `);
                    }
                }
            }
            res.json(rem);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // #24: Check remission match before importing invoice
    app.post("/api/farm/remissions/check-match", requireFarmer, async (req: Request, res: Response) => {
        try {
            const { supplier, items } = req.body; // items: [{productName, quantity}]
            const remRows = await db.execute(sql`
                SELECT r.*, json_agg(json_build_object('productName', ri.product_name, 'quantity', ri.quantity)) as items
                FROM farm_remissions r
                JOIN farm_remission_items ri ON ri.remission_id = r.id
                WHERE r.farmer_id = ${req.user!.id} AND r.status = 'pendente'
                GROUP BY r.id
            `);
            const remissions = (remRows as any).rows ?? remRows;

            // Try to find a matching remission by supplier name and product overlap
            for (const rem of remissions) {
                const supplierMatch = rem.supplier.toLowerCase().includes(supplier?.toLowerCase() || '') ||
                    supplier?.toLowerCase().includes(rem.supplier.toLowerCase());
                if (!supplierMatch) continue;

                const remItems = Array.isArray(rem.items) ? rem.items : [];
                let matchCount = 0;
                for (const invoiceItem of (items || [])) {
                    const found = remItems.find((ri: any) =>
                        ri.productName?.toLowerCase().includes(invoiceItem.productName?.toLowerCase()) ||
                        invoiceItem.productName?.toLowerCase().includes(ri.productName?.toLowerCase())
                    );
                    if (found) matchCount++;
                }
                if (matchCount > 0 && matchCount >= Math.min(remItems.length, (items || []).length) * 0.5) {
                    return res.json({ match: true, remission: rem });
                }
            }
            res.json({ match: false });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // #24: Reconcile remission with invoice and update prices
    app.post("/api/farm/remissions/:id/reconcile", requireFarmer, async (req: Request, res: Response) => {
        try {
            const { invoiceId, items } = req.body; // items: [{productId, unitPrice}]

            // Mark remission as reconciled
            await db.execute(sql`
                UPDATE farm_remissions SET status = 'conciliada', reconciled_invoice_id = ${invoiceId}
                WHERE id = ${req.params.id} AND farmer_id = ${req.user!.id}
            `);

            // Update prices on stock movements that were entered with zero cost from this remission
            if (items && Array.isArray(items)) {
                for (const item of items) {
                    if (item.productId && item.unitPrice) {
                        // Update the remission stock movement with the real price
                        await db.execute(sql`
                            UPDATE farm_stock_movements SET unit_cost = ${item.unitPrice}
                            WHERE reference_type = 'remission' AND reference_id = ${req.params.id}
                            AND product_id = ${item.productId}
                        `);

                        // Recalculate average cost in farm_stock
                        const avgRows = await db.execute(sql`
                            SELECT COALESCE(SUM(quantity * unit_cost) / NULLIF(SUM(quantity), 0), 0) as avg_cost
                            FROM farm_stock_movements
                            WHERE farmer_id = ${req.user!.id} AND product_id = ${item.productId} AND type = 'entrada'
                        `);
                        const avgCost = ((avgRows as any).rows ?? avgRows)[0]?.avg_cost ?? 0;
                        await db.execute(sql`
                            UPDATE farm_stock SET average_cost = ${avgCost}, updated_at = now()
                            WHERE farmer_id = ${req.user!.id} AND product_id = ${item.productId}
                        `);

                        // Update plot costs where this product was applied with zero cost
                        // Find applications that used this product and recalculate
                        await db.execute(sql`
                            UPDATE farm_stock_movements SET unit_cost = ${item.unitPrice}
                            WHERE farmer_id = ${req.user!.id} AND product_id = ${item.productId}
                            AND type = 'saida' AND (unit_cost IS NULL OR unit_cost = 0)
                        `);
                    }
                }
            }
            res.json({ ok: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // ── #7: Stock Warehouses (Depositos) ─────────────────────────────────────
    app.get("/api/farm/warehouses", requireFarmer, async (req: Request, res: Response) => {
        try {
            const rows = await db.execute(sql`
                SELECT DISTINCT ON (s.id) s.*, p.name as property_name
                FROM farm_properties s
                WHERE s.farmer_id = ${req.user!.id}
                ORDER BY s.id, s.name
            `);
            res.json((rows as any).rows ?? rows);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    // ── #1: Backup endpoint (triggers pg_dump) ──────────────────────────────
    app.post("/api/farm/backup", requireFarmer, async (req: Request, res: Response) => {
        try {
            const dbUrl = process.env.DATABASE_URL;
            if (!dbUrl) return res.status(500).json({ error: "No DATABASE_URL configured" });

            const { execSync } = await import("child_process");
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `/tmp/backup-${timestamp}.sql`;

            try {
                execSync(`pg_dump "${dbUrl}" > ${filename}`, { timeout: 60000 });
                res.download(filename, `agrofarm-backup-${timestamp}.sql`);
            } catch {
                // pg_dump may not be available on Railway — fallback to JSON export
                const tables = ['farm_suppliers', 'farm_cheques', 'farm_receipts', 'farm_remissions',
                    'farm_cash_accounts', 'farm_cash_transactions', 'farm_expenses', 'farm_invoices',
                    'farm_accounts_payable', 'farm_accounts_receivable', 'farm_stock', 'farm_stock_movements'];
                const backup: any = {};
                for (const t of tables) {
                    try {
                        const r = await db.execute(sql.raw(`SELECT * FROM ${t} WHERE farmer_id = '${req.user!.id}'`));
                        backup[t] = (r as any).rows ?? r;
                    } catch { backup[t] = []; }
                }
                res.json(backup);
            }
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    });
}
