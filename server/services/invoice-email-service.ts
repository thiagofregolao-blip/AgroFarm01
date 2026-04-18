/**
 * Invoice Email Import Service
 * 
 * Receives PDF invoices via Mailgun webhook,
 * extracts data using Gemini Vision AI, 
 * and creates draft invoices for farmer approval.
 */

import { db } from "../db";
import { farmInvoices, farmInvoiceItems, farmProductsCatalog, users } from "../../shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { parseWithGemini } from "../gemini-invoice-parser";

interface ExtractedInvoice {
    invoiceNumber: string | null;
    supplier: string;
    supplierRuc: string | null;
    supplierPhone: string | null;
    supplierEmail: string | null;
    supplierAddress: string | null;
    issueDate: string | null;
    dueDate: string | null;
    currency: string;
    paymentCondition: string | null;
    totalAmount: number;
    isRemision: boolean;
    items: Array<{
        productName: string;
        productCode: string | null;
        quantity: number;
        unit: string;
        unitPrice: number;
        totalPrice: number;
        batch: string | null;
    }>;
}

/**
 * Detect if a document is a remission using 3-layer detection + downgrade
 * Same logic as farm-invoice-routes.ts
 */
function detectRemision(parsed: any): boolean {
    // Camada 0 (downgrade): se o Gemini disse remision MAS ha indicios fortes de factura
    // (total > 0, items com preco > 0, ou supplier contem "FACTURA"), reverter. Protege
    // contra falso positivo quando Gemini le "REMISIONES: XXX" (campo de referencia
    // presente em quase toda fatura paraguaia) e classifica mal.
    if (parsed.type === "remision") {
        const total = Number(parsed.totalAmount) || 0;
        const hasPricedItems = Array.isArray(parsed.items) &&
            parsed.items.some((it: any) => Number(it.unitPrice) > 0 || Number(it.totalPrice) > 0);
        const supplierSaysFactura = String(parsed.supplier || "").toUpperCase().includes("FACTURA");

        if (total > 0 || hasPricedItems || supplierSaysFactura) {
            console.log(`[EMAIL_IMPORT] Downgrade: Gemini disse remision mas ha indicios de factura (total=${total}, pricedItems=${hasPricedItems}) — tratando como invoice`);
            return false;
        }
        return true;
    }

    // Camada 2: fallback por texto na descrição ou supplier
    const textsToCheck = [parsed.description || "", parsed.supplier || ""].join(" ").toUpperCase();
    if (textsToCheck.includes("REMISION") || textsToCheck.includes("REMISSAO") ||
        textsToCheck.includes("NOTA DE REMISION") || textsToCheck.includes("GUIA DE REMESSA")) {
        console.log(`[EMAIL_IMPORT] Fallback texto: detectado como REMISION`);
        return true;
    }

    // Camada 3: fallback por dados — todos preços zero + total zero
    if (parsed.items && parsed.items.length > 0) {
        const allZeroPrice = parsed.items.every((item: any) => !item.unitPrice || item.unitPrice === 0);
        const zeroTotal = !parsed.totalAmount || parsed.totalAmount === 0;
        if (allZeroPrice && zeroTotal) {
            console.log(`[EMAIL_IMPORT] Fallback dados: detectado como REMISION (todos preços zero)`);
            return true;
        }
    }

    return false;
}

/**
 * Extract invoice data from a PDF using the unified Gemini parser
 */
export async function extractInvoiceFromPdf(pdfBase64: string): Promise<ExtractedInvoice> {
    const parsed = await parseWithGemini(pdfBase64, "application/pdf");
    const isRemision = detectRemision(parsed);

    if (isRemision) {
        console.log(`[EMAIL_IMPORT] Documento classificado como NOTA DE REMISION`);
    }

    return {
        invoiceNumber: parsed.invoiceNumber || null,
        supplier: parsed.supplier || "Fornecedor não identificado",
        supplierRuc: parsed.supplierRuc || null,
        supplierPhone: parsed.supplierPhone || null,
        supplierEmail: parsed.supplierEmail || null,
        supplierAddress: parsed.supplierAddress || null,
        issueDate: parsed.issueDate || null,
        dueDate: parsed.dueDate || null,
        currency: parsed.currency || "USD",
        paymentCondition: parsed.paymentCondition || null,
        totalAmount: isRemision ? 0 : (typeof parsed.totalAmount === "number" ? parsed.totalAmount : 0),
        isRemision,
        items: Array.isArray(parsed.items) ? parsed.items.map((item: any) => ({
            productName: item.productName || "Produto não identificado",
            productCode: item.productCode || null,
            quantity: typeof item.quantity === "number" ? item.quantity : 0,
            unit: item.unit || "UNI",
            unitPrice: isRemision ? 0 : (typeof item.unitPrice === "number" ? item.unitPrice : 0),
            totalPrice: isRemision ? 0 : (typeof item.totalPrice === "number" ? item.totalPrice : 0),
            batch: item.batch || null,
        })) : [],
    };
}

