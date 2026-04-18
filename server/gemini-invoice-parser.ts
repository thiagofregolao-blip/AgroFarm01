/**
 * Shared Gemini Vision invoice parser
 * Used by both WhatsApp webhook and manual PDF/image import
 */

export interface GeminiParsedInvoice {
    type: "expense" | "invoice" | "romaneio" | "remision" | "unknown";
    totalAmount: number;
    description: string;
    category?: string;
    invoiceNumber: string;
    supplier: string;
    supplierRuc: string | null;
    supplierPhone: string | null;
    supplierEmail: string | null;
    supplierAddress: string | null;
    issueDate: string | null;
    dueDate: string | null;
    currency: string;
    paymentCondition: string | null;
    items: Array<{
        productName: string;
        productCode?: string;
        quantity: number;
        unit: string;
        unitPrice: number;
        totalPrice: number;
    }>;
    romaneioData?: any;
}

const GEMINI_PROMPT = `Você é um assistente do AgroFarm que classifica comprovantes agrícolas.

REGRA DE CLASSIFICAÇÃO (MUITO IMPORTANTE - siga à risca):

**romaneio** (Ticket/Boleta de Entrega de Grãos) — use quando a imagem contém:
- Ticket de pesagem de grãos (soja, milho, trigo, sorgo, girassol, arroz)
- Boleta de entrega em silo/cerealista/cooperativa (C.Vale, Agridesa, ADM, Cargill, Bunge, Coamo, etc.)
- Dados de pesagem: peso bruto, tara, peso líquido/neto
- Dados de classificação: umidade, impureza, avariados, corpo estranho
- Número de ticket/romaneio, placa de caminhão, motorista

**expense** (Despesa de Frota/Manutenção) — use quando os itens são:
- Peças de máquinas/veículos (porcas, parafusos, rolamentos, correias, filtros, ponta de eixo, etc.)
- Óleo de motor, lubrificantes, graxas
- Diesel, combustível, gasolina
- Serviços mecânicos, mão de obra, frete, transporte
- Pneus, baterias, peças automotivas
- Qualquer coisa relacionada a manutenção de tratores, colheitadeiras, caminhões, veículos

**invoice** (Fatura de Insumos Agrícolas) — use APENAS quando:
- O documento diz "FACTURA ELECTRONICA" ou "FACTURA" no cabecalho (NAO "Nota de Remision")
- Os itens são defensivos agrícolas (herbicidas, fungicidas, inseticidas, acaricidas): Glifosato, Atrazina, Flumitop, etc.
- Sementes (soja, milho, trigo, etc.)
- Fertilizantes e adubos (NPK, ureia, MAP, KCl, etc.)
- Adjuvantes, espalhantes, reguladores de crescimento
- Produtos fitossanitários em geral

**remision** (Nota de Remision / Guia de Remessa) — use quando:
- O TITULO/CABECALHO/TIMBRADO do documento diz "NOTA DE REMISION", "REMISION", "NOTA DE REMISSAO" ou "GUIA DE REMESSA". Olhe especificamente o topo, o timbrado, ou o canto superior direito — e ahi que o tipo do documento e declarado.
- E um comprovante de ENTREGA de mercadoria, NAO uma fatura de compra
- Geralmente NAO tem precos/valores, apenas produtos e quantidades
- Pode referenciar uma fatura associada ("Facturas asociadas")
- Tem dados de transporte (placa, motorista, km)
- ATENCAO: muitos documentos tem "NOTA DE REMISION" escrito no canto superior DIREITO enquanto o restante do documento parece uma fatura — MESMO ASSIM e remision!

**unknown** — quando não for possível determinar com certeza.

REGRA DE CLASSIFICACAO CORRETA:
1. Olhe o CABECALHO/TIMBRADO do documento (topo da pagina, caixa do timbrado, canto superior direito). Se diz "FACTURA" ou "FACTURA ELECTRONICA" → type="invoice". Se diz "NOTA DE REMISION" ou "REMISION" no titulo → type="remision".
2. IMPORTANTE — FALSOS POSITIVOS DE REMISSAO: faturas paraguaias frequentemente tem uma LINHA DE REFERENCIA no corpo tipo "REMISIONES: 001-004:0000596" ou "Facturas asociadas: ..." — isso e apenas uma REFERENCIA cruzada a um documento relacionado, NAO muda o tipo. Se o cabecalho diz "FACTURA", o type e "invoice" mesmo que a palavra "REMISIONES" apareca no corpo.
3. Se o documento tem TOTAL A PAGAR, PRECO UNITARIO e VALOR DE VENTA preenchidos com valores > 0 → quase sempre e "invoice" (remissoes normalmente nao tem precos).

Se for 'invoice', extraia TAMBÉM o fornecedor, o número da nota (se houver) e TODOS os produtos com quantidades, unidades e valores.

Se for 'romaneio', extraia os dados de pesagem no campo "romaneioData".

MUITO IMPORTANTE para romaneios:
- O campo "buyer" deve ser o nome da EMPRESA/SILO/COOPERATIVA que RECEBE a carga (ex: Unigranos S.A., C.Vale, Agridesa, ADM, Cargill, Bunge, Coamo).
- Este nome geralmente aparece no CABECALHO/LOGO do documento, no topo da pagina, como razao social da empresa emissora do ticket.
- NAO confunda com "Nombre o Razon Social" do DESTINATARIO/CLIENTE/PRODUTOR que ENTREGA a carga — esse e o agricultor/produtor, NAO o buyer.
- Se o documento tiver logo ou nome da empresa no topo (ex: "unigranos s.a.", "C.VALE SA"), ESSE e o buyer.
- O "Nombre o Razon Social" ou "RUC o CI del Destinatario" geralmente e o PRODUTOR que esta entregando grao — ignore esse nome para o campo buyer.

IMPORTANTE para faturas (invoice):
- Extraia a data de emissao ("Fecha y hora", "Data de emissao") no formato YYYY-MM-DD
- Extraia a data de vencimento ("Vencimiento", "Vencimento", "Due Date") no formato YYYY-MM-DD
- Extraia a moeda ("Moneda", "Currency"): "USD" para US Dollar, "PYG" para Guarani, "BRL" para Real
- Extraia as condicoes de pagamento ("Condicion de Venta": "Credito" ou "Contado")

IMPORTANTE - Dados do Fornecedor (EXTRAIA SEMPRE que disponivel no documento):
- "supplierRuc": o RUC ou CNPJ da empresa emissora (ex: "3538088-8", "80131506-9"). Procure por "RUC:", "R.U.C.", "CNPJ:"
- "supplierPhone": telefone da empresa emissora. Procure por "TELEFONO:", "Tel:", "Fone:"
- "supplierEmail": email da empresa emissora. Procure por "@" no cabecalho
- "supplierAddress": endereco completo da empresa emissora. Geralmente aparece abaixo do nome/RUC no cabecalho
- Se nao encontrar algum desses campos, retorne null para ele

Retorne APENAS UM JSON VALIDO no formato exato:
{
  "type": "expense" | "invoice" | "romaneio" | "remision" | "unknown",
  "totalAmount": 150.50,
  "description": "Breve resumo geral (ex: Compra de pecas para trator)",
  "category": "diesel" | "pecas" | "frete" | "mao_de_obra" | "outro",
  "invoiceNumber": "123456",
  "supplier": "Nome da Empresa Fornecedora",
  "supplierRuc": "3538088-8",
  "supplierPhone": "0983231599",
  "supplierEmail": "email@empresa.com",
  "supplierAddress": "Endereço completo da empresa",
  "issueDate": "2025-10-02",
  "dueDate": "2026-04-01",
  "currency": "USD",
  "paymentCondition": "Credito",
  "items": [
    {
      "productName": "Nome do Produto Exato da Nota",
      "quantity": 10.5,
      "unit": "LT",
      "unitPrice": 15.00,
      "totalPrice": 157.50
    }
  ],
  "romaneioData": {
    "ticketNumber": "12345",
    "buyer": "Nome da EMPRESA/SILO do cabecalho/logo do documento (ex: Unigranos S.A., C.Vale, Agridesa) - NAO e o produtor/destinatario",
    "crop": "Soja",
    "grossWeight": 43000,
    "tare": 15000,
    "netWeight": 28000,
    "moisture": 14.5,
    "impurities": 0.8,
    "finalWeight": 27500,
    "truckPlate": "ABC-1234",
    "driver": "Nome do Motorista",
    "deliveryDate": "2026-01-15",
    "pricePerTon": null,
    "currency": "USD",
    "discounts": {}
  }
}`;

