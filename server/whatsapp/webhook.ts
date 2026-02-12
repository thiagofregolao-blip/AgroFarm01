/**
 * Rotas de webhook para receber mensagens do Z-API
 */

import type { Express, Request, Response } from "express";
import { ZApiClient } from "./zapi-client";
import { WhatsAppService } from "./whatsapp-service";

export function registerWhatsAppRoutes(app: Express, whatsappService: WhatsAppService) {
  /**
   * Webhook para receber mensagens do Z-API
   * Z-API envia POST para este endpoint quando recebe uma mensagem
   */
  app.post("/api/whatsapp/webhook", async (req: Request, res: Response) => {
    try {
      // Parsear mensagem do Z-API
      const message = ZApiClient.parseWebhookMessage(req.body);

      if (!message) {
        console.warn("[WhatsApp] Webhook recebido sem dados válidos:", req.body);
        return res.status(400).json({ error: "Invalid webhook data" });
      }

      // Processar mensagem de forma assíncrona (não bloquear resposta)
      whatsappService.processIncomingMessage(message.phone, message.message).catch((error) => {
        console.error("[WhatsApp] Erro ao processar mensagem:", error);
      });

      // Responder imediatamente ao Z-API (requisito do webhook)
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("[WhatsApp] Erro no webhook:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * Endpoint para verificar status da instância Z-API
   */
  app.get("/api/whatsapp/status", async (req: Request, res: Response) => {
    try {
      const status = await whatsappService.checkStatus();
      res.json(status);
    } catch (error) {
      console.error("[WhatsApp] Erro ao verificar status:", error);
      res.status(500).json({ error: "Failed to check status" });
    }
  });

  /**
   * Endpoint para enviar mensagem de teste (apenas para desenvolvimento)
   */
  app.post("/api/whatsapp/send", async (req: Request, res: Response) => {
    try {
      const { phone, message } = req.body;

      if (!phone || !message) {
        return res.status(400).json({ error: "Phone and message required" });
      }

      const success = await whatsappService.sendMessage(phone, message);
      
      if (success) {
        res.json({ success: true, message: "Message sent" });
      } else {
        res.status(500).json({ error: "Failed to send message" });
      }
    } catch (error) {
      console.error("[WhatsApp] Erro ao enviar mensagem:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
