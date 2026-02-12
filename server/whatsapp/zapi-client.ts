/**
 * Cliente Z-API para envio e recebimento de mensagens WhatsApp
 * Documentação: https://developer.z-api.io/
 */

interface ZApiConfig {
  instanceId: string;
  token: string;
  baseUrl?: string;
}

interface SendMessageParams {
  phone: string; // Número no formato: 5511999999999 (sem +)
  message: string;
  delay?: number; // Delay em segundos antes de enviar
}

interface ZApiWebhookMessage {
  phone: string;
  message: string;
  messageId?: string;
  timestamp?: number;
  instanceId?: string;
}

export class ZApiClient {
  private instanceId: string;
  private token: string;
  private baseUrl: string;

  constructor(config: ZApiConfig) {
    this.instanceId = config.instanceId;
    this.token = config.token;
    this.baseUrl = config.baseUrl || "https://api.z-api.io";
  }

  /**
   * Envia mensagem de texto via Z-API
   */
  async sendTextMessage(params: SendMessageParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const url = `${this.baseUrl}/instances/${this.instanceId}/token/${this.token}/send-text`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: params.phone,
          message: params.message,
          delay: params.delay || 0,
        }),
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

    // Se não começar com código do país, assume Brasil (55)
    if (cleaned.length === 11 && cleaned.startsWith("55") === false) {
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

      if (!phone || !message) {
        return null;
      }

      return {
        phone: phone,
        message: message,
        messageId: body.messageId,
        timestamp: body.momment || body.timestamp, // Z-API usa 'momment' (typo) ou timestamp
        instanceId: body.instanceId,
      };
    } catch (error) {
      console.error("[Z-API] Erro ao parsear webhook:", error);
      return null;
    }
  }
}
