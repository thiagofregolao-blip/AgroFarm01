/**
 * Cliente Z-API para envio e recebimento de mensagens WhatsApp
 * Documentação: https://developer.z-api.io/
 */

interface ZApiConfig {
  instanceId: string;
  token: string;
  clientToken?: string; // Token de segurança da conta (Security Token)
  baseUrl?: string;
}

interface SendMessageParams {
  phone: string; // Número no formato: 5511999999999 (sem +) ou chatId do grupo
  message: string;
  delay?: number; // Delay em segundos antes de enviar
  isGroup?: boolean; // Se true, envia para grupo via chatId
}

interface ZApiWebhookMessage {
  phone: string;
  message: string;
  audioUrl?: string;
  isAudio?: boolean;
  messageId?: string;
  timestamp?: number;
  instanceId?: string;
  isGroup?: boolean;
  chatId?: string; // ID do grupo (ex: 5511999999999-group@g.us)
  senderPhone?: string; // Quem enviou no grupo
}

export class ZApiClient {
  private instanceId: string;
  private token: string;
  private clientToken?: string;
  private baseUrl: string;

  constructor(config: ZApiConfig) {
    this.instanceId = config.instanceId;
    this.token = config.token;
    this.clientToken = config.clientToken;
    this.baseUrl = config.baseUrl || "https://api.z-api.io";
  }

  /**
   * Envia mensagem de texto via Z-API
   */
  async sendTextMessage(params: SendMessageParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const url = `${this.baseUrl}/instances/${this.instanceId}/token/${this.token}/send-text`;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Se houver clientToken configurado nos envs, envia o header
      // Se não, não envia (ou envia o token da instância como fallback se o usuário não configurou nada novo, mas isso pode dar erro)
      if (this.clientToken) {
        headers["Client-Token"] = this.clientToken;
      }

      // Para grupos, usar o endpoint send-text com phone no formato correto
      const body: any = {
        message: params.message,
        delay: params.delay || 0,
      };

      if (params.isGroup) {
        // Z-API webhook sends group as "123456-group" but send API needs "123456@g.us"
        let groupPhone = params.phone;
        if (groupPhone.endsWith("-group")) {
          groupPhone = groupPhone.replace("-group", "@g.us");
        } else if (!groupPhone.includes("@g.us")) {
          groupPhone = groupPhone + "@g.us";
        }
        body.phone = groupPhone;
        console.log(`[Z-API] Sending group message to: ${groupPhone}`);
      } else {
        body.phone = params.phone;
      }

      const response = await fetch(url, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("[Z-API] Erro ao enviar mensagem:", data);
        return { success: false, error: data.message || "Erro desconhecido" };
      }

      return { success: true, messageId: data.messageId };
    } catch (error) {
      console.error("[Z-API] Erro na requisição:", error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Verifica status da instância
   */
  async checkInstanceStatus(): Promise<{ connected: boolean; qrcode?: string }> {
    try {
      const url = `${this.baseUrl}/instances/${this.instanceId}/token/${this.token}/status`;

      const response = await fetch(url, {
        method: "GET",
      });

      const data = await response.json();

      if (!response.ok) {
        return { connected: false };
      }

      return {
        connected: data.connected || false,
        qrcode: data.qrcode,
      };
    } catch (error) {
      console.error("[Z-API] Erro ao verificar status:", error);
      return { connected: false };
    }
  }

  /**
   * Formata número de telefone para o padrão Z-API
   * Remove caracteres especiais e adiciona código do país se necessário
   */
  static formatPhoneNumber(phone: string): string {
    // Remove todos os caracteres não numéricos
    let cleaned = phone.replace(/\D/g, "");

    // Regra para Paraguai (595)
    // Se começar com 595 e ter 12 dígitos, mantém.
    // Se começar com 09 e ter 10 dígitos (ex: 0982...), remove o 0 e adiciona 595.
    // Se começar com 9 e ter 9 dígitos (ex: 982...), adiciona 595.
    if (cleaned.startsWith("09") && cleaned.length === 10) {
      cleaned = "595" + cleaned.substring(1);
    } else if (cleaned.startsWith("9") && cleaned.length === 9) {
      cleaned = "595" + cleaned;
    }
    // Regra para Brasil (55)
    // Se não começar com código do país conhecido (55 ou 595), e tiver 10 ou 11 dígitos, assume Brasil (55)
    else if (cleaned.length >= 10 && cleaned.length <= 11 && !cleaned.startsWith("55") && !cleaned.startsWith("595")) {
      cleaned = "55" + cleaned;
    }

    return cleaned;
  }

  /**
   * Parse webhook message do Z-API
   */
  static parseWebhookMessage(body: any): ZApiWebhookMessage | null {
    try {
      // Debug: Logar o corpo do webhook para entender a estrutura
      console.log("[Z-API] Webhook body received:", JSON.stringify(body, null, 2));

      // Z-API envia mensagens recebidas com a mensagem dentro de 'text'
      // Ex: { phone: "5511...", text: { message: "texto" }, ... }

      const phone = body.phone;
      const message = body.message || body.text?.message;

      // Detectar se é mensagem de grupo
      // Z-API envia isGroup: true e phone com formato "120363407188318982-group"
      const isGroup = body.isGroup === true || (body.phone && String(body.phone).includes("-group"));
      // Z-API usa body.phone como identificador do grupo (e.g. "120363407188318982-group")
      const chatId = body.chatId || body.chat?.id || (isGroup ? body.phone : undefined);
      // Em grupos, body.phone é o número do grupo e body.participantPhone é quem mandou
      const senderPhone = body.participantPhone || body.participant || body.senderPhone || body.phone;

      // Suporte a áudio (Z-API pode enviar type="ReceivedCallback" mas com objeto "audio")
      const isAudio = body.type === "audio" || body.type === "voice" || !!body.audio || !!body.voice;
      const audioUrl = body.audio?.audioUrl || body.voice?.audioUrl || body.audioUrl;

      // Se for áudio, define uma mensagem padrão se vier vazia
      const finalMessage = message || (isAudio ? "[Áudio recebido]" : "");

      if (!phone || !finalMessage) {
        return null;
      }

      return {
        phone: phone,
        message: finalMessage,
        audioUrl: isAudio ? audioUrl : undefined,
        isAudio: isAudio,
        messageId: body.messageId,
        timestamp: body.momment || body.timestamp, // Z-API usa 'momment' (typo) ou timestamp
        instanceId: body.instanceId,
        isGroup,
        chatId: isGroup ? chatId : undefined,
        senderPhone: isGroup ? senderPhone : phone,
      };
    } catch (error) {
      console.error("[Z-API] Erro ao parsear webhook:", error);
      return null;
    }
  }
}
