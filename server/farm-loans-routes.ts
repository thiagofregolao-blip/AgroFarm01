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

            // Fetch installments for all loans
            const enriched = [];
            for (const loan of loans as any[]) {
                const instResult = await db.execute(sql`
                    SELECT * FROM farm_loan_installments
                    WHERE loan_id = ${loan.id}
                    ORDER BY installment_number ASC
                `);
                enriched.push({
                    ...loan,
                    installments: instResult.rows || instResult,
                });
            }

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

            // Atomico: loan + installments + cash_tx + saldo sao criados juntos
            let loan: any;
            await db.transaction(async (dbTx: any) => {
                const loanResult = await dbTx.execute(sql`
                    INSERT INTO farm_loans (farmer_id, type, counterpart_id, counterpart_name, description, currency, account_id, total_amount, interest_rate)
                    VALUES (${farmerId}, ${type}, ${counterpartId || null}, ${counterpartName}, ${description || null}, ${currency || "USD"}, ${accountId || null}, ${total}, ${interestRate ? parseFloat(interestRate) : null})
                    RETURNING *
                `);
                loan = (loanResult.rows || loanResult)[0];

                // Create installments
                for (let idx = 0; idx < installments.length; idx++) {
                    const inst = installments[idx];
                    await dbTx.execute(sql`
                        INSERT INTO farm_loan_installments (loan_id, installment_number, amount, due_date)
                        VALUES (${loan.id}, ${idx + 1}, ${parseFloat(inst.amount)}, ${inst.dueDate})
                    `);
                }

                // Create cash transaction + update balance
                // reference_id = loan.id permite identificar a tx de criacao no DELETE
                if (accountId) {
                    const txType = type === "payable" ? "entrada" : "saida";
                    const txDesc = type === "payable"
                        ? `Prestamo recibido de ${counterpartName}`
                        : `Prestamo otorgado a ${counterpartName}`;

                    await dbTx.execute(sql`
                        INSERT INTO farm_cash_transactions (farmer_id, account_id, type, amount, currency, description, category, reference_type, reference_id, transaction_date)
                        VALUES (${farmerId}, ${accountId}, ${txType}, ${total}, ${currency || "USD"}, ${txDesc}, ${"prestamo"}, ${"prestamo"}, ${loan.id}, ${new Date().toISOString()})
                    `);

                    const balanceDelta = txType === "entrada" ? +total : -total;
                    await dbTx.execute(sql`
                        UPDATE farm_cash_accounts
                        SET current_balance = CAST(current_balance AS NUMERIC) + ${balanceDelta}
                        WHERE id = ${accountId}
                    `);
                }
            });

            // Fetch created installments (outside tx — read only)
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
    // Reversao completa: desfaz tx de criacao + todas as tx de pagamento de
    // parcela vinculadas, restaurando o saldo dos caixas antes de excluir
    // loan + installments + cash_transactions. Tudo atomico.
    // ============================================================================
    app.delete("/api/farm/loans/:id", requireFarmer, async (req, res) => {
        try {
            const { sql } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = await getEffectiveFarmerId(req);
            if (!farmerId) return res.status(403).json({ error: "Farmer not found" });

            const loanId = req.params.id;

            // Check loan exists and belongs to farmer
            const check = await db.execute(sql`
                SELECT * FROM farm_loans WHERE id = ${loanId} AND farmer_id = ${farmerId}
            `);
            const loan = (check.rows || check)[0];
            if (!loan) return res.status(404).json({ error: "Loan not found" });

            await db.transaction(async (dbTx: any) => {
                // 1) Coleta ids das parcelas deste loan
                const instRes = await dbTx.execute(sql`
                    SELECT id FROM farm_loan_installments WHERE loan_id = ${loanId}
                `);
                const instIds = ((instRes.rows || instRes) as any[]).map(r => r.id);

                // 2) Busca todas as cash_transactions relacionadas
                //    - tx de criacao do loan: reference_id = loan.id
                //    - tx de pagamento de parcelas: reference_id IN (instIds)
                const allRefIds = [loanId, ...instIds];
                const txRes = await dbTx.execute(sql`
                    SELECT id, account_id, type, amount FROM farm_cash_transactions
                    WHERE farmer_id = ${farmerId}
                      AND reference_type = 'prestamo'
                      AND reference_id = ANY(${allRefIds}::varchar[])
                `);
                const txs = (txRes.rows || txRes) as any[];

                // 3) Reverte o saldo de cada caixa (entrada vira -amount; saida vira +amount)
                for (const t of txs) {
                    if (!t.account_id) continue;
                    const amount = parseFloat(t.amount) || 0;
                    const revertDelta = t.type === "entrada" ? -amount : +amount;
                    await dbTx.execute(sql`
                        UPDATE farm_cash_accounts
                        SET current_balance = CAST(current_balance AS NUMERIC) + ${revertDelta}
                        WHERE id = ${t.account_id}
                    `);
                }

                // 4) Exclui as cash_transactions vinculadas
                if (allRefIds.length > 0) {
                    await dbTx.execute(sql`
                        DELETE FROM farm_cash_transactions
                        WHERE farmer_id = ${farmerId}
                          AND reference_type = 'prestamo'
                          AND reference_id = ANY(${allRefIds}::varchar[])
                    `);
                }

                // 5) Exclui installments explicitamente (caso CASCADE nao esteja configurada)
                await dbTx.execute(sql`
                    DELETE FROM farm_loan_installments WHERE loan_id = ${loanId}
                `);

                // 6) Exclui o loan
                await dbTx.execute(sql`DELETE FROM farm_loans WHERE id = ${loanId}`);
            });

            res.json({ ok: true });
        } catch (err: any) {
            console.error("[LOAN_DELETE]", err);
            res.status(500).json({ error: err.message });
        }
    });

    // ============================================================================
    // INSTALLMENTS — PAY (mark installment as paid + create cash transaction)
    // Atomica: installment, loan, cash_tx e saldo sao atualizados na mesma
    // transacao DB. Se qualquer passo falhar, tudo rollback.
    // ============================================================================
    app.post("/api/farm/loans/installments/:id/pay", requireFarmer, async (req, res) => {
        try {
            const { sql } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = await getEffectiveFarmerId(req);
            if (!farmerId) return res.status(403).json({ error: "Farmer not found" });

            const { accountId, amount } = req.body;
            const instId = req.params.id;

            // Fetch installment + loan (outside tx — read-only validation)
            const instResult = await db.execute(sql`
                SELECT i.*, l.type AS loan_type, l.counterpart_name, l.currency, l.id AS loan_id
                FROM farm_loan_installments i
                JOIN farm_loans l ON l.id = i.loan_id
                WHERE i.id = ${instId} AND l.farmer_id = ${farmerId}
            `);
            const inst = (instResult.rows || instResult)[0];
            if (!inst) return res.status(404).json({ error: "Installment not found" });

            const payAmount = parseFloat(amount) || parseFloat(inst.amount);
            if (payAmount <= 0) return res.status(400).json({ error: "Valor deve ser maior que zero" });

            const prevPaid = parseFloat(inst.paid_amount) || 0;
            const newPaid = prevPaid + payAmount;
            const instAmount = parseFloat(inst.amount);
            if (newPaid > instAmount + 0.01) {
                return res.status(400).json({ error: `Pagamento excede saldo da parcela (restante: ${(instAmount - prevPaid).toFixed(2)})` });
            }

            let newStatus: string = "parcial";
            let loanStatus: string = "aberto";

            await db.transaction(async (tx: any) => {
                // Update installment
                newStatus = newPaid >= instAmount - 0.01 ? "pago" : "parcial";
                await tx.execute(sql`
                    UPDATE farm_loan_installments
                    SET paid_amount = ${newPaid}, status = ${newStatus}, paid_date = now()
                    WHERE id = ${instId}
                `);

                // Update loan paid_amount
                await tx.execute(sql`
                    UPDATE farm_loans
                    SET paid_amount = COALESCE(paid_amount, 0) + ${payAmount}
                    WHERE id = ${inst.loan_id}
                `);

                // Recalculate loan status
                const allInst = await tx.execute(sql`
                    SELECT status FROM farm_loan_installments WHERE loan_id = ${inst.loan_id}
                `);
                const allRows = allInst.rows || allInst;
                const allPaid = allRows.every((r: any) => r.status === "pago");
                const somePaid = allRows.some((r: any) => r.status === "pago" || r.status === "parcial");
                loanStatus = allPaid ? "pago" : somePaid ? "parcial" : "aberto";
                await tx.execute(sql`
                    UPDATE farm_loans SET status = ${loanStatus} WHERE id = ${inst.loan_id}
                `);

                // Create cash transaction + update balance
                if (accountId) {
                    const txType = inst.loan_type === "payable" ? "saida" : "entrada";
                    const txDesc = inst.loan_type === "payable"
                        ? `Pago parcela ${inst.installment_number} - Prestamo de ${inst.counterpart_name}`
                        : `Recibido parcela ${inst.installment_number} - Prestamo a ${inst.counterpart_name}`;

                    // reference_id = installment_id permite editar/excluir o pagamento depois
                    const txInsert = await tx.execute(sql`
                        INSERT INTO farm_cash_transactions (farmer_id, account_id, type, amount, currency, description, category, reference_type, reference_id, transaction_date)
                        VALUES (${farmerId}, ${accountId}, ${txType}, ${payAmount}, ${inst.currency}, ${txDesc}, ${"prestamo"}, ${"prestamo"}, ${instId}, ${new Date().toISOString()})
                        RETURNING id
                    `);
                    const newTxId = (txInsert.rows || txInsert)[0]?.id;

                    // Salva o id da tx no installment (para primeiro pagamento e referencia rapida)
                    if (newTxId) {
                        await tx.execute(sql`
                            UPDATE farm_loan_installments SET cash_transaction_id = ${newTxId} WHERE id = ${instId}
                        `);
                    }

                    const balanceDelta = txType === "saida" ? -payAmount : payAmount;
                    await tx.execute(sql`
                        UPDATE farm_cash_accounts
                        SET current_balance = CAST(current_balance AS NUMERIC) + ${balanceDelta}
                        WHERE id = ${accountId}
                    `);
                }
            });

            res.json({ ok: true, status: newStatus, loanStatus });
        } catch (err: any) {
            console.error("[INSTALLMENT_PAY]", err);
            res.status(500).json({ error: err.message });
        }
    });

    // ============================================================================
    // PAYMENTS HISTORY — list all payment transactions linked to loans
    // ?type=payable  -> "Historico de Pagamentos" (saidas em prestamos a pagar)
    // ?type=receivable -> "Historico de Recebimentos" (entradas em prestamos a receber)
    // ============================================================================
    // URL fora do prefixo /loans/:id para evitar conflito com a rota GET /loans/:id
    // (Express matcharia "payments" como :id e retornaria 404 "Loan not found")
    app.get("/api/farm/loan-payments", requireFarmer, async (req, res) => {
        try {
            const { sql } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = await getEffectiveFarmerId(req);
            if (!farmerId) return res.status(403).json({ error: "Farmer not found" });

            const type = (req.query.type as string) || "payable";
            const txType = type === "payable" ? "saida" : "entrada";
            const loanType = type === "payable" ? "payable" : "receivable";

            // JOIN installment+loan for counterpart name; LEFT JOIN so rows sem
            // reference_id ainda aparecem (dados antigos), mesmo sem editar.
            const result = await db.execute(sql`
                SELECT
                    tx.id,
                    tx.transaction_date    AS "transactionDate",
                    tx.amount,
                    tx.currency,
                    tx.description,
                    tx.account_id          AS "accountId",
                    tx.reference_id        AS "installmentId",
                    acc.name               AS "accountName",
                    inst.installment_number AS "installmentNumber",
                    inst.amount            AS "installmentAmount",
                    l.id                   AS "loanId",
                    l.counterpart_name     AS "counterpartName",
                    l.type                 AS "loanType"
                FROM farm_cash_transactions tx
                LEFT JOIN farm_cash_accounts     acc  ON acc.id  = tx.account_id
                LEFT JOIN farm_loan_installments inst ON inst.id = tx.reference_id
                LEFT JOIN farm_loans             l    ON l.id    = inst.loan_id
                WHERE tx.farmer_id = ${farmerId}
                  AND tx.reference_type = 'prestamo'
                  AND tx.type = ${txType}
                  AND (l.type = ${loanType} OR l.type IS NULL)
                ORDER BY tx.transaction_date DESC
            `);

            res.json(result.rows || result);
        } catch (err: any) {
            console.error("[LOAN_PAYMENTS_LIST]", err);
            res.status(500).json({ error: err.message });
        }
    });

    // ============================================================================
    // PATCH payment — edita um pagamento existente (valor, caixa, data, descricao)
    // Reversao atomica: desfaz estado anterior no caixa/parcela/loan, aplica o novo,
    // tudo em 1 transacao DB.
    // ============================================================================
    app.patch("/api/farm/loan-payments/:txId", requireFarmer, async (req, res) => {
        try {
            const { sql } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = await getEffectiveFarmerId(req);
            if (!farmerId) return res.status(403).json({ error: "Farmer not found" });

            const txId = req.params.txId;
            const { amount, accountId, transactionDate, description } = req.body;

            if (amount === undefined || amount === null || amount === "") {
                return res.status(400).json({ error: "Valor obrigatorio" });
            }
            const newAmount = parseFloat(String(amount));
            if (isNaN(newAmount) || newAmount <= 0) {
                return res.status(400).json({ error: "Valor deve ser maior que zero" });
            }
            if (!accountId) return res.status(400).json({ error: "Caixa obrigatoria" });

            // Carrega tx existente + parcela/loan vinculados
            const txResult = await db.execute(sql`
                SELECT tx.*, inst.id AS inst_id, inst.amount AS inst_amount, inst.paid_amount AS inst_paid,
                       l.id AS loan_id, l.total_amount AS loan_total
                FROM farm_cash_transactions tx
                LEFT JOIN farm_loan_installments inst ON inst.id = tx.reference_id
                LEFT JOIN farm_loans             l    ON l.id = inst.loan_id
                WHERE tx.id = ${txId} AND tx.farmer_id = ${farmerId}
            `);
            const row = (txResult.rows || txResult)[0];
            if (!row) return res.status(404).json({ error: "Pagamento nao encontrado" });
            if (row.reference_type !== "prestamo") {
                return res.status(400).json({ error: "Transacao nao e um pagamento de prestamo" });
            }
            if (!row.inst_id) {
                return res.status(400).json({ error: "Pagamento antigo sem vinculo com parcela (reference_id ausente) — nao editavel" });
            }

            const oldAmount = parseFloat(row.amount) || 0;
            const oldAccountId = row.account_id;
            const txType = row.type; // 'saida' ou 'entrada' — fixo, nao muda no edit
            const instAmount = parseFloat(row.inst_amount) || 0;
            const instPaid = parseFloat(row.inst_paid) || 0;

            // Checa se o novo valor cabe na parcela: total pago apos edit
            const newInstPaid = instPaid - oldAmount + newAmount;
            if (newInstPaid > instAmount + 0.01) {
                return res.status(400).json({
                    error: `Valor excede saldo da parcela (outros pagamentos somam ${(instPaid - oldAmount).toFixed(2)}, parcela e de ${instAmount.toFixed(2)})`,
                });
            }

            // Checa conta nova existe e e do farmer
            const accCheck = await db.execute(sql`
                SELECT id FROM farm_cash_accounts WHERE id = ${accountId} AND farmer_id = ${farmerId}
            `);
            if (!(accCheck.rows || accCheck)[0]) {
                return res.status(400).json({ error: "Caixa invalida" });
            }

            await db.transaction(async (tx: any) => {
                // 1) Reverte no caixa ANTIGO (se saida, devolve; se entrada, tira)
                if (oldAccountId) {
                    const revertDelta = txType === "saida" ? +oldAmount : -oldAmount;
                    await tx.execute(sql`
                        UPDATE farm_cash_accounts
                        SET current_balance = CAST(current_balance AS NUMERIC) + ${revertDelta}
                        WHERE id = ${oldAccountId}
                    `);
                }

                // 2) Aplica no caixa NOVO (pode ser o mesmo)
                const applyDelta = txType === "saida" ? -newAmount : +newAmount;
                await tx.execute(sql`
                    UPDATE farm_cash_accounts
                    SET current_balance = CAST(current_balance AS NUMERIC) + ${applyDelta}
                    WHERE id = ${accountId}
                `);

                // 3) Ajusta paid_amount da parcela + recalcula status
                const instStatus = newInstPaid >= instAmount - 0.01 ? "pago"
                                 : newInstPaid > 0                  ? "parcial"
                                 : "pendente";
                await tx.execute(sql`
                    UPDATE farm_loan_installments
                    SET paid_amount = ${newInstPaid}, status = ${instStatus}
                    WHERE id = ${row.inst_id}
                `);

                // 4) Ajusta paid_amount do loan + recalcula status
                const delta = newAmount - oldAmount;
                await tx.execute(sql`
                    UPDATE farm_loans
                    SET paid_amount = COALESCE(paid_amount, 0) + ${delta}
                    WHERE id = ${row.loan_id}
                `);

                const allInst = await tx.execute(sql`
                    SELECT status FROM farm_loan_installments WHERE loan_id = ${row.loan_id}
                `);
                const allRows = allInst.rows || allInst;
                const allPaid = allRows.every((r: any) => r.status === "pago");
                const somePaid = allRows.some((r: any) => r.status === "pago" || r.status === "parcial");
                const loanStatus = allPaid ? "pago" : somePaid ? "parcial" : "aberto";
                await tx.execute(sql`
                    UPDATE farm_loans SET status = ${loanStatus} WHERE id = ${row.loan_id}
                `);

                // 5) Atualiza a propria cash_transaction
                const newDate = transactionDate ? new Date(transactionDate).toISOString() : row.transaction_date;
                const newDesc = description !== undefined ? description : row.description;
                await tx.execute(sql`
                    UPDATE farm_cash_transactions
                    SET amount = ${newAmount},
                        account_id = ${accountId},
                        transaction_date = ${newDate},
                        description = ${newDesc}
                    WHERE id = ${txId}
                `);
            });

            res.json({ ok: true });
        } catch (err: any) {
            console.error("[LOAN_PAYMENT_EDIT]", err);
            res.status(500).json({ error: err.message });
        }
    });
}
