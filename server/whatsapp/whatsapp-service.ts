/**
 * Serviço principal de WhatsApp que orquestra todo o fluxo
 */

import { ZApiClient, ZApiClient as ZApi } from "./zapi-client";
import { GeminiClient } from "./gemini-client";
import { MessageHandler } from "./message-handler";
import { db, pool } from "../db";
import { farmExpenses, farmEquipment, farmWhatsappPendingContext, farmCashAccounts, farmCashTransactions, farmSeasons } from "../../shared/schema";
import { and, desc, eq, ilike, gt, isNull, sql } from "drizzle-orm";

interface WhatsAppServiceConfig {
  zapiInstanceId: string;
  zapiToken: string;
  zapiClientToken?: string; // security token
  geminiApiKey: string;
  zapiBaseUrl?: string;
}

// Palavras-chave que acionam o bot em mensagens de grupo
const TRIGGER_KEYWORDS = [
  // Nome do bot
  "agrofarm", "@agrofarm", "agrofarma", "bot",
  // Comandos diretos
  "estoque", "aplicações", "aplicacoes", "faturas", "despesas", "custo", "safra",
  // Consultas de preço/valor
  "preço", "preco", "precio", "valor", "quanto",
  // Produtos agrícolas genéricos
  "produto", "produtos", "herbicida", "fungicida", "inseticida", "adubo", "fertilizante",
  // Ações comuns
  "compra", "compras", "gasto", "gastos", "nota", "notas",
  "aplicação", "aplicacao", "aplicar",
  // Consultas gerais
  "relatório", "relatorio", "resumo", "ajuda", "help",
  // Propriedades
  "talhão", "talhao", "propriedade",
  // Conversacional / saudações
  "oi", "olá", "ola", "bom dia", "boa tarde", "boa noite",
  "obrigado", "obrigada", "valeu", "vlw", "tmj",
  "como vai", "tudo bem", "e aí", "eai",
  "tchau", "até mais", "ate mais", "flw",
  // Agronomia / recomendações
  "controle", "controlar", "combater", "combate",
  "doença", "doenca", "praga", "pragas", "erva daninha", "planta daninha",
  "ferrugem", "percevejo", "lagarta", "pulgão", "pulgao",
  "buva", "capim", "picão", "picao", "caruru",
  "recomendação", "recomendacao", "receita", "indicação", "indicacao",
  "usar contra", "bom para", "bom pra", "serve para", "serve pra",
];
// Palavras que NÃO devem ser removidas da mensagem (são comandos, não keywords de ativação)
const COMMAND_KEYWORDS = [
  "estoque", "aplicações", "aplicacoes", "faturas", "despesas", "custo", "safra",
  "preço", "preco", "precio", "valor", "quanto",
  "produto", "produtos", "herbicida", "fungicida", "inseticida", "adubo", "fertilizante",
  "compra", "compras", "gasto", "gastos", "nota", "notas",
  "aplicação", "aplicacao", "aplicar",
  "relatório", "relatorio", "resumo",
  "talhão", "talhao", "propriedade",
  // Conversacional - manter na mensagem
  "oi", "olá", "ola", "bom dia", "boa tarde", "boa noite",
  "obrigado", "obrigada", "valeu", "vlw", "tmj",
  "como vai", "tudo bem", "e aí", "eai",
  "tchau", "até mais", "ate mais", "flw",
  // Agronomia - CRUCIAL manter na mensagem
  "controle", "controlar", "combater", "combate",
  "doença", "doenca", "praga", "pragas", "erva daninha", "planta daninha",
  "ferrugem", "percevejo", "lagarta", "pulgão", "pulgao",
  "buva", "capim", "picão", "picao", "caruru",
  "recomendação", "recomendacao", "receita", "indicação", "indicacao",
  "usar contra", "bom para", "bom pra", "serve para", "serve pra",
];

export class WhatsAppService {
  private zapi: ZApiClient;
  private gemini: GeminiClient;
  private handler: MessageHandler;
  private userContexts: Map<string, any> = new Map();

