/**
 * Cliente Gemini AI para interpretar perguntas em linguagem natural
 * e gerar queries SQL ou ações baseadas no contexto do sistema
 */

interface GeminiConfig {
  apiKey: string;
  model?: string;
}

export interface QueryIntent {
  type: "query" | "action" | "conversation" | "unknown";
  entity: "stock" | "expenses" | "invoices" | "applications" | "properties" | "plots" | "general" | "unknown";
  filters?: Record<string, any>;
  question?: string;
  confidence: number;
  response?: string; // Resposta direta da IA para conversas gerais
}

interface InteractionContext {
  question: string;
  data: any;
  intent: QueryIntent;
}

export class GeminiClient {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(config: GeminiConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || "gemini-2.0-flash";
    this.baseUrl = "https://generativelanguage.googleapis.com/v1beta";
  }

  /**
   * Transcreve áudio usando a capacidade multimodal do Gemini
   */
  async transcribeAudio(audioUrl: string): Promise<string> {
    try {
      console.log(`[Gemini] Baixando áudio: ${audioUrl}`);
      // 1. Baixar o áudio
      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) throw new Error("Falha ao baixar áudio");

      const contentType = audioResponse.headers.get("content-type") || "audio/ogg";
      const arrayBuffer = await audioResponse.arrayBuffer();
      const base64Audio = Buffer.from(arrayBuffer).toString("base64");

      // 2. Enviar para Gemini
      const response = await fetch(
        `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: "Por favor, transcreva este áudio fielmente. Retorne APENAS o texto falado, sem comentários adicionais." },
                  {
                    inline_data: {
                      mime_type: contentType,
                      data: base64Audio
                    }
                  }
                ],
              },
            ],
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error("[Gemini] Erro na API de Transcrição:", data);
        return "";
      }

      const transcription = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      console.log(`[Gemini] Transcrição: "${transcription}"`);
      return transcription.trim();

    } catch (error) {
      console.error("[Gemini] Erro ao transcrever áudio:", error);
      return "";
    }
  }

  /**
   * Interpreta pergunta do usuário e retorna intenção estruturada
   */
  async interpretQuestion(question: string, userId: string, context?: any): Promise<QueryIntent> {
    try {
      const prompt = this.buildPrompt(question, userId, context);

      const response = await fetch(
        `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error("[Gemini] Erro na API:", data);
        return this.getDefaultIntent(question);
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      return this.parseResponse(text, question);
    } catch (error) {
      console.error("[Gemini] Erro ao interpretar pergunta:", error);
      return this.getDefaultIntent(question);
    }
  }

  private buildPrompt(question: string, userId: string, context?: any): string {
    return `Você é o AgroBot, um assistente inteligente do sistema AgroFarm.
Sua missão é ajudar o agricultor a gerenciar sua fazenda, mas você também deve ser educado, prestativo e capaz de manter uma conversa natural.

CONTEXTO DO SISTEMA:
- O sistema gerencia propriedades rurais, talhões, estoque de produtos, despesas, faturas e aplicações
- Entidades de dados: stock (estoque), expenses (despesas), invoices (faturas), applications (aplicações), properties (propriedades), plots (talhões)

CONTEXTO DA CONVERSA ANTERIOR:
${context ? JSON.stringify(context) : "Nenhum contexto anterior."}

PERGUNTA DO USUÁRIO:
"${question}"

INSTRUÇÕES:
1. Analise se o usuário quer consultar dados do sistema OU se é apenas uma conversa/pergunta geral.
2. Se for CONSULTA DE DADOS (ex: "quanto tenho de estoque?", "minhas faturas", "aplicações de ontem", "preço do glifosato"):
   - Defina "type": "query"
   - Defina "entity" com a tabela correta (stock, expenses, invoices, etc)
   - Extraia "filters" com chaves padronizadas:
     - "product": nome do produto (ex: "glifosato", "24d", "soja")
     - "period": "month" (mês atual), "last_month" (mês passado)
     - "category": categoria de despesa (diesel, mão de obra)
     - ATENÇÃO: Perguntas sobre "preço", "quanto paguei", "valor", "custo", "dívida", "quanto devo" ou "fatura" DEVEM ser "invoices" ou "expenses", NUNCA "stock".
     - CORREÇÃO: Corrija erros de digitação comuns em nomes de produtos (ex: "sphare" -> "Sphere", "gliphosato" -> "Glifosato").
     - CONTEXTO: Se o usuário usar pronomes como "nele", "disso", "do último" ou referir-se a um produto da pergunta anterior sem nomeá-lo, USE O FILTRO "product" DO CONTEXTO DA CONVERSA ANTERIOR.
     - IMPORTANTE: Se o usuário CITAR um novo produto (ex: "e o glifosato?"), IGNORE o contexto e use o NOME CITADO.
3. Se for CONVERSA GERAL, SAUDAÇÃO OU DÚVIDA AGRÍCOLA (ex: "bom dia", "quem é você?", "como combater ferrugem"):
   - Defina "type": "conversation"
   - Defina "entity": "general"
   - Gere uma resposta útil, curta e amigável no campo "response".

4. Retorne APENAS um JSON válido no formato:
{
  "type": "query|action|conversation|unknown",
  "entity": "stock|expenses|invoices|applications|properties|plots|general|unknown",
  "filters": { "product": "nome", "period": "mes", "category": "nome" },
  "confidence": 0.0-1.0,
  "response": "Texto da resposta (apenas se type=conversation)"
}

EXEMPLOS:
- "qual meu estoque?" → {"type":"query","entity":"stock","filters":{},"confidence":0.9}
- "quanto paguei no glifosato?" → {"type":"query","entity":"invoices","filters":{"product":"glifosato"},"confidence":0.9}
- "preço do 24d" → {"type":"query","entity":"invoices","filters":{"product":"24d"},"confidence":0.9}
- "gastos com diesel" → {"type":"query","entity":"expenses","filters":{"category":"diesel"},"confidence":0.9}
- "bom dia" → {"type":"conversation","entity":"general","response":"Bom dia! Como posso ajudar na fazenda hoje?","confidence":1.0}

RESPOSTA (apenas JSON, sem markdown):`;
  }

