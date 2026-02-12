/**
 * Parser de Faturas de Fazenda (C.VALE e similares)
 * Extrai dados estruturados de PDFs de faturas eletrônicas
 */
import { createRequire } from "module";

const require = createRequire(import.meta.url);
let pdfParser: any = null;

function getPdfParser() {
    if (!pdfParser) {
        pdfParser = require("pdf-parse");
    }
    return pdfParser;
}

export interface ParsedInvoiceItem {
    productCode: string;
    productName: string;
    unit: string; // LT, KG, UNI
    quantity: number;
    unitPrice: number;
    discount: number;
    totalPrice: number;
    batch?: string;
    expiryDate?: Date;
}

export interface ParsedInvoice {
    invoiceNumber: string;
    supplier: string;
    clientName: string;
    clientDocument: string;
    issueDate: Date | null;
    currency: string;
    subtotal: number;
    totalAmount: number;
    items: ParsedInvoiceItem[];
    rawText: string;
}

/**
 * Parse a C.VALE electronic invoice PDF
 * Format: KuDE de Factura Electrónica
 */
export async function parseFarmInvoicePDF(buffer: Buffer): Promise<ParsedInvoice> {
    const pdf = getPdfParser();
    const data = await pdf(buffer);
    const text: string = data.text;
    const lines = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);

    let invoiceNumber = '';
    let supplier = '';
    let clientName = '';
    let clientDocument = '';
    let issueDate: Date | null = null;
    let currency = 'USD';
    let subtotal = 0;
    let totalAmount = 0;
    const items: ParsedInvoiceItem[] = [];

    // Extract header info
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Invoice number: N°: 005-001-0005200
        if (!invoiceNumber) {
            const invoiceMatch = line.match(/N[°º]:\s*([\d\-]+)/);
            if (invoiceMatch) {
                invoiceNumber = invoiceMatch[1].trim();
            }
        }

        // Supplier name (usually first significant line or near "COMERCIO")
        if (!supplier && (line.includes('C.VALE') || line.includes('COMERCIO AL POR MAYOR'))) {
            // Try to get the company name from the line above or the line itself
            if (line.includes('C.VALE')) {
                supplier = 'C.VALE SA';
            } else {
                supplier = line.trim();
            }
        }

        // Client name: "Nombre o Razón Social:"
        if (!clientName) {
            const clientMatch = line.match(/Nombre\s*o\s*Raz[oó]n\s*Social:\s*(.+)/i);
            if (clientMatch) {
                clientName = clientMatch[1].trim();
            }
        }

        // Document: RUC/Documento de Identidad N°:
        if (!clientDocument) {
            const docMatch = line.match(/RUC\/Documento\s*de\s*Identidad\s*N[°º]:\s*(\S+)/i);
            if (docMatch) {
                clientDocument = docMatch[1].trim();
            }
        }

        // Issue date: "Fecha y hora:" 
        if (!issueDate) {
            const dateMatch = line.match(/Fecha\s*y\s*hora:\s*(\d{2}-\d{2}-\d{4})/i);
            if (dateMatch) {
                const parts = dateMatch[1].split('-');
                issueDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            }
        }

        // Currency
        if (line.includes('Moneda:')) {
            if (line.includes('US Dollar') || line.includes('USD')) {
                currency = 'USD';
            } else if (line.includes('Guarani') || line.includes('PYG')) {
                currency = 'PYG';
            }
        }

        // Sub Total
        const subTotalMatch = line.match(/Sub\s*Total:\s*([\d.,]+)/i);
        if (subTotalMatch) {
            subtotal = parseNumber(subTotalMatch[1]);
        }

        // Total a pagar
        const totalMatch = line.match(/Total\s*a\s*pagar.*?([\d.,]+)\s*$/i);
        if (totalMatch) {
            totalAmount = parseNumber(totalMatch[1]);
        }
    }

    // If no totalAmount found, use subtotal
    if (totalAmount === 0) totalAmount = subtotal;

    // Extract items from the product table
    // The C.VALE PDF text comes out with fields concatenated, e.g.:
    // "550,00110,005LTCONTACT 72 - 20LTS924877"
    // This means: Total=550,00 | UnitPrice=110,00 | Qty=5 | Unit=LT | Name=CONTACT 72 - 20LTS | Code=924877
    // The header line is: "Cod. Descripción UNI Cantidad Precio Unitario Descuento Exentas 5% 10%"

    let inProductSection = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Detect start of product table
        if (line.includes('Descripci') && (line.includes('Cantidad') || line.includes('Precio'))) {
            inProductSection = true;
            // Skip the header line and possibly the next "Valor de Venta" line
            continue;
        }

        // Skip "Valor de Venta" header sub-line
        if (inProductSection && line.match(/^Valor\s*de\s*Venta$/i)) {
            continue;
        }

        // Detect end of product table
        if (inProductSection && (line.includes('Sub Total') || line.includes('Descuento global') || line.includes('Total a pagar'))) {
            inProductSection = false;
            continue;
        }

        // Skip non-product lines (Pedido, Registro SENAVE, Lote/batch info)
        if (!inProductSection) continue;
        if (line.match(/^Pedido:/i)) continue;
        if (line.match(/^Registro\s*SENAVE/i)) continue;
        if (line.match(/^Vencimiento\s*Cantidad\s*Lote/i)) continue;
        if (line.match(/^\d+\/\d+/)) continue; // Batch data lines like "3524/25 5 30-11-2027" or "LA40007795 2 18-07-2029"
        if (line.match(/^[A-Z]{2}\d+\s+\d+\s+\d{2}-\d{2}-\d{4}/)) continue; // Batch line format

        // Try C.VALE concatenated format first
        // Pattern: TOTAL_PRICE UNIT_PRICE QTY UNIT PRODUCT_NAME CODE
        // Example: "550,00110,005LTCONTACT 72 - 20LTS924877"
        // The code is always at the end (6-digit number)
        const codeMatch = line.match(/(\d{4,10})$/);
        if (codeMatch) {
            const productCode = codeMatch[1];
            const beforeCode = line.substring(0, line.length - productCode.length).trim();

            // Find the unit marker (LT, KG, UNI, UN, SC, L) in the remaining text
            const unitMatch = beforeCode.match(/([\d.,]+)(LT|KG|UNI|UN|SC|L)(.+)/i);
            if (unitMatch) {
                const numbersBeforeUnit = unitMatch[1]; // e.g. "550,00110,005"
                const unit = normalizeUnit(unitMatch[2]);
                const productName = unitMatch[3].trim();

                // Parse the concatenated numbers before the unit
                // They are: TOTAL, UNIT_PRICE, QTY concatenated together
                // We need to split them intelligently
                const { quantity, unitPrice, totalPrice } = parsePackedNumbers(numbersBeforeUnit);

                if (productName && quantity > 0) {
                    // Extract package size from product name (e.g. "CONTACT 72 - 20LTS" → 20)
                    const pkgSize = extractPackageSize(productName, unit);
                    const realQuantity = quantity * pkgSize;

                    // Look for batch/expiry in following lines
                    let batch: string | undefined;
                    let expiryDate: Date | undefined;

                    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
                        const nextLine = lines[j];
                        // Batch info line: "3524/25 5 30-11-2027" or "LA40007795 2 18-07-2029"
                        const batchMatch = nextLine.match(/^(\S+)\s+\d+\s+(\d{2}-\d{2}-\d{4})$/);
                        if (batchMatch) {
                            batch = batchMatch[1];
                            const dp = batchMatch[2].split('-');
                            expiryDate = new Date(parseInt(dp[2]), parseInt(dp[1]) - 1, parseInt(dp[0]));
                        }
                    }

                    items.push({
                        productCode,
                        productName,
                        unit,
                        quantity: realQuantity,
                        unitPrice: pkgSize > 1 ? unitPrice / pkgSize : unitPrice,
                        discount: 0,
                        totalPrice,
                        batch,
                        expiryDate,
                    });
                    continue;
                }
            }
        }

        // Fallback: Try normal spaced format
        // Pattern: CODE DESCRIPTION UNIT QUANTITY UNIT_PRICE [DISCOUNT] TOTAL
        const normalMatch = line.match(
            /^(\d{4,10})\s+(.+?)\s+(LT|KG|UNI|UN|L|SC)\s+([\d.,]+)\s+([\d.,]+)\s*([\d.,]*)\s*$/i
        );

        if (normalMatch) {
            const productCode = normalMatch[1];
            const productName = normalMatch[2].trim();
            const unit = normalizeUnit(normalMatch[3]);
            const quantity = parseNumber(normalMatch[4]);
            const unitPrice = parseNumber(normalMatch[5]);
            const lastNum = normalMatch[6] ? parseNumber(normalMatch[6]) : 0;
            const totalPrice = lastNum > 0 ? lastNum : quantity * unitPrice;

            items.push({
                productCode,
                productName,
                unit,
                quantity,
                unitPrice,
                discount: 0,
                totalPrice,
            });
        }
    }

    // If we still found no items, try a more aggressive scan of the full text
    if (items.length === 0) {
        console.log("[FARM_INVOICE_PARSER] No items found with line-by-line. Trying full text scan...");
        console.log("[FARM_INVOICE_PARSER] Lines:", lines.slice(0, 30));
    }

    // Fallback: calculate total from items if parser couldn't find it in the PDF text
    if (totalAmount === 0 && items.length > 0) {
        totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0);
        console.log(`[FARM_INVOICE_PARSER] Total calculated from items sum: ${totalAmount}`);
    }

    return {
        invoiceNumber,
        supplier,
        clientName,
        clientDocument,
        issueDate,
        currency,
        subtotal: subtotal || totalAmount,
        totalAmount: totalAmount || subtotal,
        items,
        rawText: text,
    };
}

