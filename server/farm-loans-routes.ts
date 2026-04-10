import type { Express } from "express";
import { requireFarmer, getEffectiveFarmerId } from "./farm-middleware";

export function registerFarmLoansRoutes(app: Express) {

    // ============================================================================
    // LOANS — LIST
    // ============================================================================
    app.get("/api/farm/loans", requireFarmer, async (req, res) => {
        try {
            const { sql } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = await getEffectiveFarmerId(req);
            if (!farmerId) return res.status(403).json({ error: "Farmer not found" });

            const type = (req.query.type as string) || undefined;

            let result;
            if (type) {
                result = await db.execute(sql`
                    SELECT * FROM farm_loans
                    WHERE farmer_id = ${farmerId} AND type = ${type}
                    ORDER BY created_at DESC
                `);
            } else {
                result = await db.execute(sql`
                    SELECT * FROM farm_loans
                    WHERE farmer_id = ${farmerId}
                    ORDER BY created_at DESC
                `);
            }

            const loans = result.rows || result;

            // Fetch installments for each loan
            const loanIds = loans.map((l: any) => l.id);
            let installments: any[] = [];
            if (loanIds.length > 0) {
                const instResult = await db.execute(sql`
                    SELECT * FROM farm_loan_installments
                    WHERE loan_id = ANY(${loanIds})
                    ORDER BY installment_number ASC
                `);
                installments = instResult.rows || instResult;
            }

            // Group installments by loan_id
            const byLoan: Record<string, any[]> = {};
            for (const inst of installments) {
                const lid = inst.loan_id;
                if (!byLoan[lid]) byLoan[lid] = [];
                byLoan[lid].push(inst);
            }

            const enriched = loans.map((loan: any) => ({
                ...loan,
                installments: byLoan[loan.id] || [],
            }));

            res.json(enriched);
        } catch (err: any) {
            console.error("[LOANS_LIST]", err);
            res.status(500).json({ error: err.message });
        }
    });

    // ============================================================================
    // LOANS — GET ONE
    // ============================================================================
    app.get("/api/farm/loans/:id", requireFarmer, async (req, res) => {
        try {
            const { sql } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = await getEffectiveFarmerId(req);
            if (!farmerId) return res.status(403).json({ error: "Farmer not found" });

            const result = await db.execute(sql`
                SELECT * FROM farm_loans WHERE id = ${req.params.id} AND farmer_id = ${farmerId}
            `);
            const loan = (result.rows || result)[0];
            if (!loan) return res.status(404).json({ error: "Loan not found" });

            const instResult = await db.execute(sql`
                SELECT * FROM farm_loan_installments WHERE loan_id = ${loan.id} ORDER BY installment_number ASC
            `);

            res.json({ ...loan, installments: instResult.rows || instResult });
        } catch (err: any) {
            console.error("[LOAN_GET]", err);
            res.status(500).json({ error: err.message });
        }
    });

    // ============================================================================
    // LOANS — CREATE (with installments + cash transaction)
    // ============================================================================
    app.post("/api/farm/loans", requireFarmer, async (req, res) => {
        try {
            const { sql } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = await getEffectiveFarmerId(req);
            if (!farmerId) return res.status(403).json({ error: "Farmer not found" });

            const {
                type, counterpartId, counterpartName, description,
                currency, accountId, totalAmount, interestRate, installments,
            } = req.body;

            if (!type || !counterpartName || !totalAmount || !installments?.length) {
                return res.status(400).json({ error: "Campos obrigatorios: type, counterpartName, totalAmount, installments" });
            }

            // Validate: sum of installments must equal totalAmount
            const sum = installments.reduce((acc: number, i: any) => acc + (parseFloat(i.amount) || 0), 0);
            const total = parseFloat(totalAmount) || 0;
            if (Math.abs(sum - total) > 0.01) {
                return res.status(400).json({
                    error: `Soma das parcelas (${sum.toFixed(2)}) diverge do valor total (${total.toFixed(2)})`,
                });
            }

            // Create loan
            const loanResult = await db.execute(sql`
                INSERT INTO farm_loans (farmer_id, type, counterpart_id, counterpart_name, description, currency, account_id, total_amount, interest_rate)
                VALUES (${farmerId}, ${type}, ${counterpartId || null}, ${counterpartName}, ${description || null}, ${currency || "USD"}, ${accountId || null}, ${total}, ${interestRate ? parseFloat(interestRate) : null})
                RETURNING *
            `);
            const loan = (loanResult.rows || loanResult)[0];

            // Create installments
            for (let idx = 0; idx < installments.length; idx++) {
                const inst = installments[idx];
                await db.execute(sql`
                    INSERT INTO farm_loan_installments (loan_id, installment_number, amount, due_date)
                    VALUES (${loan.id}, ${idx + 1}, ${parseFloat(inst.amount)}, ${inst.dueDate})
                `);
            }

            // Create cash transaction (entrada for payable, saida for receivable)
            if (accountId) {
                const txType = type === "payable" ? "entrada" : "saida";
                const txDesc = type === "payable"
                    ? `Prestamo recibido de ${counterpartName}`
                    : `Prestamo otorgado a ${counterpartName}`;

                await db.execute(sql`
                    INSERT INTO farm_cash_transactions (farmer_id, account_id, type, amount, currency, description, category, date)
                    VALUES (${farmerId}, ${accountId}, ${txType}, ${total}, ${currency || "USD"}, ${txDesc}, ${"prestamo"}, ${new Date().toISOString()})
                `);

                // Update account balance
                if (txType === "entrada") {
                    await db.execute(sql`
                        UPDATE farm_cash_accounts SET balance = CAST(balance AS NUMERIC) + ${total} WHERE id = ${accountId}
                    `);
                } else {
                    await db.execute(sql`
                        UPDATE farm_cash_accounts SET balance = CAST(balance AS NUMERIC) - ${total} WHERE id = ${accountId}
                    `);
                }
            }

            // Fetch created installments
            const instResult = await db.execute(sql`
                SELECT * FROM farm_loan_installments WHERE loan_id = ${loan.id} ORDER BY installment_number ASC
            `);

            res.json({ ...loan, installments: instResult.rows || instResult });
        } catch (err: any) {
            console.error("[LOAN_CREATE]", err);
            res.status(500).json({ error: err.message });
        }
    });

    // ============================================================================
    // LOANS — DELETE
    // ============================================================================
    app.delete("/api/farm/loans/:id", requireFarmer, async (req, res) => {
        try {
            const { sql } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = await getEffectiveFarmerId(req);
            if (!farmerId) return res.status(403).json({ error: "Farmer not found" });

            // Check loan exists and belongs to farmer
            const check = await db.execute(sql`
                SELECT * FROM farm_loans WHERE id = ${req.params.id} AND farmer_id = ${farmerId}
            `);
            const loan = (check.rows || check)[0];
            if (!loan) return res.status(404).json({ error: "Loan not found" });

            // Installments are cascade deleted
            await db.execute(sql`DELETE FROM farm_loans WHERE id = ${req.params.id}`);
            res.json({ ok: true });
        } catch (err: any) {
            console.error("[LOAN_DELETE]", err);
            res.status(500).json({ error: err.message });
        }
    });

    // ============================================================================
    // INSTALLMENTS — PAY (mark installment as paid + create cash transaction)
    // ============================================================================
    app.post("/api/farm/loans/installments/:id/pay", requireFarmer, async (req, res) => {
        try {
            const { sql } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = await getEffectiveFarmerId(req);
            if (!farmerId) return res.status(403).json({ error: "Farmer not found" });

            const { accountId, amount } = req.body;
            const instId = req.params.id;

            // Fetch installment + loan
            const instResult = await db.execute(sql`
                SELECT i.*, l.type AS loan_type, l.counterpart_name, l.currency, l.id AS loan_id, l.farmer_id, l.total_amount, l.paid_amount
                FROM farm_loan_installments i
                JOIN farm_loans l ON l.id = i.loan_id
                WHERE i.id = ${instId} AND l.farmer_id = ${farmerId}
            `);
            const inst = (instResult.rows || instResult)[0];
            if (!inst) return res.status(404).json({ error: "Installment not found" });

            const payAmount = parseFloat(amount) || parseFloat(inst.amount);
            const prevPaid = parseFloat(inst.paid_amount) || 0;
            const newPaid = prevPaid + payAmount;
            const instAmount = parseFloat(inst.amount);

            // Update installment
            const newStatus = newPaid >= instAmount ? "pago" : "parcial";
            await db.execute(sql`
                UPDATE farm_loan_installments
                SET paid_amount = ${newPaid}, status = ${newStatus}, paid_date = now()
                WHERE id = ${instId}
            `);

            // Update loan paid_amount
            const loanPaid = (parseFloat(inst.paid_amount_1 || inst.paid_amount) || 0);
            const newLoanPaid = (parseFloat(inst.paid_amount) || 0) + payAmount;
            await db.execute(sql`
                UPDATE farm_loans
                SET paid_amount = COALESCE(paid_amount, 0) + ${payAmount}
                WHERE id = ${inst.loan_id}
            `);

            // Check if all installments are paid to update loan status
            const allInst = await db.execute(sql`
                SELECT status FROM farm_loan_installments WHERE loan_id = ${inst.loan_id}
            `);
            const allRows = allInst.rows || allInst;
            const allPaid = allRows.every((r: any) => r.status === "pago");
            const somePaid = allRows.some((r: any) => r.status === "pago" || r.status === "parcial");
            const loanStatus = allPaid ? "pago" : somePaid ? "parcial" : "aberto";
            await db.execute(sql`
                UPDATE farm_loans SET status = ${loanStatus} WHERE id = ${inst.loan_id}
            `);

            // Create cash transaction
            if (accountId) {
                // payable = agricultor paga parcela = saida
                // receivable = agricultor recebe parcela = entrada
                const txType = inst.loan_type === "payable" ? "saida" : "entrada";
                const txDesc = inst.loan_type === "payable"
                    ? `Pago parcela ${inst.installment_number} - Prestamo de ${inst.counterpart_name}`
                    : `Recibido parcela ${inst.installment_number} - Prestamo a ${inst.counterpart_name}`;

                await db.execute(sql`
                    INSERT INTO farm_cash_transactions (farmer_id, account_id, type, amount, currency, description, category, date)
                    VALUES (${farmerId}, ${accountId}, ${txType}, ${payAmount}, ${inst.currency}, ${txDesc}, ${"prestamo"}, ${new Date().toISOString()})
                `);

                if (txType === "saida") {
                    await db.execute(sql`
                        UPDATE farm_cash_accounts SET balance = CAST(balance AS NUMERIC) - ${payAmount} WHERE id = ${accountId}
                    `);
                } else {
                    await db.execute(sql`
                        UPDATE farm_cash_accounts SET balance = CAST(balance AS NUMERIC) + ${payAmount} WHERE id = ${accountId}
                    `);
                }
            }

            res.json({ ok: true, status: newStatus, loanStatus });
        } catch (err: any) {
            console.error("[INSTALLMENT_PAY]", err);
            res.status(500).json({ error: err.message });
        }
    });
}