  constructor(config: WhatsAppServiceConfig) {
    this.zapi = new ZApiClient({
      instanceId: config.zapiInstanceId,
      token: config.zapiToken,
      clientToken: config.zapiClientToken,
      baseUrl: config.zapiBaseUrl,
    });
    this.gemini = new GeminiClient({
      apiKey: config.geminiApiKey,
    });
    this.handler = new MessageHandler();
  }

  /**
   * Gerencia conversa multi-etapa do WhatsApp:
   * - awaiting_category: esperando o tipo de despesa
   * - awaiting_equipment: esperando nome da máquina/veículo
   * - awaiting_account: esperando conta de pagamento
   */
  private async handlePendingContext(
    farmerId: string,
    phone: string,
    message: string,
    replyTo: string,
    replyIsGroup: boolean
  ): Promise<boolean> {
    const now = new Date();

    const [ctx] = await db.select().from(farmWhatsappPendingContext).where(
      and(
        eq(farmWhatsappPendingContext.farmerId, farmerId),
        eq(farmWhatsappPendingContext.phone, phone),
        gt(farmWhatsappPendingContext.expiresAt, now)
      )
    ).orderBy(desc(farmWhatsappPendingContext.createdAt)).limit(1);

    if (!ctx) return false;

    const search = message.trim();
    const data = (ctx.data as any) || {};

    if (ctx.step === "awaiting_category") {
      const categories: Record<string, string> = {
        "1": "pecas", "pecas": "pecas", "peças": "pecas",
        "2": "diesel", "diesel": "diesel", "combustivel": "diesel",
        "3": "mao_de_obra", "mao de obra": "mao_de_obra", "serviço": "mao_de_obra",
        "4": "frete", "frete": "frete", "transporte": "frete",
        "5": "energia", "energia": "energia", "luz": "energia",
        "6": "outro", "outro": "outro", "outros": "outro",
      };
      const matched = categories[search.toLowerCase()];
      if (!matched) {
        await this.sendMessage(replyTo,
          "Não entendi. Responda com o número ou nome:\n1️⃣ Peças\n2️⃣ Diesel\n3️⃣ Mão de obra\n4️⃣ Frete\n5️⃣ Energia\n6️⃣ Outro",
          replyIsGroup
        );
        return true;
      }

      if (ctx.expenseId) {
        await db.update(farmExpenses).set({ category: matched }).where(eq(farmExpenses.id, ctx.expenseId));
      }

      const accounts = await db.select().from(farmCashAccounts).where(
        and(eq(farmCashAccounts.farmerId, farmerId), eq(farmCashAccounts.isActive, true))
      );

      if (accounts.length > 0) {
        await db.update(farmWhatsappPendingContext).set({
          step: "awaiting_account",
          data: { ...data, category: matched },
        }).where(eq(farmWhatsappPendingContext.id, ctx.id));

        const accountList = accounts.map((a, i) => `${i + 1}️⃣ ${a.name} (${a.currency})`).join("\n");
        await this.sendMessage(replyTo,
          `Categoria: *${matched}* ✅\n\nDe qual conta saiu o pagamento?\n${accountList}`,
          replyIsGroup
        );
      } else {
        await db.delete(farmWhatsappPendingContext).where(eq(farmWhatsappPendingContext.id, ctx.id));
        await this.sendMessage(replyTo,
          `Categoria registrada: *${matched}* ✅\nDespesa aguardando aprovação no painel da AgroFarm.`,
          replyIsGroup
        );
      }
      return true;
    }

    if (ctx.step === "awaiting_equipment") {
      const allEquipment = await db.select().from(farmEquipment).where(eq(farmEquipment.farmerId, farmerId));
      const accounts = await db.select().from(farmCashAccounts).where(
        and(eq(farmCashAccounts.farmerId, farmerId), eq(farmCashAccounts.isActive, true))
      );
      const skipOption = allEquipment.length + 1;
      const idx = parseInt(search) - 1;

      let equip: any = null;
      let aiExtras: any = {};

      if (!isNaN(idx) && idx >= 0 && idx < allEquipment.length) {
        equip = allEquipment[idx];
      } else if (parseInt(search) === skipOption) {
        equip = null;
      } else {
        equip = allEquipment.find(e => e.name.toLowerCase().includes(search.toLowerCase()));
        if (!equip && search.length > 3) {
          const ai = await this.gemini.interpretExpenseResponse(search, {
            step: "awaiting_equipment",
            equipmentList: allEquipment.map(e => ({ id: e.id, name: e.name })),
            accountList: accounts.map(a => ({ id: a.id, name: a.name, currency: a.currency })),
          });
          if (ai.understood) {
            aiExtras = ai;
            if (ai.skipEquipment || ai.equipmentIndex === -1) {
              equip = null;
            } else if (ai.equipmentIndex && ai.equipmentIndex > 0 && ai.equipmentIndex <= allEquipment.length) {
              equip = allEquipment[ai.equipmentIndex - 1];
            }
          } else {
            const equipList = allEquipment.map((e, i) => `${i + 1}️⃣ ${e.name}`).join("\n");
            await this.sendMessage(replyTo,
              `Não entendi. Responda com o número:\n${equipList}\n${skipOption}️⃣ Nenhuma`,
              replyIsGroup
            );
            return true;
          }
        } else if (!equip) {
          const equipList = allEquipment.map((e, i) => `${i + 1}️⃣ ${e.name}`).join("\n");
          await this.sendMessage(replyTo,
            `Não entendi. Responda com o número:\n${equipList}\n${skipOption}️⃣ Nenhuma`,
            replyIsGroup
          );
          return true;
        }
      }

      if (equip && ctx.expenseId) {
        const [exp] = await db.select().from(farmExpenses).where(eq(farmExpenses.id, ctx.expenseId)).limit(1);
        await db.update(farmExpenses).set({
          equipmentId: equip.id,
          description: `${exp?.description || ""} (Equipamento: ${equip.name})`,
        }).where(eq(farmExpenses.id, ctx.expenseId));
      }

      const equipMsg = equip ? `🚜 Máquina: *${equip.name}* ✅` : `🚜 Sem vínculo de máquina ✅`;

      let pmIdx = 1;
      const pmLines: string[] = [];
      for (const a of accounts) { pmLines.push(`${pmIdx}️⃣ ${a.name} (${a.currency})`); pmIdx++; }
      pmLines.push(`${pmIdx}️⃣ Efetivo (bolso)`); pmIdx++;
      pmLines.push(`${pmIdx}️⃣ Financiado (safra)`);

      await db.update(farmWhatsappPendingContext).set({
        step: "awaiting_payment_method",
        data: { ...data, equipmentId: equip?.id || null, equipmentName: equip?.name || null },
      }).where(eq(farmWhatsappPendingContext.id, ctx.id));
      await this.sendMessage(replyTo, `${equipMsg}\n\nQual a forma de pagamento?\n${pmLines.join("\n")}`, replyIsGroup);
      return true;
    }

    if (ctx.step === "awaiting_payment_method") {
      const accounts = await db.select().from(farmCashAccounts).where(
        and(eq(farmCashAccounts.farmerId, farmerId), eq(farmCashAccounts.isActive, true))
      );
      const efIndex = accounts.length + 1;
      const finIndex = accounts.length + 2;
      const chosen = parseInt(search);

      if (chosen === finIndex || search.toLowerCase().includes("financ") || search.toLowerCase().includes("safra")) {
        const seasons = await db.select().from(farmSeasons).where(
          and(eq(farmSeasons.farmerId, farmerId), eq(farmSeasons.isActive, true))
        );
        if (seasons.length > 0) {
          await db.update(farmWhatsappPendingContext).set({
            step: "awaiting_season",
            data: { ...data, paymentType: "financiado" },
          }).where(eq(farmWhatsappPendingContext.id, ctx.id));
          const seasonList = seasons.map((s, i) => {
            const endStr = s.endDate ? new Date(s.endDate).toLocaleDateString("pt-BR") : "sem data";
            return `${i + 1}️⃣ ${s.name} (vence: ${endStr})`;
          }).join("\n");
          await this.sendMessage(replyTo, `Financiado ✅\n\nEm qual safra será pago?\n${seasonList}`, replyIsGroup);
          return true;
        }
        if (ctx.expenseId) {
          await db.update(farmExpenses).set({ paymentType: "financiado", paymentStatus: "pendente" }).where(eq(farmExpenses.id, ctx.expenseId));
        }
        await db.delete(farmWhatsappPendingContext).where(eq(farmWhatsappPendingContext.id, ctx.id));
        await this.sendSummary(data, "Financiado", null, null, replyTo, replyIsGroup);
        return true;
      }

      if (chosen === efIndex || search.toLowerCase().includes("efetivo") || search.toLowerCase().includes("bolso") || search.toLowerCase().includes("dinheiro")) {
        if (ctx.expenseId) {
          await db.update(farmExpenses).set({ paymentType: "a_vista", paymentStatus: "pago" }).where(eq(farmExpenses.id, ctx.expenseId));
        }
        await db.delete(farmWhatsappPendingContext).where(eq(farmWhatsappPendingContext.id, ctx.id));
        await this.sendSummary(data, "Efetivo (bolso) 💵", null, null, replyTo, replyIsGroup);
        return true;
      }

      const acctIdx = chosen - 1;
      let matched: any = null;
      if (!isNaN(acctIdx) && acctIdx >= 0 && acctIdx < accounts.length) {
        matched = accounts[acctIdx];
      } else {
        matched = accounts.find(a => a.name.toLowerCase().includes(search.toLowerCase()));
      }

      if (!matched) {
        let ri = 1;
        const rLines: string[] = [];
        for (const a of accounts) { rLines.push(`${ri}️⃣ ${a.name} (${a.currency})`); ri++; }
        rLines.push(`${ri}️⃣ Efetivo (bolso)`); ri++;
        rLines.push(`${ri}️⃣ Financiado (safra)`);
        await this.sendMessage(replyTo, `Não entendi. Responda com o número:\n${rLines.join("\n")}`, replyIsGroup);
        return true;
      }

      if (ctx.expenseId) {
        const [exp] = await db.select().from(farmExpenses).where(eq(farmExpenses.id, ctx.expenseId)).limit(1);
        if (exp) {
          const expAmt = parseFloat(exp.amount as string) || 0;
          await db.update(farmExpenses).set({ paymentType: "a_vista", paymentStatus: "pago", paidAmount: String(expAmt) }).where(eq(farmExpenses.id, ctx.expenseId));
          await db.insert(farmCashTransactions).values({
            farmerId, accountId: matched.id, type: "saida",
            amount: String(expAmt), currency: matched.currency, category: exp.category,
            description: exp.description?.replace(/\[Via WhatsApp\]\s*(\[[^\]]*\]\s*)?/, "").trim() || "Despesa via WhatsApp",
            paymentMethod: "transferencia", expenseId: exp.id, referenceType: "whatsapp",
          });
          await db.update(farmCashAccounts).set({ currentBalance: sql`current_balance - ${expAmt}` }).where(eq(farmCashAccounts.id, matched.id));
        }
      }
      await db.delete(farmWhatsappPendingContext).where(eq(farmWhatsappPendingContext.id, ctx.id));
      await this.sendSummary(data, null, matched.name, null, replyTo, replyIsGroup);
      return true;
    }

