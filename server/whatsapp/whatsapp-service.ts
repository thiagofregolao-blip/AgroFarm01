/**
 * Serviço principal de WhatsApp que orquestra todo o fluxo
 */

import { ZApiClient, ZApiClient as ZApi } from "./zapi-client";
import { GeminiClient } from "./gemini-client";
import { MessageHandler } from "./message-handler";
import { db, pool } from "../db";
import { farmExpenses, farmEquipment } from "../../shared/schema";
import { and, desc, eq, ilike, gt, isNull } from "drizzle-orm";

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
   * Se existir uma despesa via WhatsApp recente sem equipamento vinculado,
   * interpreta a mensagem atual como nome/placa da máquina e faz o vínculo.
   */
  private async handlePendingExpenseEquipment(
    farmerId: string,
    message: string,
    replyTo: string,
    replyIsGroup: boolean
  ): Promise<boolean> {
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

    const [pending] = await db
      .select()
      .from(farmExpenses)
      .where(
        and(
          eq(farmExpenses.farmerId, farmerId),
          eq(farmExpenses.status, "pending"),
          ilike(farmExpenses.description, "[Via WhatsApp]%"),
          gt(farmExpenses.createdAt, tenMinutesAgo),
          isNull(farmExpenses.equipmentId)
        )
      )
      .orderBy(desc(farmExpenses.createdAt))
      .limit(1);

    if (!pending) {
      return false;
    }

    const search = message.trim();
    if (!search) {
      await this.sendMessage(
        replyTo,
        "Não consegui identificar a máquina/veículo. Me mande o nome ou a placa, por exemplo: *John Deere 5360*.",
        replyIsGroup
      );
      return true;
    }

    const [equip] = await db
      .select()
      .from(farmEquipment)
      .where(
        and(
          eq(farmEquipment.farmerId, farmerId),
          ilike(farmEquipment.name, `%${search}%`)
        )
      )
      .limit(1);

    if (!equip) {
      await this.sendMessage(
        replyTo,
        "Não achei nenhuma máquina/veículo com esse nome. Tente mandar o nome exatamente como está cadastrado no painel de equipamentos.",
        replyIsGroup
      );
      return true;
    }

    await db
      .update(farmExpenses)
      .set({
        equipmentId: equip.id,
        description: `${pending.description || ""} (Equipamento: ${equip.name})`,
      })
      .where(eq(farmExpenses.id, pending.id));

    await this.sendMessage(
      replyTo,
      `Perfeito! Vinculei essa despesa à máquina/veículo *${equip.name}*. Ela já está aguardando aprovação no painel da AgroFarm. ✅`,
      replyIsGroup
    );

    return true;
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

      // 2.a) Verificar se há alguma despesa via WhatsApp aguardando vínculo com equipamento
      const handledEquipment = await this.handlePendingExpenseEquipment(user.id, message, replyTo, replyIsGroup);
      if (handledEquipment) {
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