/**
 * Find the farmer associated with a given invoice email address
 */
export async function findFarmerByInvoiceEmail(email: string) {
    const [farmer] = await db
        .select()
        .from(users)
        .where(eq(users.invoiceEmail, email.toLowerCase()))
        .limit(1);

    return farmer || null;
}

/**
 * Try to match extracted product names with existing catalog products
 */
async function matchProducts(farmerId: string, items: ExtractedInvoice["items"]) {
    // Get all products in global catalog
    const catalogProducts = await db
        .select()
        .from(farmProductsCatalog);

    return items.map(item => {
        // Try exact match first
        let match = catalogProducts.find(
            p => p.name.toUpperCase() === item.productName.toUpperCase()
        );

        // Try partial match
        if (!match) {
            match = catalogProducts.find(p => {
                const pName = p.name.toUpperCase();
                const iName = item.productName.toUpperCase();
                return pName.includes(iName) || iName.includes(pName);
            });
        }

        return {
            ...item,
            matchedProductId: match?.id || null,
            matchedProductName: match?.name || null,
        };
    });
}

/**
 * Create a draft invoice from extracted data
 */
export async function createDraftInvoice(
    farmerId: string,
    extracted: ExtractedInvoice,
    emailId: string,
    emailFrom: string,
    rawPdfText?: string,
    pdfBase64?: string,
) {
    // Check if this email was already processed (avoid duplicates)
    const existing = await db.select().from(farmInvoices)
        .where(and(
            eq(farmInvoices.farmerId, farmerId),
            eq(farmInvoices.sourceEmailId, emailId)
        )).limit(1);

    if (existing.length > 0) {
        console.log(`[Invoice Email] Duplicate email ${emailId}, skipping.`);
        return null;
    }

    // Get season by dueDate range, fallback to active season
    let seasonId: string | null = null;
    try {
        const dateForSeason = extracted.dueDate || extracted.issueDate || null;
        if (dateForSeason) {
            const seasonByDate = await db.execute(sql`
                SELECT id FROM farm_seasons
                WHERE farmer_id = ${farmerId}
                  AND payment_start_date IS NOT NULL
                  AND payment_end_date IS NOT NULL
                  AND ${dateForSeason}::date BETWEEN payment_start_date AND payment_end_date
                LIMIT 1
            `);
            const rows = Array.isArray(seasonByDate) ? seasonByDate : (seasonByDate as any).rows || [];
            seasonId = rows[0]?.id || null;
        }
        if (!seasonId) {
            const activeSeason = await db.execute(sql`
                SELECT id FROM farm_seasons WHERE farmer_id = ${farmerId} AND is_active = true LIMIT 1
            `);
            const rows2 = Array.isArray(activeSeason) ? activeSeason : (activeSeason as any).rows || [];
            seasonId = rows2[0]?.id || null;
        }
    } catch (e) {
        console.error("[Invoice Email] Error getting season:", e);
    }

    // Verificação de duplicidade (eq, and already imported at top-level)
    const existingInvs = await db.select({
        id: farmInvoices.id, invoiceNumber: farmInvoices.invoiceNumber,
        supplier: farmInvoices.supplier, totalAmount: farmInvoices.totalAmount,
        sourceEmailId: farmInvoices.sourceEmailId,
        documentType: farmInvoices.documentType,
    }).from(farmInvoices).where(eq(farmInvoices.farmerId, farmerId));

    if (emailId && existingInvs.find(inv => inv.sourceEmailId === emailId)) {
        console.log(`[Invoice Email] Duplicada por emailId: ${emailId}`);
        return existingInvs.find(inv => inv.sourceEmailId === emailId) as any;
    }

    // Dedup rule: invoice number MUST match (plus supplier for extra safety).
    // The old sup+amt fallback caused false positives — recurring invoices from
    // the same supplier with a coincident total were silently dropped.
    // Exclude remissions from duplicate check — a remission and its invoice share the same number.
    const emailDuplicate = existingInvs.filter(inv => inv.documentType !== "remision").find(inv => {
        const sameNum = extracted.invoiceNumber && inv.invoiceNumber &&
            inv.invoiceNumber.replace(/\D/g, '') === String(extracted.invoiceNumber).replace(/\D/g, '');
        const sameSup = extracted.supplier && inv.supplier &&
            inv.supplier.toLowerCase().includes(String(extracted.supplier).toLowerCase().substring(0, 10));
        return sameNum && sameSup;
    });

    if (emailDuplicate) {
        console.log(`[Invoice Email] Fatura duplicada detectada: num=${emailDuplicate.invoiceNumber} supplier=${emailDuplicate.supplier} existingId=${emailDuplicate.id}`);
        return emailDuplicate as any;
    }

    // Match products with catalog
    const matchedItems = await matchProducts(farmerId, extracted.items);

    const isRemision = extracted.isRemision;

    // Create the invoice
    const [invoice] = await db.insert(farmInvoices).values({
        farmerId,
        seasonId,
        invoiceNumber: extracted.invoiceNumber,
        supplier: extracted.supplier,
        issueDate: extracted.issueDate ? new Date(extracted.issueDate.length === 10 ? extracted.issueDate + "T12:00:00" : extracted.issueDate) : null,
        dueDate: isRemision ? null : (extracted.dueDate ? new Date(extracted.dueDate.length === 10 ? extracted.dueDate + "T12:00:00" : extracted.dueDate) : null),
        currency: extracted.currency,
        totalAmount: isRemision ? "0" : String(extracted.totalAmount),
        status: "pending",
        source: "email_import",
        sourceEmailId: emailId,
        sourceEmailFrom: emailFrom,
        rawPdfData: rawPdfText || "PDF processado via Gemini AI",
        pdfBase64: pdfBase64 || null,
        fileMimeType: "application/pdf",
        documentType: isRemision ? "remision" : "factura",
        paymentCondition: extracted.paymentCondition || null,
    } as any).returning();

    // Auto-create/update supplier with extracted data
    if (extracted.supplier && extracted.supplier !== "Fornecedor não identificado") {
        try {
            const existingSupplier = await db.execute(sql`
                SELECT id FROM farm_suppliers WHERE farmer_id = ${farmerId} AND lower(name) = lower(${extracted.supplier}) LIMIT 1
            `);
            const supplierRows = Array.isArray(existingSupplier) ? existingSupplier : (existingSupplier as any).rows || [];
            if (supplierRows.length === 0 && (extracted.supplierRuc || extracted.supplierPhone || extracted.supplierEmail)) {
                await db.execute(sql`
                    INSERT INTO farm_suppliers (farmer_id, name, ruc, phone, email, address, person_type, entity_type)
                    VALUES (${farmerId}, ${extracted.supplier}, ${extracted.supplierRuc}, ${extracted.supplierPhone}, ${extracted.supplierEmail}, ${extracted.supplierAddress}, 'juridica', 'supplier')
                    ON CONFLICT DO NOTHING
                `);
                console.log(`[EMAIL_IMPORT] Auto-criado fornecedor: ${extracted.supplier}`);
            }
        } catch (e) {
            console.error("[EMAIL_IMPORT] Erro ao criar fornecedor:", e);
        }
    }

    // Create invoice items
    if (matchedItems.length > 0) {
        await db.insert(farmInvoiceItems).values(
            matchedItems.map(item => ({
                invoiceId: invoice.id,
                productId: item.matchedProductId,
                productCode: item.productCode,
                productName: item.productName,
                unit: item.unit,
                quantity: String(item.quantity),
                unitPrice: isRemision ? "0" : String(item.unitPrice),
                discount: "0",
                totalPrice: isRemision ? "0" : String(item.totalPrice),
                batch: item.batch,
            }))
        );
    }

    const docLabel = isRemision ? "REMISION" : "FATURA";
    console.log(`[Invoice Email] Created draft ${docLabel} ${invoice.id} with ${matchedItems.length} items for farmer ${farmerId}`);

    return {
        invoiceId: invoice.id,
        supplier: extracted.supplier,
        totalAmount: extracted.totalAmount,
        currency: extracted.currency,
        itemCount: matchedItems.length,
        matchedCount: matchedItems.filter(i => i.matchedProductId).length,
        isRemision,
    };
}
