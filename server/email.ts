import nodemailer from "nodemailer";

interface EmailConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  auth?: {
    user?: string;
    pass?: string;
  };
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const emailHost = process.env.EMAIL_HOST;
    const emailPort = process.env.EMAIL_PORT;
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    if (emailHost && emailUser && emailPass) {
      this.transporter = nodemailer.createTransporter({
        host: emailHost,
        port: emailPort ? parseInt(emailPort) : 587,
        secure: emailPort === "465",
        auth: {
          user: emailUser,
          pass: emailPass,
        },
      });
    } else {
      console.warn("Email credentials not configured. Password reset emails will not be sent.");
      this.transporter = null;
    }
  }

  async sendPasswordResetEmail(to: string, resetToken: string, userName: string): Promise<boolean> {
    if (!this.transporter) {
      console.error("Email transporter not configured");
      return false;
    }

    const resetUrl = `${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/reset-password/${resetToken}`;

    try {
      await this.transporter.sendMail({
        from: `"Agro Farm Digital" <${process.env.EMAIL_USER}>`,
        to,
        subject: "Recuperação de Senha - Agro Farm Digital",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #22c55e;">Recuperação de Senha</h2>
            <p>Olá, <strong>${userName}</strong>!</p>
            <p>Você solicitou a recuperação de senha para sua conta no <strong>Agro Farm Digital</strong>.</p>
            <p>Clique no botão abaixo para redefinir sua senha:</p>
            <div style="margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background-color: #22c55e; color: white; padding: 12px 24px; 
                        text-decoration: none; border-radius: 4px; display: inline-block;">
                Redefinir Senha
              </a>
            </div>
            <p>Ou copie e cole este link no seu navegador:</p>
            <p style="background-color: #f3f4f6; padding: 10px; border-radius: 4px; word-break: break-all;">
              ${resetUrl}
            </p>
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              <strong>Este link expira em 1 hora.</strong>
            </p>
            <p style="color: #6b7280; font-size: 14px;">
              Se você não solicitou esta recuperação de senha, ignore este email.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="color: #9ca3af; font-size: 12px;">
              Agro Farm Digital - Sistema de Gestão Agrícola
            </p>
          </div>
        `,
      });
      
      return true;
    } catch (error) {
      console.error("Error sending password reset email:", error);
      return false;
    }
  }

  isConfigured(): boolean {
    return this.transporter !== null;
  }
}

export const emailService = new EmailService();