    if (ctx.step === "awaiting_season") {
      const seasons = await db.select().from(farmSeasons).where(
        and(eq(farmSeasons.farmerId, farmerId), eq(farmSeasons.isActive, true))
      );
      const sIdx = parseInt(search) - 1;
      let season: any = null;
      if (!isNaN(sIdx) && sIdx >= 0 && sIdx < seasons.length) {
        season = seasons[sIdx];
      } else {
        season = seasons.find(s => s.name.toLowerCase().includes(search.toLowerCase()));
      }
      if (!season) {
        const sList = seasons.map((s, i) => {
          const endStr = s.endDate ? new Date(s.endDate).toLocaleDateString("pt-BR") : "sem data";
          return `${i + 1}️⃣ ${s.name} (vence: ${endStr})`;
        }).join("\n");
        await this.sendMessage(replyTo, `Não entendi. Responda com o número:\n${sList}`, replyIsGroup);
        return true;
      }

      if (ctx.expenseId) {
        await db.update(farmExpenses).set({
          paymentType: "financiado", paymentStatus: "pendente",
          dueDate: season.endDate || null,
        }).where(eq(farmExpenses.id, ctx.expenseId));
      }
      await db.delete(farmWhatsappPendingContext).where(eq(farmWhatsappPendingContext.id, ctx.id));
      const dueStr = season.endDate ? new Date(season.endDate).toLocaleDateString("pt-BR") : "sem data";
      await this.sendSummary(data, "Financiado", null, `${season.name} (vence: ${dueStr})`, replyTo, replyIsGroup);
      return true;
    }