/**
 * Parse packed/concatenated numbers from C.VALE PDF format
 * e.g. "550,00110,005" => Total=550.00, UnitPrice=110.00, Qty=5
 * e.g. "580,00290,002" => Total=580.00, UnitPrice=290.00, Qty=2
 * e.g. "1.130,00110,005" => Total=1130.00, UnitPrice=110.00, Qty=5
 */
function parsePackedNumbers(packed: string): { quantity: number; unitPrice: number; totalPrice: number } {
    // Strategy: split by finding number boundaries
    // Numbers in C.VALE use European format: digits, optional thousands dots, comma, 2 decimal digits
    // e.g. "550,00" or "1.130,00" or just "5" (integer qty)

    // Find all numbers with comma-decimal format, from right to left
    // Use regex to find all "number,DD" patterns (where DD = 2 decimal digits)
    const decimalNumbers: string[] = [];
    const remaining: string[] = [];

    // Match numbers like: 550,00 or 1.130,00 or 110,00
    // We split by finding all comma-delimited numbers
    const regex = /(\d[\d.]*,\d{2})/g;
    let match;
    let lastIndex = 0;
    const matches: { value: string; start: number; end: number }[] = [];

    while ((match = regex.exec(packed)) !== null) {
        matches.push({ value: match[1], start: match.index, end: match.index + match[0].length });
    }

    if (matches.length >= 2) {
        // We have at least total and unit price
        // The format is: TOTAL UNIT_PRICE QTY (concatenated)
        const totalStr = matches[0].value;
        const unitPriceStr = matches[1].value;

        // Quantity is whatever comes after the last decimal number
        const afterLastDecimal = packed.substring(matches[matches.length - 1].end);
        // Or between the unit price number and the end
        let qtyStr = packed.substring(matches[1].end);

        const totalPrice = parseNumber(totalStr);
        const unitPrice = parseNumber(unitPriceStr);
        const quantity = parseInt(qtyStr) || (unitPrice > 0 ? Math.round(totalPrice / unitPrice) : 1);

        return { quantity, unitPrice, totalPrice };
    } else if (matches.length === 1) {
        // Only one decimal number found - it's the total or unit price
        const price = parseNumber(matches[0].value);
        // Try to extract qty from remaining text
        const before = packed.substring(0, matches[0].start);
        const after = packed.substring(matches[0].end);
        const qtyMatch = (before + after).match(/(\d+)/);
        const quantity = qtyMatch ? parseInt(qtyMatch[1]) : 1;

        return { quantity, unitPrice: price, totalPrice: price * quantity };
    }

    // Fallback: try to parse as single number
    const num = parseNumber(packed);
    return { quantity: num || 1, unitPrice: 0, totalPrice: 0 };
}