/**
 * Parse a document (PDF or image) using Gemini 2.5 Flash Vision
 * Same engine used by WhatsApp webhook — unified extraction
 */
export async function parseWithGemini(fileBase64: string, mimeType: string): Promise<GeminiParsedInvoice> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY not configured");
    }

    // For PDFs, Gemini needs the correct mime type
    const geminiMime = mimeType === "application/pdf" ? "application/pdf" : mimeType;

    const callGemini = async (): Promise<{ text: string; rawData: any; httpStatus: number }> => {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                { text: GEMINI_PROMPT },
                                { inline_data: { mime_type: geminiMime, data: fileBase64 } }
                            ]
                        }
                    ],
                    generationConfig: { temperature: 0.1 }
                })
            }
        );
        const rawData = await response.json();
        const text = rawData.candidates?.[0]?.content?.parts?.[0]?.text || "";
        return { text, rawData, httpStatus: response.status };
    };

    const tryParse = (text: string): GeminiParsedInvoice | null => {
        const cleanJson = text.replace(/```json/gi, "").replace(/```/g, "").trim();
        if (!cleanJson) return null;
        try {
            return JSON.parse(cleanJson);
        } catch {
            return null;
        }
    };

    const diagnose = (rawData: any, httpStatus: number, text: string) => {
        const blockReason = rawData?.promptFeedback?.blockReason;
        const safetyRatings = rawData?.promptFeedback?.safetyRatings;
        const finishReason = rawData?.candidates?.[0]?.finishReason;
        const errMsg = rawData?.error?.message;
        console.error("[GEMINI_PARSER] Resposta invalida do Gemini:", JSON.stringify({
            httpStatus,
            finishReason,
            blockReason,
            safetyRatings,
            errMsg,
            textPreview: (text || "").substring(0, 300),
            rawPreview: JSON.stringify(rawData).substring(0, 500),
        }));
    };

    // First attempt
    let { text, rawData, httpStatus } = await callGemini();
    let parsed = tryParse(text);

    // Retry once on empty/invalid response — mas NAO em 429 (rate limit nao resolve em 1.5s
    // e duplicar chamada so agrava o problema de capacity do Gemini).
    if (!parsed && httpStatus !== 429) {
        diagnose(rawData, httpStatus, text);
        console.warn("[GEMINI_PARSER] Tentando novamente em 1.5s...");
        await new Promise(r => setTimeout(r, 1500));
        ({ text, rawData, httpStatus } = await callGemini());
        parsed = tryParse(text);
    }

    if (!parsed) {
        diagnose(rawData, httpStatus, text);
        const suffix = httpStatus === 429
            ? "Gemini retornou 429 (capacity/rate limit). Tente novamente em alguns minutos."
            : "Gemini retornou resposta inválida após retry. Veja log [GEMINI_PARSER] para detalhes.";
        throw new Error(suffix);
    }

    // Normalize fields
    parsed.invoiceNumber = parsed.invoiceNumber || "";
    parsed.supplier = parsed.supplier || "Fornecedor Desconhecido";
    parsed.currency = parsed.currency || "USD";
    parsed.totalAmount = parseFloat(String(parsed.totalAmount)) || 0;
    parsed.items = Array.isArray(parsed.items) ? parsed.items : [];
    parsed.supplierRuc = parsed.supplierRuc || null;
    parsed.supplierPhone = parsed.supplierPhone || null;
    parsed.supplierEmail = parsed.supplierEmail || null;
    parsed.supplierAddress = parsed.supplierAddress || null;

    return parsed;
}