    return false;
  }

  /**
   * Envia resumo final padronizado da despesa.
   */
  private async sendSummary(
    data: any,
    paymentLabel: string | null,
    accountName: string | null,
    seasonInfo: string | null,
    replyTo: string, replyIsGroup: boolean
  ): Promise<void> {
    const amt = data.amount ? parseFloat(data.amount).toFixed(2) : "0.00";
    const summary = [`✅ *Despesa registrada!*`, ``, `💰 Valor: *$ ${amt}*`];
    if (data.supplierName) summary.push(`🏪 Fornecedor: *${data.supplierName}*`);
    if (data.category) summary.push(`📋 Categoria: *${data.category}*`);
    if (data.equipmentName) summary.push(`🚜 Máquina: *${data.equipmentName}*`);
    if (accountName) summary.push(`🏦 Conta: *${accountName}*`);
    if (paymentLabel) summary.push(`💳 Pagamento: *${paymentLabel}*`);
    if (seasonInfo) summary.push(`📅 Safra: *${seasonInfo}*`);
    summary.push(`\nAguardando aprovação no painel da AgroFarm! 🌾`);
    await this.sendMessage(replyTo, summary.join("\n"), replyIsGroup);
  }

  /**
   * Verifica se a mensagem contém a palavra-chave de ativação
   */
  private containsTriggerKeyword(message: string): boolean {
    const lower = message.toLowerCase();
    return TRIGGER_KEYWORDS.some(kw => lower.includes(kw));
  }

  /**
   * Remove a palavra-chave da mensagem para enviar ao AI limpa
   */
  private stripTriggerKeyword(message: string): string {
    let cleaned = message;
    // Only strip name-based triggers, NOT command keywords
    const nameKeywords = TRIGGER_KEYWORDS.filter(kw => !COMMAND_KEYWORDS.includes(kw));
    for (const kw of nameKeywords) {
      cleaned = cleaned.replace(new RegExp(kw, "gi"), "").trim();
    }
    // Remove mentions like @number
    cleaned = cleaned.replace(/@\d+/g, "").trim();
    // Remover espaços extras
    return cleaned.replace(/\s+/g, " ").trim();
  }

  /**
   * Processa mensagem recebida via webhook
   */
  async processIncomingMessage(
    phone: string,
    message: string,
    audioUrl?: string,
    groupInfo?: { isGroup?: boolean; chatId?: string; senderPhone?: string }
  ): Promise<void> {
    const isGroup = groupInfo?.isGroup || false;
    const chatId = groupInfo?.chatId;
    const senderPhone = groupInfo?.senderPhone || phone;

    // Determinar para onde enviar a resposta
    const replyTo = isGroup && chatId ? chatId : phone;
    const replyIsGroup = isGroup && !!chatId;

    try {
      // Em grupo: só responder se contiver a palavra-chave
      if (isGroup) {
        if (!this.containsTriggerKeyword(message) && !audioUrl) {
          // Mensagem de grupo sem keyword → ignorar silenciosamente
          console.log(`[WhatsApp] Grupo: mensagem ignorada (sem keyword): "${message}"`);
          return;
        }
        // Remover a keyword da mensagem antes de processar
        if (!audioUrl) {
          message = this.stripTriggerKeyword(message);
          if (!message) {
            await this.sendMessage(replyTo, "E aí! 😄 Sou o AgroBot, seu parceiro na gestão da fazenda! 🚜\n\nPode me perguntar sobre:\n📦 *Estoque* — \"quanto tenho de glifosato?\"\n💰 *Preços* — \"preço do 24D\"\n📄 *Faturas* — \"minhas faturas\"\n🌱 *Aplicações* — \"o que apliquei?\"\n💸 *Despesas* — \"gastos do mês\"\n\nOu pode só bater um papo! 😊", replyIsGroup);
            return;
          }
        }
        console.log(`[WhatsApp] Grupo: mensagem acionada por keyword. Sender: ${senderPhone}`);
      }

      // 1. Identificar usuário pelo número de WhatsApp (em grupo, usar senderPhone)
      const lookupPhone = isGroup ? senderPhone : phone;
      const user = await this.findUserByPhone(lookupPhone);

      // Se for áudio, transcrever primeiro
      if (audioUrl) {
        await this.sendMessage(replyTo, "🎧 Ouvindo seu áudio...", replyIsGroup);
        const transcription = await this.gemini.transcribeAudio(audioUrl);

        if (!transcription) {
          await this.sendMessage(replyTo, "❌ Não consegui entender o áudio. Pode tentar escrever?", replyIsGroup);
          return;
        }

        message = transcription;
        await this.sendMessage(replyTo, `📝 *Entendi:* "${message}"`, replyIsGroup);

        // Em grupo, verificar keyword no áudio transcrevido
        if (isGroup && !this.containsTriggerKeyword(message)) {
          console.log(`[WhatsApp] Grupo: áudio transcrito sem keyword, ignorando.`);
          return;
        }
        if (isGroup) {
          message = this.stripTriggerKeyword(message);
        }
      }

      if (!user) {
        await this.sendMessage(
          replyTo,
          "❌ Usuário não encontrado.\n\nPor favor, cadastre seu número de WhatsApp no sistema primeiro.",
          replyIsGroup
        );
        return;
      }

      // Regra Estrita: Apenas agricultores podem usar o WhatsApp Bot. Outros papéis (consultor, gerente, etc) são ignorados.
      if (user.role !== 'agricultor') {
        console.log(`[WhatsAppService] Match de numero, porem o role do usuario (${user.name}) é '${user.role}'. Ignorando a mensagem pois o bot é exclusivo para agricultores.`);
        return;
      }

      // 2.a) Verificar contexto pendente de conversa multi-etapa
      const handledContext = await this.handlePendingContext(user.id, phone, message, replyTo, replyIsGroup);
      if (handledContext) {
        return;
      }

      // 2. Interpretar pergunta com Gemini AI (com contexto)
      const contextKey = isGroup ? `${chatId}_${senderPhone}` : phone;
      const lastContext = this.userContexts.get(contextKey);
      const intent = await this.gemini.interpretQuestion(message, user.id, lastContext);
      console.log(`[WhatsAppService] Intent resolved:`, JSON.stringify(intent));

      // Salvar contexto para próxima interação (inclusive conversas)
      this.userContexts.set(contextKey, {
        lastIntent: intent,
        timestamp: Date.now()
      });

      // Se for apenas papo furado ou dúvida geral, responde direto
      if (intent.type === "conversation" && intent.response) {
        console.log(`[WhatsAppService] Sending conversation response:`, intent.response);
        await this.sendMessage(replyTo, intent.response, replyIsGroup);
        return;
      }

      // Se for consulta agronômica / recomendação de produto
      if (intent.type === "recommendation") {
        await this.sendMessage(replyTo, "🧑‍🌾 Deixa eu analisar seu estoque e te dar uma recomendação...", replyIsGroup);

        // Buscar estoque completo do agricultor
        const stockData = await this.handler.executeQuery(
          { type: "query", entity: "stock", filters: {}, confidence: 1, question: intent.question },
          user.id
        );

        if (!stockData || stockData.length === 0) {
          await this.sendMessage(replyTo, "📭 Não encontrei produtos no seu estoque. Cadastre seus produtos primeiro para que eu possa recomendar!", replyIsGroup);
          return;
        }

        const recommendation = await this.gemini.generateAgronomicRecommendation(stockData, intent);
        await this.sendMessage(replyTo, recommendation, replyIsGroup);
        return;
      }

      if (intent.type === "unknown" || intent.confidence < 0.5) {
        await this.sendMessage(
          replyTo,
          "Hmm, não entendi bem! 😅 Tenta me perguntar de outro jeito?\n\nExemplos:\n📦 \"Qual meu estoque?\"\n💰 \"Preço do glifosato\"\n📄 \"Minhas faturas\"\n🌱 \"O que apliquei hoje?\"\n\nOu manda um \"oi\" e conversamos! 😊",
          replyIsGroup
        );
        return;
      }

      // 3. Executar query no banco
      const data = await this.handler.executeQuery(intent, user.id);

      if (!data || (Array.isArray(data) && data.length === 0)) {
        await this.sendMessage(
          replyTo,
          "📭 Não encontrei informações para sua consulta.",
          replyIsGroup
        );
        return;
      }

      // 4. Formatar resposta com Gemini (Natural Language)
      const response = await this.gemini.generateNaturalResponse(data, intent);

      // 5. Enviar resposta
      console.log(`[WhatsAppService] Sending response to WhatsApp:`, response.substring(0, 100));
      await this.sendMessage(replyTo, response, replyIsGroup);
    } catch (error) {
      console.error("[WhatsAppService] Erro ao processar mensagem:", error);
      await this.sendMessage(
        replyTo,
        "❌ Ocorreu um erro ao processar sua mensagem. Tente novamente mais tarde.",
        replyIsGroup
      );
    }
  }

  /**
   * Envia mensagem via Z-API (suporta chat individual e grupo)
   */
  async sendMessage(phoneOrChatId: string, message: string, isGroup: boolean = false): Promise<boolean> {
    const formattedPhone = isGroup ? phoneOrChatId : ZApi.formatPhoneNumber(phoneOrChatId);
    console.log(`[WhatsAppService] Sending raw text to ${formattedPhone}`);
    const result = await this.zapi.sendTextMessage({
      phone: formattedPhone,
      message,
      isGroup,
    });

    if (!result.success) {
      console.error("[WhatsAppService] Erro ao enviar mensagem:", result.error);
    }

    return result.success;
  }

  /**
   * Busca usuário pelo número de WhatsApp
   * Verifica whatsapp_number principal E whatsapp_extra_numbers (JSON array)
   */
  private async findUserByPhone(phone: string): Promise<{ id: string; name: string; role: string } | null> {
    try {
      const formattedPhone = ZApi.formatPhoneNumber(phone);
      console.log(`[WhatsAppService] Find user - Raw: ${phone}, Formatted: ${formattedPhone}`);

      // Calculate Brazilian variations (with and without 9th digit)
      const phoneVariants = [formattedPhone];
      if (formattedPhone.startsWith('55') && formattedPhone.length === 12) {
        phoneVariants.push(formattedPhone.substring(0, 4) + '9' + formattedPhone.substring(4));
      } else if (formattedPhone.startsWith('55') && formattedPhone.length === 13) {
        phoneVariants.push(formattedPhone.substring(0, 4) + formattedPhone.substring(5));
      }

      const isNeon = process.env.DATABASE_URL?.includes('neon.tech');

      for (const variant of phoneVariants) {
        let userResult: any;
        if (isNeon) {
          userResult = await pool.query(
            `SELECT id, name, role, whatsapp_number FROM users WHERE whatsapp_number = $1 OR whatsapp_extra_numbers LIKE $2 LIMIT 1`,
            [variant, `%${variant}%`]
          );
          if (userResult.rows && userResult.rows.length > 0) {
            const u = userResult.rows[0];
            return { id: u.id, name: u.name, role: u.role };
          }
        } else {
          userResult = await pool`SELECT id, name, role, whatsapp_number FROM users WHERE whatsapp_number = ${variant} OR whatsapp_extra_numbers LIKE ${'%' + variant + '%'} LIMIT 1`;
          if (userResult && userResult.length > 0) {
            const u = userResult[0];
            console.log(`[WhatsAppService] User found: ${u.name} (${u.whatsapp_number}) - Role: ${u.role}`);
            return { id: u.id, name: u.name, role: u.role };
          }
        }
      }

      console.log(`[WhatsAppService] No user found for ${formattedPhone} or variations: ${phoneVariants.join(', ')}`);
      return null;
    } catch (error) {
      console.error("[WhatsAppService] Erro ao buscar usuário:", error);
      return null;
    }
  }

  /**
   * Verifica status da instância Z-API
   */
  async checkStatus(): Promise<{ connected: boolean; qrcode?: string }> {
    return await this.zapi.checkInstanceStatus();
  }
}
