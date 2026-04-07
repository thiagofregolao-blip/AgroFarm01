import type { Express } from "express";
import { requireFarmer, getEffectiveFarmerId } from "./farm-middleware";

export function registerFarmCreditNoteRoutes(app: Express) {

    // ── Available invoices for linking ───────────────────────────────────────
    // NOTE: specific routes BEFORE /:id to avoid Express param conflicts

    app.get("/api/farm/credit-notes/invoices/available", requireFarmer, async (req, res) => {
        try {
            const { sql } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = await getEffectiveFarmerId(req);
            if (!farmerId) return res.status(403).json({ error: "Forbidden" });

            const invoiceType = (req.query.invoiceType as string) || "payable";
            const supplierId = (req.query.supplierId as string) || null;

            if (invoiceType === "payable") {
                const result = await db.execute(sql`
                    SELECT
                        ap.id,
                        ap.supplier,
                        ap.description,
                        CAST(ap.total_amount AS NUMERIC) AS "totalAmount",
                        CAST(COALESCE(ap.paid_amount, 0) AS NUMERIC) AS "paidAmount",
                        (CAST(ap.total_amount AS NUMERIC) - CAST(COALESCE(ap.paid_amount, 0) AS NUMERIC)) AS "remainingAmount",
                        ap.due_date AS "dueDate",
                        ap.status,
                        ap.invoice_id AS "invoiceId",
                        fi.invoice_number AS "invoiceNumber"
                    FROM farm_accounts_payable ap
                    LEFT JOIN farm_invoices fi ON fi.id = ap.invoice_id
                    WHERE ap.farmer_id = ${farmerId}
                      AND ap.status IN ('aberto', 'parcial')
                      AND (CAST(ap.total_amount AS NUMERIC) - CAST(COALESCE(ap.paid_amount, 0) AS NUMERIC)) > 0
                      AND (
                        ${supplierId}::text IS NULL
                        OR ap.supplier_id = ${supplierId}
                        OR (
                          ap.supplier_id IS NULL
                          AND LOWER(TRIM(ap.supplier)) = (
                            SELECT LOWER(TRIM(name)) FROM farm_suppliers
                            WHERE id = ${supplierId} AND farmer_id = ${farmerId}
                            LIMIT 1
                          )
                        )
                      )
                    ORDER BY ap.due_date ASC
                `);
                const rows = (result as any).rows || result;
                // Backfill supplier_id nos registros que foram encontrados só pelo nome
                if (supplierId && rows.length > 0) {
                    await db.execute(sql`
                        UPDATE farm_accounts_payable
                        SET supplier_id = ${supplierId}
                        WHERE farmer_id = ${farmerId}
                          AND supplier_id IS NULL
                          AND LOWER(TRIM(supplier)) = (
                            SELECT LOWER(TRIM(name)) FROM farm_suppliers
                            WHERE id = ${supplierId} AND farmer_id = ${farmerId}
                            LIMIT 1
                          )
                    `);
                }
                res.json(rows);
            } else {
                const result = await db.execute(sql`
                    SELECT
                        ar.id,
                        ar.buyer AS supplier,
                        ar.description,
                        CAST(ar.total_amount AS NUMERIC) AS "totalAmount",
                        CAST(COALESCE(ar.received_amount, 0) AS NUMERIC) AS "paidAmount",
                        (CAST(ar.total_amount AS NUMERIC) - CAST(COALESCE(ar.received_amount, 0) AS NUMERIC)) AS "remainingAmount",
                        ar.due_date AS "dueDate",
                        ar.status,
                        ar.invoice_number AS "invoiceNumber"
                    FROM farm_accounts_receivable ar
                    WHERE ar.farmer_id = ${farmerId}
                      AND ar.status IN ('pendente', 'parcial')
                      AND (CAST(ar.total_amount AS NUMERIC) - CAST(COALESCE(ar.received_amount, 0) AS NUMERIC)) > 0
                    ORDER BY ar.due_date ASC
                `);
                res.json((result as any).rows || result);
            }
        } catch (err) {
            console.error("[CN_INVOICES_AVAILABLE]", err);
            res.status(500).json({ error: "Erro ao buscar faturas disponíveis" });
        }
    });

    // ── Invoice items for return credit notes (from AP → invoice items) ───────
    app.get("/api/farm/credit-notes/invoice-items/:apId", requireFarmer, async (req, res) => {
        try {
            const { sql } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = await getEffectiveFarmerId(req);
            if (!farmerId) return res.status(403).json({ error: "Forbidden" });

            const ap = ((await db.execute(sql`
                SELECT invoice_id FROM farm_accounts_payable WHERE id = ${req.params.apId} AND farmer_id = ${farmerId}
            `)) as any).rows?.[0];

            if (!ap?.invoice_id) return res.json([]);

            const result = await db.execute(sql`
                SELECT
                    ii.id,
                    ii.product_id AS "productId",
                    ii.product_name AS "productName",
                    ii.unit,
                    CAST(ii.quantity AS NUMERIC) AS quantity,
                    CAST(ii.unit_price AS NUMERIC) AS "unitPrice",
                    CAST(ii.total_price AS NUMERIC) AS "totalPrice"
                FROM farm_invoice_items ii
                WHERE ii.invoice_id = ${ap.invoice_id}
                ORDER BY ii.id
            `);
            res.json((result as any).rows || result);
        } catch (err) {
            console.error("[CN_INVOICE_ITEMS]", err);
            res.status(500).json({ error: "Erro ao buscar itens da fatura" });
        }
    });

    // ── AR items for return credit notes (emission) ───────────────────────────
    app.get("/api/farm/credit-notes/receivable-items/:arId", requireFarmer, async (req, res) => {
        try {
            const { sql } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = await getEffectiveFarmerId(req);
            if (!farmerId) return res.status(403).json({ error: "Forbidden" });

            const result = await db.execute(sql`
                SELECT
                    ri.id,
                    ri.product_id AS "productId",
                    ri.product_name AS "productName",
                    ri.unit,
                    CAST(ri.quantity AS NUMERIC) AS quantity,
                    CAST(ri.unit_price AS NUMERIC) AS "unitPrice",
                    CAST(ri.total_price AS NUMERIC) AS "totalPrice"
                FROM farm_receivable_items ri
                JOIN farm_accounts_receivable ar ON ar.id = ri.receivable_id
                WHERE ri.receivable_id = ${req.params.arId} AND ar.farmer_id = ${farmerId}
                ORDER BY ri.id
            `);
            res.json((result as any).rows || result);
        } catch (err) {
            console.error("[CN_RECEIVABLE_ITEMS]", err);
            res.status(500).json({ error: "Erro ao buscar itens" });
        }
    });

    // ── List credit notes ────────────────────────────────────────────────────
    app.get("/api/farm/credit-notes", requireFarmer, async (req, res) => {
        try {
            const { sql } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = await getEffectiveFarmerId(req);
            if (!farmerId) return res.status(403).json({ error: "Forbidden" });

            const type = (req.query.type as string) || "provider";

            const result = await db.execute(sql`
                SELECT
                    cn.id,
                    cn.type,
                    cn.note_type AS "noteType",
                    cn.supplier,
                    cn.supplier_id AS "supplierId",
                    cn.client,
                    cn.timbrado,
                    cn.note_number AS "noteNumber",
                    cn.issue_date AS "issueDate",
                    CAST(cn.total_amount AS NUMERIC) AS "totalAmount",
                    CAST(COALESCE(cn.total_exenta, 0) AS NUMERIC) AS "totalExenta",
                    CAST(COALESCE(cn.total_iva5, 0) AS NUMERIC) AS "totalIva5",
                    CAST(COALESCE(cn.total_iva10, 0) AS NUMERIC) AS "totalIva10",
                    cn.status,
                    cn.currency,
                    cn.notes,
                    cn.created_at AS "createdAt"
                FROM farm_credit_notes cn
                WHERE cn.farmer_id = ${farmerId} AND cn.type = ${type}
                ORDER BY cn.created_at DESC
            `);
            res.json((result as any).rows || result);
        } catch (err) {
            console.error("[CN_LIST]", err);
            res.status(500).json({ error: "Erro ao listar notas de crédito" });
        }
    });

    // ── Detail ───────────────────────────────────────────────────────────────
    app.get("/api/farm/credit-notes/:id", requireFarmer, async (req, res) => {
        try {
            const { sql } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = await getEffectiveFarmerId(req);
            if (!farmerId) return res.status(403).json({ error: "Forbidden" });

            const cn = ((await db.execute(sql`
                SELECT * FROM farm_credit_notes WHERE id = ${req.params.id} AND farmer_id = ${farmerId}
            `)) as any).rows?.[0];
            if (!cn) return res.status(404).json({ error: "Não encontrada" });

            const items = ((await db.execute(sql`
                SELECT * FROM farm_credit_note_items WHERE credit_note_id = ${req.params.id} ORDER BY created_at
            `)) as any).rows || [];

            const invoices = ((await db.execute(sql`
                SELECT * FROM farm_credit_note_invoices WHERE credit_note_id = ${req.params.id}
            `)) as any).rows || [];

            res.json({ ...cn, items, invoices });
        } catch (err) {
            console.error("[CN_DETAIL]", err);
            res.status(500).json({ error: "Erro ao buscar nota de crédito" });
        }
    });

    // ── Create ───────────────────────────────────────────────────────────────
    app.post("/api/farm/credit-notes", requireFarmer, async (req, res) => {
        try {
            const { sql } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = await getEffectiveFarmerId(req);
            if (!farmerId) return res.status(403).json({ error: "Forbidden" });

            const {
                type, noteType, supplier, supplierId, client,
                timbrado, noteNumber, issueDate,
                items, invoices,
                currency = "USD", notes,
            } = req.body;

            if (!type || !noteType || !timbrado || !noteNumber || !issueDate) {
                return res.status(400).json({ error: "Campos obrigatórios: tipo, timbrado, número, data" });
            }
            if (!items?.length) return res.status(400).json({ error: "Informe ao menos um item" });
            if (!invoices?.length) return res.status(400).json({ error: "Vincule ao menos uma fatura" });

            // Uniqueness check
            if (type === "emission") {
                const dup = ((await db.execute(sql`
                    SELECT id FROM farm_credit_notes
                    WHERE farmer_id = ${farmerId} AND type = 'emission'
                      AND timbrado = ${timbrado} AND note_number = ${noteNumber}
                      AND status != 'annulled'
                `)) as any).rows || [];
                if (dup.length > 0) {
                    return res.status(409).json({ error: "Já existe uma nota emitida com este timbrado e número" });
                }
            } else if (supplierId) {
                const dup = ((await db.execute(sql`
                    SELECT id FROM farm_credit_notes
                    WHERE farmer_id = ${farmerId} AND type = 'provider'
                      AND supplier_id = ${supplierId} AND timbrado = ${timbrado} AND note_number = ${noteNumber}
                      AND status != 'annulled'
                `)) as any).rows || [];
                if (dup.length > 0) {
                    return res.status(409).json({ error: "Já existe uma nota deste provedor com este timbrado e número" });
                }
            }

            // Compute totals
            let totalExenta = 0, totalIva5 = 0, totalIva10 = 0;
            for (const item of items) {
                const sub = parseFloat(item.subtotal) || 0;
                if (item.taxRegime === "exenta") totalExenta += sub;
                else if (item.taxRegime === "iva5") totalIva5 += sub;
                else if (item.taxRegime === "iva10") totalIva10 += sub;
            }
            const totalAmount = totalExenta + totalIva5 + totalIva10;

            // Validate allocated vs total
            const totalAllocated = invoices.reduce((s: number, inv: any) => s + (parseFloat(inv.allocatedAmount) || 0), 0);
            if (Math.abs(totalAllocated - totalAmount) > 0.02) {
                return res.status(400).json({ error: `O total alocado (${totalAllocated.toFixed(2)}) deve ser igual ao valor da nota (${totalAmount.toFixed(2)})` });
            }

            // Validate each invoice remaining balance
            for (const inv of invoices) {
                const allocated = parseFloat(inv.allocatedAmount) || 0;
                const itype = inv.invoiceType as string;
                if (itype === "payable") {
                    const ap = ((await db.execute(sql`
                        SELECT CAST(total_amount AS NUMERIC) AS ta, CAST(COALESCE(paid_amount,0) AS NUMERIC) AS pa
                        FROM farm_accounts_payable WHERE id = ${inv.invoiceId} AND farmer_id = ${farmerId}
                    `)) as any).rows?.[0];
                    if (!ap) return res.status(400).json({ error: `Conta a pagar não encontrada: ${inv.invoiceId}` });
                    const remaining = parseFloat(ap.ta) - parseFloat(ap.pa);
                    if (allocated > remaining + 0.02) {
                        return res.status(400).json({ error: `Valor alocado (${allocated}) excede o saldo (${remaining.toFixed(2)})` });
                    }
                } else {
                    const ar = ((await db.execute(sql`
                        SELECT CAST(total_amount AS NUMERIC) AS ta, CAST(COALESCE(received_amount,0) AS NUMERIC) AS ra
                        FROM farm_accounts_receivable WHERE id = ${inv.invoiceId} AND farmer_id = ${farmerId}
                    `)) as any).rows?.[0];
                    if (!ar) return res.status(400).json({ error: `Conta a receber não encontrada: ${inv.invoiceId}` });
                    const remaining = parseFloat(ar.ta) - parseFloat(ar.ra);
                    if (allocated > remaining + 0.02) {
                        return res.status(400).json({ error: `Valor alocado (${allocated}) excede o saldo (${remaining.toFixed(2)})` });
                    }
                }
            }

            // Insert credit note
            const cnResult = await db.execute(sql`
                INSERT INTO farm_credit_notes
                    (farmer_id, type, note_type, supplier, supplier_id, client,
                     timbrado, note_number, issue_date,
                     total_amount, total_exenta, total_iva5, total_iva10,
                     currency, notes)
                VALUES
                    (${farmerId}, ${type}, ${noteType}, ${supplier || null}, ${supplierId || null}, ${client || null},
                     ${timbrado}, ${noteNumber}, ${issueDate}::timestamp,
                     ${String(totalAmount)}, ${String(totalExenta)}, ${String(totalIva5)}, ${String(totalIva10)},
                     ${currency}, ${notes || null})
                RETURNING id
            `);
            const cnId = ((cnResult as any).rows?.[0] || (cnResult as any)[0])?.id;

            // Insert items
            for (const item of items) {
                await db.execute(sql`
                    INSERT INTO farm_credit_note_items
                        (credit_note_id, product_id, description, quantity, unit_price, tax_regime, subtotal)
                    VALUES
                        (${cnId}, ${item.productId || null}, ${item.description},
                         ${String(item.quantity || 0)}, ${String(item.unitPrice || 0)},
                         ${item.taxRegime}, ${String(item.subtotal || 0)})
                `);
            }

            // Insert invoice links + update AP/AR
            for (const inv of invoices) {
                const allocated = parseFloat(inv.allocatedAmount) || 0;
                const itype = inv.invoiceType as string;

                await db.execute(sql`
                    INSERT INTO farm_credit_note_invoices (credit_note_id, invoice_id, invoice_type, allocated_amount)
                    VALUES (${cnId}, ${inv.invoiceId}, ${itype}, ${String(allocated)})
                `);

                if (itype === "payable") {
                    await db.execute(sql`
                        UPDATE farm_accounts_payable SET
                            paid_amount = CAST(COALESCE(paid_amount,0) AS NUMERIC) + ${allocated},
                            status = CASE
                                WHEN (CAST(COALESCE(paid_amount,0) AS NUMERIC) + ${allocated}) >= CAST(total_amount AS NUMERIC) THEN 'pago'
                                WHEN (CAST(COALESCE(paid_amount,0) AS NUMERIC) + ${allocated}) > 0 THEN 'parcial'
                                ELSE status
                            END
                        WHERE id = ${inv.invoiceId} AND farmer_id = ${farmerId}
                    `);
                } else {
                    await db.execute(sql`
                        UPDATE farm_accounts_receivable SET
                            received_amount = CAST(COALESCE(received_amount,0) AS NUMERIC) + ${allocated},
                            status = CASE
                                WHEN (CAST(COALESCE(received_amount,0) AS NUMERIC) + ${allocated}) >= CAST(total_amount AS NUMERIC) THEN 'recebido'
                                WHEN (CAST(COALESCE(received_amount,0) AS NUMERIC) + ${allocated}) > 0 THEN 'parcial'
                                ELSE status
                            END
                        WHERE id = ${inv.invoiceId} AND farmer_id = ${farmerId}
                    `);
                }
            }

            // Stock movements for return type
            if (noteType === "return") {
                for (const item of items) {
                    if (!item.productId) continue;
                    const qty = parseFloat(item.quantity) || 0;
                    if (qty <= 0) continue;
                    const unitCost = String(item.unitPrice || 0);

                    if (type === "provider") {
                        // Return to supplier → EXIT stock
                        await db.execute(sql`
                            UPDATE farm_stock
                            SET quantity = GREATEST(0, CAST(quantity AS NUMERIC) - ${qty}), updated_at = now()
                            WHERE farmer_id = ${farmerId} AND product_id = ${item.productId}
                        `);
                        await db.execute(sql`
                            INSERT INTO farm_stock_movements
                                (farmer_id, product_id, type, quantity, unit_cost, reference_type, reference_id, notes)
                            VALUES
                                (${farmerId}, ${item.productId}, 'exit', ${String(-qty)}, ${unitCost},
                                 'nota_credito_provedor', ${cnId}, 'Devolução ao provedor — NC ${noteNumber}')
                        `);
                    } else {
                        // Return from client → ENTRY stock
                        await db.execute(sql`
                            UPDATE farm_stock
                            SET quantity = CAST(quantity AS NUMERIC) + ${qty}, updated_at = now()
                            WHERE farmer_id = ${farmerId} AND product_id = ${item.productId}
                        `);
                        await db.execute(sql`
                            INSERT INTO farm_stock_movements
                                (farmer_id, product_id, type, quantity, unit_cost, reference_type, reference_id, notes)
                            VALUES
                                (${farmerId}, ${item.productId}, 'entry', ${String(qty)}, ${unitCost},
                                 'nota_credito_emissao', ${cnId}, 'Devolução do cliente — NC ${noteNumber}')
                        `);
                    }
                }
            }

            res.status(201).json({ id: cnId, totalAmount });
        } catch (err) {
            console.error("[CN_CREATE]", err);
            res.status(500).json({ error: "Erro ao criar nota de crédito" });
        }
    });

    // ── Annul ────────────────────────────────────────────────────────────────
    app.delete("/api/farm/credit-notes/:id", requireFarmer, async (req, res) => {
        try {
            const { sql } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = await getEffectiveFarmerId(req);
            if (!farmerId) return res.status(403).json({ error: "Forbidden" });

            const cn = ((await db.execute(sql`
                SELECT * FROM farm_credit_notes WHERE id = ${req.params.id} AND farmer_id = ${farmerId}
            `)) as any).rows?.[0];
            if (!cn) return res.status(404).json({ error: "Não encontrada" });
            if (cn.status === "annulled") return res.status(400).json({ error: "Nota já anulada" });

            const invoices = ((await db.execute(sql`
                SELECT * FROM farm_credit_note_invoices WHERE credit_note_id = ${req.params.id}
            `)) as any).rows || [];

            // Reverse AP/AR
            for (const inv of invoices) {
                const allocated = parseFloat(inv.allocated_amount) || 0;
                if (inv.invoice_type === "payable") {
                    await db.execute(sql`
                        UPDATE farm_accounts_payable SET
                            paid_amount = GREATEST(0, CAST(COALESCE(paid_amount,0) AS NUMERIC) - ${allocated}),
                            status = CASE
                                WHEN GREATEST(0, CAST(COALESCE(paid_amount,0) AS NUMERIC) - ${allocated}) = 0 THEN 'aberto'
                                WHEN GREATEST(0, CAST(COALESCE(paid_amount,0) AS NUMERIC) - ${allocated}) < CAST(total_amount AS NUMERIC) THEN 'parcial'
                                ELSE 'pago'
                            END
                        WHERE id = ${inv.invoice_id} AND farmer_id = ${farmerId}
                    `);
                } else {
                    await db.execute(sql`
                        UPDATE farm_accounts_receivable SET
                            received_amount = GREATEST(0, CAST(COALESCE(received_amount,0) AS NUMERIC) - ${allocated}),
                            status = CASE
                                WHEN GREATEST(0, CAST(COALESCE(received_amount,0) AS NUMERIC) - ${allocated}) = 0 THEN 'pendente'
                                WHEN GREATEST(0, CAST(COALESCE(received_amount,0) AS NUMERIC) - ${allocated}) < CAST(total_amount AS NUMERIC) THEN 'parcial'
                                ELSE 'recebido'
                            END
                        WHERE id = ${inv.invoice_id} AND farmer_id = ${farmerId}
                    `);
                }
            }

            // Reverse stock if return type
            if (cn.note_type === "return") {
                const items = ((await db.execute(sql`
                    SELECT * FROM farm_credit_note_items WHERE credit_note_id = ${req.params.id}
                `)) as any).rows || [];

                for (const item of items) {
                    if (!item.product_id) continue;
                    const qty = parseFloat(item.quantity) || 0;
                    if (qty <= 0) continue;

                    if (cn.type === "provider") {
                        // Was exit → restore entry
                        await db.execute(sql`
                            UPDATE farm_stock
                            SET quantity = CAST(quantity AS NUMERIC) + ${qty}, updated_at = now()
                            WHERE farmer_id = ${farmerId} AND product_id = ${item.product_id}
                        `);
                    } else {
                        // Was entry → remove
                        await db.execute(sql`
                            UPDATE farm_stock
                            SET quantity = GREATEST(0, CAST(quantity AS NUMERIC) - ${qty}), updated_at = now()
                            WHERE farmer_id = ${farmerId} AND product_id = ${item.product_id}
                        `);
                    }
                }
            }

            await db.execute(sql`
                UPDATE farm_credit_notes SET status = 'annulled' WHERE id = ${req.params.id}
            `);

            res.json({ ok: true });
        } catch (err) {
            console.error("[CN_ANNUL]", err);
            res.status(500).json({ error: "Erro ao anular nota de crédito" });
        }
    });
}
