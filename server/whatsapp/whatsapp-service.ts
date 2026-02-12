/**
 * Serviço principal de WhatsApp que orquestra todo o fluxo
 */

import { ZApiClient, ZApiClient as ZApi } from "./zapi-client";
import { GeminiClient } from "./gemini-client";
import { MessageHandler } from "./message-handler";
import { db, pool } from "../db";

interface WhatsAppServiceConfig {
  zapiInstanceId: string;
  zapiToken: string;
  zapiClientToken?: string; // security token
  geminiApiKey: string;
  zapiBaseUrl?: string;
}

export class WhatsAppService {
  private zapi: ZApiClient;
  private gemini: GeminiClient;
  private handler: MessageHandler;

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
   * Processa mensagem recebida via webhook
   */
  async processIncomingMessage(phone: string, message: string): Promise<void> {
    try {
      // 1. Identificar usuário pelo número de WhatsApp
      const user = await this.findUserByPhone(phone);

      if (!user) {
        await this.sendMessage(
          phone,
          "❌ Usuário não encontrado.\n\nPor favor, cadastre seu número de WhatsApp no sistema primeiro."
        );
        return;
      }

      // 2. Interpretar pergunta com Gemini AI
      const intent = await this.gemini.interpretQuestion(message, user.id);

      // Se for apenas papo furado ou dúvida geral, responde direto
      if (intent.type === "conversation" && intent.response) {
        await this.sendMessage(phone, intent.response);
        return;
      }

      if (intent.type === "unknown" || intent.confidence < 0.5) {
        await this.sendMessage(
          phone,
          "🤔 Não entendi sua pergunta. Pode reformular?\n\n" +
          "Eu sei consultar: Estoque, Despesas, Faturas e Aplicações."
        );
        return;
      }

      // 3. Executar query no banco
      const data = await this.handler.executeQuery(intent, user.id);

      if (!data || (Array.isArray(data) && data.length === 0)) {
        await this.sendMessage(
          phone,
          "📭 Não encontrei informações para sua consulta."
        );
        return;
      }

      // 4. Formatar resposta com Gemini (Natural Language)
      const response = await this.gemini.generateNaturalResponse(data, intent);

      // 5. Enviar resposta
      await this.sendMessage(phone, response);
    } catch (error) {
      console.error("[WhatsAppService] Erro ao processar mensagem:", error);
      await this.sendMessage(
        phone,
        "❌ Ocorreu um erro ao processar sua mensagem. Tente novamente mais tarde."
      );
    }
  }

  /**
   * Envia mensagem via Z-API
   */
  async sendMessage(phone: string, message: string): Promise<boolean> {
    const formattedPhone = ZApi.formatPhoneNumber(phone);
    const result = await this.zapi.sendTextMessage({
      phone: formattedPhone,
      message,
    });

    if (!result.success) {
      console.error("[WhatsAppService] Erro ao enviar mensagem:", result.error);
    }

    return result.success;
  }

  /**
   * Busca usuário pelo número de WhatsApp
   * Verifica tanto na tabela users quanto farm_farmers
   */
  private async findUserByPhone(phone: string): Promise<{ id: string; name: string } | null> {
    try {
      const formattedPhone = ZApi.formatPhoneNumber(phone);

      // Buscar na tabela users pelo campo whatsapp_number
      // Usando SQL direto pois o campo pode não estar no schema Drizzle ainda
      const isNeon = process.env.DATABASE_URL?.includes('neon.tech');

      let userResult: any;
      if (isNeon) {
        // Neon usa pool.query que retorna { rows: [...] }
        userResult = await pool.query(`SELECT id, name FROM users WHERE whatsapp_number = $1 LIMIT 1`, [formattedPhone]);
        if (userResult.rows && userResult.rows.length > 0) {
          return { id: userResult.rows[0].id, name: userResult.rows[0].name };
        }
      } else {
        // postgres-js usa pool que retorna array direto
        userResult = await pool`SELECT id, name FROM users WHERE whatsapp_number = ${formattedPhone} LIMIT 1`;
        if (userResult && userResult.length > 0) {
          return { id: userResult[0].id, name: userResult[0].name };
        }
      }

      // Buscar na tabela farm_farmers pelo campo whatsapp_number ou phone
      // Removido temporariamente pois a tabela farm_farmers ainda não existe na produção
      /*
      let farmerResult: any;
      if (isNeon) {
        farmerResult = await pool.query(`SELECT id, name FROM farm_farmers WHERE whatsapp_number = $1 OR phone = $1 LIMIT 1`, [formattedPhone]);
        if (farmerResult.rows && farmerResult.rows.length > 0) {
          return { id: farmerResult.rows[0].id, name: farmerResult.rows[0].name || "Agricultor" };
        }
      } else {
        farmerResult = await pool`SELECT id, name FROM farm_farmers WHERE whatsapp_number = ${formattedPhone} OR phone = ${formattedPhone} LIMIT 1`;
        if (farmerResult && farmerResult.length > 0) {
          return { id: farmerResult[0].id, name: farmerResult[0].name || "Agricultor" };
        }
      }
      */

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