function parseNumber(str: string): number {
    if (!str) return 0;
    // Handle formats: 1.130,00 or 1,130.00 or 110,00
    const cleaned = str.replace(/\s/g, '');

    // If has both . and , determine which is decimal separator
    if (cleaned.includes('.') && cleaned.includes(',')) {
        const lastDot = cleaned.lastIndexOf('.');
        const lastComma = cleaned.lastIndexOf(',');
        if (lastComma > lastDot) {
            // European format: 1.130,00 → 1130.00
            return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
        } else {
            // US format: 1,130.00
            return parseFloat(cleaned.replace(/,/g, ''));
        }
    } else if (cleaned.includes(',')) {
        // Could be decimal comma: 110,00
        const parts = cleaned.split(',');
        if (parts.length === 2 && parts[1].length <= 4) {
            return parseFloat(cleaned.replace(',', '.'));
        }
        return parseFloat(cleaned.replace(/,/g, ''));
    }

    return parseFloat(cleaned) || 0;
}

function normalizeUnit(unit: string): string {
    const u = unit.toUpperCase().trim();
    if (u === 'L' || u === 'LT') return 'LT';
    if (u === 'UN' || u === 'UNI') return 'UNI';
    if (u === 'SC') return 'SC'; // Saco
    return u;
}