  private parseResponse(text: string, originalQuestion: string): QueryIntent {
    try {
      // Remove markdown code blocks se existirem
      const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);

      return {
        type: parsed.type || "unknown",
        entity: parsed.entity || "unknown",
        filters: parsed.filters || {},
        question: originalQuestion,
        confidence: parsed.confidence || 0.5,
        response: parsed.response,
      };
    } catch (error) {
      console.error("[Gemini] Erro ao parsear resposta:", error);
      return this.getDefaultIntent(originalQuestion);
    }
  }

  private getDefaultIntent(question: string): QueryIntent {
    // Fallback: tenta identificar por palavras-chave
    const lower = question.toLowerCase();

    if (lower.includes("estoque") || lower.includes("stock")) {
      return { type: "query", entity: "stock", filters: {}, confidence: 0.6, question };
    }
    if (lower.includes("despesa") || lower.includes("gastei") || lower.includes("custo")) {
      return { type: "query", entity: "expenses", filters: {}, confidence: 0.6, question };
    }
    if (lower.includes("fatura") || lower.includes("nota") || lower.includes("preço") || lower.includes("valor") || lower.includes("paguei") || lower.includes("devo") || lower.includes("debito") || lower.includes("dívida")) {
      return { type: "query", entity: "invoices", filters: {}, confidence: 0.6, question };
    }
    if (lower.includes("aplicação") || lower.includes("aplicado")) {
      return { type: "query", entity: "applications", filters: {}, confidence: 0.6, question };
    }

    // Fallback genérico melhorado
    return {
      type: "conversation",
      entity: "general",
      filters: {},
      confidence: 0.5,
      question,
      response: "Desculpe, tive um problema técnico momentâneo. Pode repetir?"
    };
  }

  /**
   * Gera resposta natural baseada nos dados encontrados
   */
  async generateNaturalResponse(data: any, intent: QueryIntent): Promise<string> {
    try {
      // Se não houver dados, retorna mensagem padrão da IA ou fallback
      if (!data || (Array.isArray(data) && data.length === 0)) {
        return "Desculpe, não encontrei nenhuma informação sobre isso no momento. 😕";
      }

      // Pre-process data to ensure numbers are numbers, avoiding "2.750" -> 2750 confusion
      const processedData = Array.isArray(data) ? data.map(item => {
        return {
          ...item,
          quantity: item.quantity ? parseFloat(item.quantity) : 0,
          averageCost: item.averageCost ? parseFloat(item.averageCost) : 0,
          lastPrice: item.lastPrice ? parseFloat(item.lastPrice) : null,
          currency: item.currency || "USD"
        };
      }) : data;

      // Limita dados para não estourar tokens
      const contextData = Array.isArray(processedData) ? processedData.slice(0, 15) : processedData;

      const prompt = `
Você é o AgroBot, assistente da AgroFarm.
O usuário perguntou: "${intent.question}"

Aqui estão os dados encontrados no sistema:
${JSON.stringify(contextData, null, 2)}

INSTRUÇÕES:
1. Responda à pergunta do usuário usando esses dados de forma natural e conversacional.
2. IMPORTANTE: Os dados abaixo pertencem ao USUÁRIO (agricultor). NUNCA diga "na AgroFarm temos". Sempre use "seu estoque", "sua fazenda", "registrado no sistema", "encontrei nas suas faturas".
3. NÃO pareça um robô. Seja prestativo como um agrônomo parceiro.
4. Use emojis adequados (📦, 💰, 🚜, etc).
5. Use negrito (*texto*) para destacar valores, nomes de produtos e totais.
6. Se for uma lista, organize com bullet points ou quebras de linha claras.
7. Se a lista for grande, resuma ou destaque os principais itens.
8. Mantenha a resposta curta e direta para leitura no WhatsApp.
9. PREÇOS E MOEDA: Respeite a moeda indicada nos dados (ex: "USD", "BRL"). Se o valor for "2.75", é "2,75", NÃO "2.750,00".
10. FIDELIDADE: Se os dados não corresponderem ao produto perguntado, diga que não encontrou. NÃO recomende outros produtos a menos que o usuário peça explicitamente.

RESPOSTA (apenas o texto final):`;

      const response = await fetch(
        `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );

      const responseData = await response.json();
      return responseData.candidates?.[0]?.content?.parts?.[0]?.text || "Aqui estão os dados que encontrei.";

    } catch (error) {
      console.error("[Gemini] Erro ao gerar resposta natural:", error);
      // Fallback para formatadores antigos se a IA falhar
      return this.formatResponse(data, intent);
    }
  }

  /**
   * Formata resposta amigável para o usuário
   */
  formatResponse(data: any, intent: QueryIntent): string {
    switch (intent.entity) {
      case "stock":
        return this.formatStockResponse(data);
      case "expenses":
        return this.formatExpensesResponse(data);
      case "invoices":
        return this.formatInvoicesResponse(data);
      case "applications":
        return this.formatApplicationsResponse(data);
      default:
        return "Desculpe, não consegui entender sua pergunta. Tente perguntar sobre:\n• Estoque\n• Despesas\n• Faturas\n• Aplicações";
    }
  }

  private formatStockResponse(data: any): string {
    if (!data || data.length === 0) {
      return "📦 *Estoque AgroFarm*\n\nNão encontrei produtos em estoque com esse critério.";
    }

    let message = "📦 *Seu Estoque Atual:*\n\n";

    data.slice(0, 15).forEach((item: any) => {
      const qty = parseFloat(item.quantity || 0);
      const unit = item.unit || "un";
      // Bolding the name and formatting number separately
      message += `🔹 *${item.productName || item.name}*\n     📦 ${qty.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ${unit}\n`;

      if (item.lastPrice) {
        const price = parseFloat(item.lastPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        const date = item.lastPriceDate ? new Date(item.lastPriceDate).toLocaleDateString("pt-BR") : "";
        const currency = item.currency === "USD" ? "USD" : "R$";
        message += `     💲 Última compra: ${currency} ${price} (${date})\n`;
      } else if (item.averageCost > 0) {
        const cost = parseFloat(item.averageCost).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        message += `     💲 Custo Médio: R$ ${cost}\n`;
      }
      message += "\n";
    });

    if (data.length > 15) {
      message += `\n... e mais ${data.length - 15} produtos.`;
    }

    return message;
  }

  private formatExpensesResponse(data: any): string {
    if (!data || data.length === 0) {
      return "💰 *Despesas AgroFarm*\n\nNenhuma despesa encontrada para este período/filtro.";
    }

    const total = data.reduce((sum: number, item: any) => sum + parseFloat(item.amount || 0), 0);
    let message = `💰 *Resumo de Despesas:*\n\n`;

    message += `📊 *Total:* R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
    message += `──────────────────\n`;

    data.slice(0, 5).forEach((item: any) => {
      const date = item.expenseDate ? new Date(item.expenseDate).toLocaleDateString("pt-BR") : "N/A";
      const amount = parseFloat(item.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

      message += `💸 *${item.category || "Despesa"}* - ${date}\n`;
      message += `     ${item.description || "Sem descrição"}\n`;
      message += `     *R$ ${amount}*\n\n`;
    });

    return message;
  }

  private formatInvoicesResponse(data: any): string {
    if (!data || data.length === 0) {
      return "📄 *Faturas AgroFarm*\n\nNenhuma fatura encontrada.";
    }

    let message = "📄 *Histórico de Compras:*\n\n";

    data.slice(0, 5).forEach((item: any) => {
      const date = item.issueDate ? new Date(item.issueDate).toLocaleDateString("pt-BR") : "N/A";
      const statusIcon = item.status === "confirmed" ? "✅" : "⏳";

      if (item.productName) {
        // Formato para busca de preço de produto específico (joined)
        const unitPrice = parseFloat(item.unitPrice || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        message += `🛒 *${item.productName}*\n`;
        message += `     Data: ${date}\n`;
        message += `     Qtd: ${item.quantity} ${item.unit}\n`;
        message += `     Preço Unit.: *R$ ${unitPrice}*\n`;
        message += `     Fornecedor: ${item.supplier || "N/A"}\n\n`;
      } else {
        // Formato genérico de fatura
        const total = parseFloat(item.totalAmount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        message += `${statusIcon} *Fatura ${item.invoiceNumber || "S/N"}*\n`;
        message += `     Data: ${date}\n`;
        message += `     Total: *R$ ${total}*\n`;
        message += `     Fornecedor: ${item.supplier || "N/A"}\n\n`;
      }
    });

    return message;
  }

  private formatApplicationsResponse(data: any): string {
    if (!data || data.length === 0) {
      return "🌾 Você não possui aplicações registradas.";
    }

    let message = "🌾 *Suas Aplicações:*\n\n";
    data.slice(0, 5).forEach((item: any) => {
      const date = item.appliedAt ? new Date(item.appliedAt).toLocaleDateString("pt-BR") : "N/A";
      message += `• ${item.productName}: ${parseFloat(item.quantity || 0).toFixed(2)} ${item.unit || "L"} no talhão ${item.plotName} (${date})\n`;
    });

    return message;
  }
}
