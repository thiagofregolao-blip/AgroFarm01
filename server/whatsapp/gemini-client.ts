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
   * Interpreta resposta livre (texto ou áudio transcrito) durante conversa multi-etapa.
   * Extrai equipamento, conta, tipo de pagamento e vencimento de uma frase natural.
   */
  async interpretExpenseResponse(
    message: string,
    context: {
      step: string;
      equipmentList?: { id: string; name: string }[];
      accountList?: { id: string; name: string; currency: string }[];
    }
  ): Promise<{
    equipmentIndex?: number;
    accountIndex?: number;
    paymentType?: string; // a_vista, a_prazo, financiado
    paymentMethod?: string; // efetivo, transferencia, cheque, cartao, pix
    isPaid?: boolean;
    dueDate?: string;
    installments?: number;
    skipEquipment?: boolean;
    understood: boolean;
  }> {
    try {
      const equipNames = context.equipmentList?.map((e, i) => `${i + 1}. ${e.name}`) || [];
      const acctNames = context.accountList?.map((a, i) => `${i + 1}. ${a.name} (${a.currency})`) || [];

      const prompt = `Você é um assistente agrícola. O agricultor respondeu com uma mensagem de texto ou áudio sobre uma despesa.
Extraia as informações da mensagem dele. Responda SOMENTE com JSON válido sem markdown.

Etapa atual: ${context.step}

${equipNames.length > 0 ? `Máquinas/veículos cadastrados:\n${equipNames.join("\n")}` : ""}
${acctNames.length > 0 ? `Contas bancárias cadastradas:\n${acctNames.join("\n")}` : ""}

Mensagem do agricultor: "${message}"

Extraia o que for possível:
- equipmentIndex: número (1-based) da máquina mencionada, ou null. Se ele disser "nenhuma" ou "nenhum", retorne -1.
- accountIndex: número (1-based) da conta mencionada, ou null. Busque por nome parcial.
- paymentType: "a_vista" se pagou à vista/já pagou, "a_prazo" se comprou a prazo/fiado/30 dias, "financiado" se financiou/parcelou. null se não mencionou.
- paymentMethod: "efetivo" (dinheiro/cash), "transferencia" (transferência/TED/PIX), "cheque", "cartao" (cartão). null se não mencionou.
- isPaid: true se já pagou, false se ainda não pagou / vai pagar depois. null se não mencionou.
- dueDate: data de vencimento em formato "YYYY-MM-DD" se mencionou (ex: "vence dia 15" = próximo dia 15). null se não mencionou.
- installments: número de parcelas se mencionou parcelamento. null se não mencionou.
- skipEquipment: true se disse "nenhuma máquina" ou similar.
- understood: true se conseguiu extrair pelo menos uma informação útil.

Responda SOMENTE JSON:`;

      const response = await fetch(
        `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1 },
          }),
        }
      );

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      console.log(`[Gemini] Interpretação de resposta livre:`, parsed);
      return parsed;
    } catch (error) {
      console.error("[Gemini] Erro ao interpretar resposta:", error);
      return { understood: false };
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

REGRAS (aplique na ORDEM abaixo — a primeira que bater vence):

1. ⚡ CONSULTA DE ESTOQUE POR CATEGORIA — PRIORIDADE MÁXIMA
   Padrões: "quais [categoria] tenho", "meu estoque de [categoria]", "liste [categoria]", "mostre [categoria]", "estoque [categoria]", "tenho [categoria]"
   Categorias: fungicida, herbicida, inseticida, fertilizante, semente, adjuvante (e plurais: fungicidas, herbicidas, etc.)
   → type: "query", entity: "stock", filters: {"category": "[categoria no singular]"}
   ⚠️ NUNCA classifique isso como recommendation ou conversation!

2. CONSULTA DE DADOS (estoque geral, preço, fatura, despesa, aplicação):
   - type: "query", entity: a entidade certa
   - "preço/valor/quanto paguei/custou" → entity: "invoices", filters: {"product": "nome"}
   - "meu estoque" (sem categoria) → entity: "stock", filters: {}
   - "despesa/gasto" → entity: "expenses"
   - Corrija erros de digitação em nomes de produtos

3. CONSULTA AGRONÔMICA / RECOMENDAÇÃO — quando perguntar O QUE USAR CONTRA uma praga/doença:
   Padrões: "o que usar contra X", "tem algo pra X", "como controlar X", "qual produto pra X"
   → type: "recommendation", entity: "stock", filters: {"pest": "X", "crop": "cultura se mencionada"}
   ⚠️ NÃO é recomendação quando o usuário pergunta "quais fungicidas TENHO" — isso é consulta de categoria (regra 1)!

4. SAUDAÇÃO/CONVERSA (oi, bom dia, como vai, obrigado, tchau, piada, perguntas sobre você):
   - type: "conversation", entity: "general", response: "Texto quente e humano"

5. Se tiver CONTEXTO anterior e o usuário fizer referência ("e dele?", "desse produto"):
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
- "Quais fungicidas tenho?" → {"type":"query","entity":"stock","filters":{"category":"fungicida"},"confidence":0.95}
- "Liste todos os herbicidas do meu estoque" → {"type":"query","entity":"stock","filters":{"category":"herbicida"},"confidence":0.95}
- "Quero ver meus inseticidas" → {"type":"query","entity":"stock","filters":{"category":"inseticida"},"confidence":0.95}
- "Mostre meus fertilizantes" → {"type":"query","entity":"stock","filters":{"category":"fertilizante"},"confidence":0.95}
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

    // Detecção de categoria de produto antes da detecção genérica de estoque
    const categoryMap: Record<string, string> = {
      fungicida: "fungicida", fungicidas: "fungicida",
      herbicida: "herbicida", herbicidas: "herbicida",
      inseticida: "inseticida", inseticidas: "inseticida",
      fertilizante: "fertilizante", fertilizantes: "fertilizante",
      semente: "semente", sementes: "semente",
      adjuvante: "adjuvante", adjuvantes: "adjuvante",
    };
    for (const [keyword, category] of Object.entries(categoryMap)) {
      if (lower.includes(keyword)) {
        return { type: "query", entity: "stock", filters: { category }, confidence: 0.7, question };
      }
    }

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
   ⚠️ NÃO mostre preços no estoque (a menos que o usuário peça explicitamente)
   ⚠️ MOSTRE TODOS os produtos, NÃO omita nenhum!
4. Para PREÇOS/FATURAS:
   💰 *Produto*
   📄 Preço: $X,XX (data) — use "lastPrice" se disponível, senão use "averageCost" como "Custo Médio"
   🏪 Fornecedor: Nome (se disponível)
   ⚠️ Se só tiver "averageCost" (sem lastPrice/unitPrice), mostre como "💲 Custo Médio cadastrado: R$ X,XX"
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

/**
 * Helper independente para extrair lista de produtos de um PDF do Catálogo Global.
 */
export async function parseGlobalCatalogPdf(pdfBuffer: Buffer): Promise<any[]> {
  try {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');

    // Extract text from PDF
    const data = new Uint8Array(pdfBuffer);
    const pdf = await getDocument({ data }).promise;
    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      fullText += pageText + "\n";
    }

    if (!fullText.trim()) {
      throw new Error("PDF seems to be empty or unreadable.");
    }

    const prompt = `Você é um agrônomo especialista em leitura de catálogos e bulários agrícolas.
Extraia uma lista de TODOS os produtos mencionados neste texto de catálogo PDF.

RETORNE APENAS UM ARRAY JSON VÁLIDO. NÃO INCLUA NADA FORA DOS COLCHETES [].
Exemplo do formato exigido:
[
  {
    "name": "NOME COMERCIAL DO PRODUTO (ex: SPHERE MAX, PREMIO, ROUNDUP)",
    "activeIngredient": "Princípio Ativo (se houver)",
    "category": "Uma destas opções exatas: Tratamento de semente, Herbicidas, Inseticidas, Fungicidas, Especialidades, Sementes, Fertilizantes, Outros",
    "dosePerHa": Número (dose média por hectare, ex: 1.5, 0.5, 2.0. Se não achar, mande null),
    "unit": "LT, KG ou UNI"
  }
]

REGRAS RÍGIDAS:
1. O texto do catálogo pode estar bagunçado, tente inferir os blocos de produtos.
2. NOME deve estar em MAIÚSCULAS para facilitar busca futura.
3. Se "dosePerHa" for um intervalo (ex: "1 a 2"), mande a média (1.5). DEVE SER UM NUMERO DECIMAL.
4. CATEGORY DEVE ser estritamente uma da lista acima. Se for adubo, use Fertilizantes. Se for fungicida de ferrugem, use Fungicidas.

TEXTO DO CATÁLOGO EXTRAÍDO:
${fullText.substring(0, 30000)} // Limite de 30k chars pra não estourar payload
`;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY não configurada.");

    // Using gemini-2.0-flash exactly as we fixed earlier for invoice parsing
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1, // Low temp for strictly structured JSON extraction
          }
        }),
      }
    );

    const apiData = await response.json();

    if (!response.ok) {
      console.error("[Gemini Catalog Parse] API Error:", apiData);
      throw new Error(apiData.error?.message || "Failed to call Gemini API");
    }

    const text = apiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();

    try {
      const parsed = JSON.parse(cleanJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error("[Gemini Catalog Parse] Failed to parse JSON. Raw output:", text);
      throw new Error("A IA não retornou um formato JSON válido.");
    }

  } catch (error) {
    console.error("[parseGlobalCatalogPdf] Fatal error:", error);
    throw error;
  }
}

export async function parseProductPhoto(imageBuffer: Buffer, mimeType: string): Promise<{
  name: string;
  activeIngredient: string | null;
  category: string | null;
  unit: string | null;
  lote: string | null;
  expiryDate: string | null;
}> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY não configurada");

    const base64Image = imageBuffer.toString("base64");

    const prompt = `Você é um agrônomo especialista em produtos químicos agrícolas.
Analise a imagem deste rótulo/embalagem de defensivo ou insumo agrícola.
Extraia os seguintes dados do produto:
1. "name": O nome comercial principal (ex: SPHERE MAX, ROUNDUP, PREMIO). Apenas o nome.
2. "activeIngredient": O princípio ativo (se visível).
3. "category": Classifique estritamente como uma destas opções: "Herbicida", "Fungicida", "Inseticida", "Fertilizante", "Semente", "Adjuvante", "Outro".
4. "unit": O tipo de unidade da embalagem estritamente como: "LT" (se for líquido/litros), "KG" (se for sólido/quilos), "UNI" (se for unidade/caixa) ou "SC" (se for saco).
5. "lote": O número do lote (batch) se visível no rótulo (ex: "PLN4I002", "LA40200"). Se não encontrar, retorne null.
6. "expiryDate": A data de vencimento/validade do produto no formato "YYYY-MM-DD" (ex: "2027-01-08"). Se não encontrar, retorne null.

Retorne APENAS UM JSON VÁLIDO no formato exato baixo, sem comentários adicionais:
{
  "name": "NOME DO PRODUTO",
  "activeIngredient": "Princípio Ativo",
  "category": "Fungicida",
  "unit": "LT",
  "lote": "PLN4I002",
  "expiryDate": "2027-01-08"
}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
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
          ],
          generationConfig: {
            temperature: 0.1,
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("[Gemini Image Parse] API Error:", data);
      throw new Error(data.error?.message || "Erro na API Gemini");
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();

    try {
      const parsed = JSON.parse(cleanJson);
      return {
        name: parsed.name || "Produto Desconhecido",
        activeIngredient: parsed.activeIngredient || null,
        category: parsed.category || "Outro",
        unit: parsed.unit || "LT",
        lote: parsed.lote || null,
        expiryDate: parsed.expiryDate || null,
      };
    } catch (e) {
      console.error("[Gemini] Invalid JSON:", cleanJson);
      throw new Error("A IA não conseguiu entender a embalagem.");
    }
  } catch (error) {
    console.error("[parseProductPhoto] Fatal error:", error);
    throw error;
  }
}

export async function extractManualText(fileBuffer: Buffer, mimeType: string): Promise<string> {
  try {
    // Use pdf-parse for direct text extraction — no token limits, full document preserved
    const { pdf: pdfParse } = await import("pdf-parse");
    const parsed = await pdfParse(fileBuffer);
    const text = parsed.text?.trim();
    if (text && text.length > 100) {
      console.log(`[extractManualText] pdf-parse extracted ${text.length} chars from PDF`);
      return text;
    }
    throw new Error("pdf-parse returned empty text");
  } catch (error) {
    console.error("[extractManualText] Fatal error:", error);
    throw error;
  }
}

export async function answerFromManuals(query: string, manualsContext: string): Promise<string> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

    const prompt = `Você é um assistente agronômico especialista do sistema AgroFarm. 
Responda à dúvida do usuário de forma clara, prestativa e técnica, baseando-se EXCLUSIVAMENTE nas informações contidas nos manuais oficiais abaixo.
Se a resposta não estiver nos manuais, diga "Infelizmente, não encontrei essa informação nos manuais agronômicos da base de conhecimento atual."

MANUAIS OFICIAIS:
${manualsContext}

DÚVIDA DO AGRICULTOR:
"${query}"

SUA RESPOSTA COMPLETA E DETALHADA:`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("[Gemini RAG] API Error:", data);
      throw new Error(data.error?.message || "Erro na API Gemini");
    }

    return data.candidates?.[0]?.content?.parts?.[0]?.text || "Não foi possível gerar a resposta.";
  } catch (error) {
    console.error("[answerFromManuals] Fatal error:", error);
    throw error;
  }
}