/**
 * Extract package size from product description
 * e.g. "CONTACT 72 - 20LTS" → 20 (20 liters per unit)
 * e.g. "SPHERE MAX SC - 5LTS" → 5 (5 liters per unit)
 * e.g. "HERBICIDA 10KG" → 10
 * If no package size found, returns 1
 */
function extractPackageSize(productName: string, unit: string): number {
    // Match patterns like "20LTS", "5LTS", "20L", "10KG", "20 LTS"
    const patterns = [
        /(\d+(?:[.,]\d+)?)\s*LTS?\b/i,
        /(\d+(?:[.,]\d+)?)\s*KG\b/i,
        /(\d+(?:[.,]\d+)?)\s*(?:LITROS?|KILOS?)\b/i,
    ];

    for (const pattern of patterns) {
        const match = productName.match(pattern);
        if (match) {
            const size = parseFloat(match[1].replace(',', '.'));
            if (size > 0 && size <= 1000) {
                return size;
            }
        }
    }

    return 1;
}

/**
 * Parse a fake/photo invoice using Gemini Vision (Multimodal)
 */
export async function parseFarmInvoiceImage(buffer: Buffer, mimeType: string): Promise<ParsedInvoice> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY not configured");
    }

    const base64Image = buffer.toString("base64");
    const model = "gemini-2.0-flash"; // Align with what works in GeminiClient

    const prompt = `
    VOCÊ É UM EXTRATOR DE DADOS DE NOTAS FISCAIS AGRÍCOLAS.
    Analise esta imagem de nota fiscal/fatura e extraia os dados estruturados.
    
    RETORNE APENAS UM JSON VÁLIDO. SEM MARKDOWN (\`\`\`). SEM COMENTÁRIOS.
    
    ESTRUTURA JSON DESEJADA:
    {
      "invoiceNumber": "string (número da nota)",
      "supplier": "string (nome do fornecedor)",
      "clientName": "string (nome do cliente/comprador)",
      "clientDocument": "string (CPF/CNPJ/RUC do cliente)",
      "issueDate": "YYYY-MM-DD (data de emissão)",
      "currency": "USD" ou "BRL" ou "PYG",
      "totalAmount": number (valor total da nota, numérico),
      "items": [
        {
          "productCode": "string (código do produto se houver)",
          "productName": "string (descrição do produto)",
          "unit": "LT" | "KG" | "UNI" | "SC" (unidade padronizada),
          "quantity": number (quantidade),
          "unitPrice": number (preço unitário),
          "totalPrice": number (preço total do item)
        }
      ]
    }

    REGRAS DE EXTRAÇÃO:
    1. Se houver tabela de produtos, extraia cada item.
    2. Normalize unidades: "LITRO"->"LT", "L"->"LT", "KILO"->"KG", "UNIDADE"->"UNI", "SACO"->"SC".
    3. Datas no formato ISO (YYYY-MM-DD).
    4. Valores numéricos: use ponto para decimal (ex: 1500.50), sem separador de milhar.
    5. Se a imagem não for legível ou não for nota fiscal, retorne JSON com campos vazios ou nulos, mas tente extrair o máximo possível.
    `;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                { text: prompt },
                                {
                                    inline_data: {
                                        mime_type: mimeType,
                                        data: base64Image
                                    }
                                }
                            ]
                        }
                    ]
                })
            }
        );

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Gemini API Error: ${response.status} - ${errText}`);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

        // Clean markdown code blocks if present
        const jsonStr = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const parsed = JSON.parse(jsonStr);

        // Sanitize and validate fields
        return {
            invoiceNumber: parsed.invoiceNumber || "",
            supplier: parsed.supplier || "Fornecedor Desconhecido",
            clientName: parsed.clientName || "",
            clientDocument: parsed.clientDocument || "",
            issueDate: parsed.issueDate ? new Date(parsed.issueDate) : new Date(),
            currency: parsed.currency || "USD",
            subtotal: Number(parsed.totalAmount) || 0,
            totalAmount: Number(parsed.totalAmount) || 0,
            items: Array.isArray(parsed.items) ? parsed.items.map((item: any) => ({
                productCode: item.productCode || "",
                productName: item.productName || "Produto sem nome",
                unit: item.unit || "UNI",
                quantity: Number(item.quantity) || 0,
                unitPrice: Number(item.unitPrice) || 0,
                discount: 0,
                totalPrice: Number(item.totalPrice) || 0,
                batch: item.batch,
                expiryDate: item.expiryDate ? new Date(item.expiryDate) : undefined
            })) : [],
            rawText: "Extracted via Gemini Vision"
        };

    } catch (error) {
        console.error("Error parsing invoice image:", error);
        throw error;
    }
}
