/**
 * Cliente Gemini AI para interpretar perguntas em linguagem natural
 * e gerar queries SQL ou ações baseadas no contexto do sistema
 */

interface GeminiConfig {
  apiKey: string;
  model?: string;
}

export interface QueryIntent {
  type: "query" | "action" | "conversation" | "recommendation" | "unknown";
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
    return `Você é o *AgroBot*, assistente virtual do AgroFarm — mas acima de tudo, você é um PARCEIRO do agricultor.

SUA PERSONALIDADE:
- Você é como um amigo agrônomo que manja de tecnologia 🧑‍🌾💻
- Fala de forma descontraída mas profissional, como se fosse um colega de campo
- Usa emojis com moderação (não exagere — 2 a 4 por mensagem)
- É simpático, motivador, e se importa com o sucesso do agricultor
- Fala em português brasileiro informal (mas não vulgar)
- Sabe dar dicas rápidas sobre agricultura quando perguntado
- Lembra do contexto da conversa e faz referências ao que foi falado antes
- Quando cumprimentado, responde com calor humano, menciona o clima ou a época de cultivo

CONTEXTO DO SISTEMA:
- Gerencia: estoque, despesas, faturas, aplicações, propriedades, talhões
- Entidades: stock, expenses, invoices, applications, properties, plots

CONVERSA ANTERIOR:
${context ? JSON.stringify(context) : "Primeiro contato."}

MENSAGEM DO USUÁRIO:
"${question}"

REGRAS:
1. Se for SAUDAÇÃO/CONVERSA (oi, bom dia, como vai, obrigado, tchau, piada):
   - type: "conversation", entity: "general"
   - No campo "response", escreva uma resposta QUENTE e HUMANA
   - Para "bom dia" → algo motivador sobre o dia na roça
   - Para "obrigado/valeu" → agradeça e diga que tá sempre ali
   - Para "tchau" → despeça-se caloroso, deseje boa safra
   - Para perguntas sobre você → conte quem você é de forma simpática

2. Se for CONSULTA AGRONÔMICA / RECOMENDAÇÃO (ex: "o que usar contra ferrugem?", "tem algo bom pra planta daninha?", "como controlar percevejo?", "qual herbicida usar?", "preciso de fungicida para soja"):
   - type: "recommendation", entity: "stock"
   - No campo "filters", extraia a "pest" (praga/doença/erva daninha) e opcionalmente a "crop" (cultura)
   - Ex: {"pest": "ferrugem", "crop": "soja"}
   - IMPORTANTE: NÃO responda direto — o sistema vai buscar o estoque do agricultor primeiro!

3. Se for CONSULTA DE DADOS (estoque, preço, fatura, despesa, aplicação):
   - type: "query", entity: a tabela certa
   - Extraia filters: product, period, category
   - "preço/valor/quanto paguei" → entity: "invoices"
   - Corrija erros de digitação em nomes de produtos

4. Se tiver CONTEXTO anterior e o usuário fizer referência ("e dele?", "desse produto"):
   - USE o filtro do contexto anterior

RETORNE APENAS JSON:
{
  "type": "query|conversation|recommendation|unknown",
  "entity": "stock|expenses|invoices|applications|properties|plots|general|unknown",
  "filters": { "product": "nome", "period": "month", "category": "nome", "pest": "praga/doença", "crop": "cultura" },
  "confidence": 0.0-1.0,
  "response": "Texto (apenas se type=conversation)"
}

EXEMPLOS:
- "Bom dia!" → {"type":"conversation","entity":"general","response":"Bom dia, parceiro! ☀️🚜 Que o sol esteja bonito aí no campo!","confidence":1.0}
- "Valeu, AgroBot!" → {"type":"conversation","entity":"general","response":"Tmj! 💪 Tô aqui sempre que precisar. Boas colheitas! 🌾","confidence":1.0}
- "Quanto tenho de estoque?" → {"type":"query","entity":"stock","filters":{},"confidence":0.9}
- "Preço do glifosato" → {"type":"query","entity":"invoices","filters":{"product":"glifosato"},"confidence":0.9}
- "O que usar contra ferrugem na soja?" → {"type":"recommendation","entity":"stock","filters":{"pest":"ferrugem","crop":"soja"},"confidence":0.95}
- "Tem algo no estoque pra planta daninha?" → {"type":"recommendation","entity":"stock","filters":{"pest":"planta daninha"},"confidence":0.9}
- "Qual herbicida usar pra capim?" → {"type":"recommendation","entity":"stock","filters":{"pest":"capim"},"confidence":0.9}
- "Como controlar percevejo?" → {"type":"recommendation","entity":"stock","filters":{"pest":"percevejo"},"confidence":0.9}

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
      const contextData = Array.isArray(processedData) ? processedData.slice(0, 30) : processedData;

      const prompt = `
Você é o *AgroBot*, parceiro do agricultor. Responda como um AMIGO agrônomo, não um robô.
O usuário perguntou: "${intent.question}"

Dados encontrados:
${JSON.stringify(contextData, null, 2)}

COMO RESPONDER:
1. Comece com uma frase amigável contextualizando (ex: "Dei uma olhada no seu estoque...")
2. Apresente os dados de forma LIMPA usando formatação WhatsApp:
   - *negrito* para nomes e valores importantes
   - Emojis como marcadores (📦 🔹 💰 🌱), NÃO bullets
   - Separadores: ─────────────────
3. Para ESTOQUE, mostre TODOS os produtos com este formato compacto:
   📦 *SEU ESTOQUE*
   ─────────────────
   🔹 *Produto* — X un
   🔹 *Outro* — Y lt
   ─────────────────
   📊 Total: X produtos
   ⚠️ NÃO mostre preços no estoque (a menos que o usuário peça)
   ⚠️ MOSTRE TODOS os produtos, NÃO omita nenhum!
4. Para PREÇOS/FATURAS:
   💰 *Produto*
   📄 Preço: $X,XX (data)
   🏪 Fornecedor: Nome
5. DEPOIS dos dados, adicione um COMENTÁRIO HUMANO breve:
   - Estoque negativo: "🚨 Opa, tem estoque negativo, bora resolver?"
   - Estoque ok: "Tudo certo! 💪"
6. Máximo 500 palavras. Seja DIRETO mas SIMPÁTICO.
7. Valores: use vírgula decimal (2,75 não 2.75)
8. Moeda: USD=$, BRL=R$, PYG=₲
9. NUNCA diga "AgroFarm tem" — é "SEU estoque", "SUAS faturas"

RESPOSTA (texto pronto para WhatsApp, sem markdown):`;

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

  /**
   * Gera recomendação agronômica cruzando estoque do agricultor com conhecimento técnico
   */
  async generateAgronomicRecommendation(stockData: any[], intent: QueryIntent): Promise<string> {
    try {
      const pest = intent.filters?.pest || "problema não especificado";
      const crop = intent.filters?.crop || "";

      // Preparar dados do estoque simplificados
      const stockSummary = stockData.map(item => ({
        nome: item.productName,
        ingredienteAtivo: item.activeIngredient,
        categoria: item.category,
        quantidade: parseFloat(item.quantity || 0),
        unidade: item.unit,
      }));

      const prompt = `
Você é um AGRÔNOMO PROFISSIONAL com 20 anos de experiência no campo, integrado ao AgroBot.
O agricultor está te consultando pelo WhatsApp e precisa de uma recomendação técnica.

PERGUNTA DO AGRICULTOR:
"${intent.question}"

PROBLEMA IDENTIFICADO: ${pest}${crop ? ` na cultura de ${crop}` : ""}

ESTOQUE DO AGRICULTOR (produtos que ele TEM disponível):
${JSON.stringify(stockSummary, null, 2)}

SUA MISSÃO:
1. Analise o estoque e identifique quais produtos são EFICAZES contra "${pest}"
   - Use seu conhecimento sobre ingredientes ativos e suas indicações
   - Considere herbicidas, fungicidas, inseticidas e adjuvantes conforme o caso
2. Para cada produto recomendado do estoque, explique:
   - POR QUE é bom para esse problema (mecanismo de ação)
   - DOSE recomendada aproximada (por hectare)
   - QUANDO aplicar (momento ideal)
3. Se NÃO encontrar produtos adequados no estoque:
   - Informe que o agricultor não tem o produto ideal
   - SUGIRA quais ingredientes ativos ele deveria comprar

FORMATO DE RESPOSTA (WhatsApp):
🧑‍🌾 *RECOMENDAÇÃO AGRONÔMICA*
─────────────────
🎯 *Problema:* ${pest}${crop ? ` (${crop})` : ""}

✅ *DO SEU ESTOQUE:*

🔹 *Nome do Produto*
   💊 Ingrediente ativo: X
   📏 Dose: X L/ha ou kg/ha
   ⏰ Aplicar: momento ideal
   💡 Por quê: explicação breve

[se não tiver produto adequado:]
⚠️ *PRODUTOS QUE VOCÊ PRECISA COMPRAR:*
Ingrediente ativo X (ex: produto comercial Y)

─────────────────
📌 *Dica:* [observação prática útil]

REGRAS:
- Máximo 400 palavras
- Seja TÉCNICO mas ACESSÍVEL (linguagem do campo)
- Use formatação WhatsApp (*negrito*)
- Valores decimais com vírgula
- Se não tiver certeza do ingrediente ativo, NÃO invente
- Sempre termine com uma dica prática

RESPOSTA (texto pronto para WhatsApp):`;

      const response = await fetch(
        `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );

      const responseData = await response.json();
      const text = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

      if (text) return text;

      return `🧑‍🌾 Não consegui analisar seu estoque para "${pest}" agora. Tente perguntar de outra forma ou consulte um agrônomo presencialmente. 🌱`;

    } catch (error) {
      console.error("[Gemini] Erro na recomendação agronômica:", error);
      return `❌ Erro ao gerar recomendação. Tente novamente em instantes.`;
    }
  }
}
