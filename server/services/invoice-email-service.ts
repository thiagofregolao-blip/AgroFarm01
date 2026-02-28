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

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

interface ExtractedInvoice {
    invoiceNumber: string | null;
    supplier: string;
    issueDate: string | null; // ISO date
    currency: string;
    totalAmount: number;
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
 * Extract invoice data from a PDF using Gemini Vision AI
 */
export async function extractInvoiceFromPdf(pdfBase64: string): Promise<ExtractedInvoice> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY não configurada");

    const prompt = `Você é um especialista em leitura de faturas/notas fiscais de empresas agrícolas.
Analise este PDF de fatura e extraia TODOS os dados estruturados.

RETORNE APENAS UM JSON VÁLIDO no formato exato abaixo:
{
    "invoiceNumber": "Número da nota/fatura (ou null se não encontrar)",
    "supplier": "Nome da empresa fornecedora",
    "issueDate": "Data de emissão no formato YYYY-MM-DD (ou null)",
    "currency": "USD, PYG ou BRL (identifique pela moeda usada nos valores)",
    "totalAmount": 0.00,
    "items": [
        {
            "productName": "NOME DO PRODUTO EM MAIÚSCULAS",
            "productCode": "Código do produto (ou null)",
            "quantity": 0.00,
            "unit": "LT, KG, UNI, SC ou outra unidade",
            "unitPrice": 0.00,
            "totalPrice": 0.00,
            "batch": "Número do lote (ou null)"
        }
    ]
}

REGRAS:
1. Extraia TODOS os itens da fatura, não omita nenhum.
2. Se os valores tiverem separador de milhar com ponto e decimal com vírgula (ex: 1.500,00), converta para número decimal (1500.00).
3. Se os valores usarem ponto como decimal (ex: 1500.00), mantenha assim.
4. Os nomes dos produtos devem ser em MAIÚSCULAS.
5. Se a moeda for guarani (₲ ou Gs), use "PYG". Se for dólar ($, USD, U$), use "USD". Se for real (R$), use "BRL".
6. Se não encontrar algum campo, use null.
7. totalAmount deve ser a soma de todos os itens OU o valor total da fatura.

RESPONDA APENAS JSON, sem texto adicional.`;

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{
                parts: [
                    { text: prompt },
                    {
                        inline_data: {
                            mime_type: "application/pdf",
                            data: pdfBase64
                        }
                    }
                ]
            }],
            generationConfig: {
                temperature: 0.1,
            }
        })
    });

    const data = await response.json();

    if (!response.ok) {
        console.error("[Invoice Email] Gemini API Error:", data);
        throw new Error(data.error?.message || "Falha na API Gemini");
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();

    try {
        const parsed = JSON.parse(cleanJson);
        return {
            invoiceNumber: parsed.invoiceNumber || null,
            supplier: parsed.supplier || "Fornecedor não identificado",
            issueDate: parsed.issueDate || null,
            currency: parsed.currency || "USD",
            totalAmount: typeof parsed.totalAmount === "number" ? parsed.totalAmount : 0,
            items: Array.isArray(parsed.items) ? parsed.items.map((item: any) => ({
                productName: item.productName || "Produto não identificado",
                productCode: item.productCode || null,
                quantity: typeof item.quantity === "number" ? item.quantity : 0,
                unit: item.unit || "UNI",
                unitPrice: typeof item.unitPrice === "number" ? item.unitPrice : 0,
                totalPrice: typeof item.totalPrice === "number" ? item.totalPrice : 0,
                batch: item.batch || null,
            })) : [],
        };
    } catch (e) {
        console.error("[Invoice Email] Failed to parse Gemini response:", cleanJson);
        throw new Error("A IA não retornou um formato JSON válido para esta fatura.");
    }
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

    // Get active season
    let seasonId: string | null = null;
    try {
        const { pool } = await import("../db");
        const isNeon = (process.env.DATABASE_URL || "").includes("neon.tech");
        let rows: any[];
        if (isNeon) {
            const result = await pool.query(
                "SELECT id FROM farm_seasons WHERE farmer_id = $1 AND is_active = true LIMIT 1",
                [farmerId]
            );
            rows = result.rows || [];
        } else {
            rows = await pool.unsafe(
                "SELECT id FROM farm_seasons WHERE farmer_id = $1 AND is_active = true LIMIT 1",
                [farmerId]
            );
        }
        seasonId = rows[0]?.id || null;
    } catch (e) {
        console.error("[Invoice Email] Error getting season:", e);
    }

    // Match products with catalog
    const matchedItems = await matchProducts(farmerId, extracted.items);

    // Create the invoice
    const [invoice] = await db.insert(farmInvoices).values({
        farmerId,
        seasonId,
        invoiceNumber: extracted.invoiceNumber,
        supplier: extracted.supplier,
        issueDate: extracted.issueDate ? new Date(extracted.issueDate) : null,
        currency: extracted.currency,
        totalAmount: String(extracted.totalAmount),
        status: "pending",
        source: "email_import",
        sourceEmailId: emailId,
        sourceEmailFrom: emailFrom,
        rawPdfData: rawPdfText || "PDF processado via Gemini AI",
        pdfBase64: pdfBase64 || null,
    } as any).returning();

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
                unitPrice: String(item.unitPrice),
                discount: "0",
                totalPrice: String(item.totalPrice),
                batch: item.batch,
            }))
        );
    }

    console.log(`[Invoice Email] Created draft invoice ${invoice.id} with ${matchedItems.length} items for farmer ${farmerId}`);

    return {
        invoiceId: invoice.id,
        supplier: extracted.supplier,
        totalAmount: extracted.totalAmount,
        currency: extracted.currency,
        itemCount: matchedItems.length,
        matchedCount: matchedItems.filter(i => i.matchedProductId).length,
    };
}
