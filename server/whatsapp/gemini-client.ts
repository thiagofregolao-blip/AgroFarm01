/**
 * Cliente Gemini AI para interpretar perguntas em linguagem natural
 * e gerar queries SQL ou ações baseadas no contexto do sistema
 */

interface GeminiConfig {
  apiKey: string;
  model?: string;
}

interface QueryIntent {
  type: "query" | "action" | "unknown";
  entity: "stock" | "expenses" | "invoices" | "applications" | "properties" | "plots" | "unknown";
  filters?: Record<string, any>;
  question?: string;
  confidence: number;
}

export class GeminiClient {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(config: GeminiConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || "gemini-1.5-flash";
    this.baseUrl = "https://generativelanguage.googleapis.com/v1beta";
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
    return `Você é um assistente especializado em interpretar perguntas sobre um sistema de gestão agrícola.

CONTEXTO DO SISTEMA:
- O sistema gerencia propriedades rurais, talhões, estoque de produtos, despesas, faturas e aplicações
- O usuário tem ID: ${userId}
- Entidades disponíveis: stock (estoque), expenses (despesas), invoices (faturas), applications (aplicações), properties (propriedades), plots (talhões)

PERGUNTA DO USUÁRIO:
"${question}"

INSTRUÇÕES:
1. Identifique a intenção: "query" (consulta), "action" (ação) ou "unknown"
2. Identifique a entidade principal mencionada
3. Extraia filtros relevantes (datas, nomes, valores, etc.)
4. Retorne APENAS um JSON válido no formato:
{
  "type": "query|action|unknown",
  "entity": "stock|expenses|invoices|applications|properties|plots|unknown",
  "filters": { "key": "value" },
  "confidence": 0.0-1.0
}

EXEMPLOS:
- "qual meu estoque?" → {"type":"query","entity":"stock","filters":{},"confidence":0.9}
- "quanto gastei este mês?" → {"type":"query","entity":"expenses","filters":{"period":"month"},"confidence":0.9}
- "mostre minhas faturas" → {"type":"query","entity":"invoices","filters":{},"confidence":0.9}
- "quais produtos tenho em estoque?" → {"type":"query","entity":"stock","filters":{},"confidence":0.9}

RESPOSTA (apenas JSON, sem markdown, sem explicações):`;
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
    if (lower.includes("fatura") || lower.includes("nota")) {
      return { type: "query", entity: "invoices", filters: {}, confidence: 0.6, question };
    }
    if (lower.includes("aplicação") || lower.includes("aplicado")) {
      return { type: "query", entity: "applications", filters: {}, confidence: 0.6, question };
    }
    
    return { type: "unknown", entity: "unknown", filters: {}, confidence: 0.3, question };
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
      return "📦 Você não possui produtos em estoque no momento.";
    }

    let message = "📦 *Seu Estoque:*\n\n";
    data.slice(0, 10).forEach((item: any) => {
      message += `• ${item.productName || item.name}: ${parseFloat(item.quantity || 0).toFixed(2)} ${item.unit || "un"}\n`;
    });

    if (data.length > 10) {
      message += `\n... e mais ${data.length - 10} produtos`;
    }

    return message;
  }

  private formatExpensesResponse(data: any): string {
    if (!data || data.length === 0) {
      return "💰 Você não possui despesas registradas.";
    }

    const total = data.reduce((sum: number, item: any) => sum + parseFloat(item.amount || 0), 0);
    let message = `💰 *Suas Despesas:*\n\nTotal: R$ ${total.toFixed(2)}\n\n`;
    
    data.slice(0, 5).forEach((item: any) => {
      const date = item.expenseDate ? new Date(item.expenseDate).toLocaleDateString("pt-BR") : "N/A";
      message += `• ${item.category || "Outro"}: R$ ${parseFloat(item.amount || 0).toFixed(2)} (${date})\n`;
    });

    return message;
  }

  private formatInvoicesResponse(data: any): string {
    if (!data || data.length === 0) {
      return "📄 Você não possui faturas registradas.";
    }

    let message = "📄 *Suas Faturas:*\n\n";
    data.slice(0, 5).forEach((item: any) => {
      const date = item.issueDate ? new Date(item.issueDate).toLocaleDateString("pt-BR") : "N/A";
      const status = item.status === "confirmed" ? "✅ Confirmada" : "⏳ Pendente";
      message += `• ${item.invoiceNumber || "N/A"}: R$ ${parseFloat(item.totalAmount || 0).toFixed(2)} (${date}) - ${status}\n`;
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
