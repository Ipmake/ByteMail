import nodemailer from 'nodemailer';
import { decrypt } from '../utils/encryption';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
}

export interface EmailMessage {
  from: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  inReplyTo?: string;
  references?: string[];
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export class SmtpService {
  private config: SmtpConfig;
  private transporter: nodemailer.Transporter | null = null;

  constructor(config: SmtpConfig) {
    this.config = config;
  }

  private createTransporter(): nodemailer.Transporter {
    return nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: {
        user: this.config.username,
        pass: this.config.password,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  async sendEmail(message: EmailMessage): Promise<any> {
    if (!this.transporter) {
      this.transporter = this.createTransporter();
    }

    const mailOptions = {
      from: message.from,
      to: message.to,
      cc: message.cc,
      bcc: message.bcc,
      subject: message.subject,
      text: message.text,
      html: message.html,
      replyTo: message.replyTo,
      inReplyTo: message.inReplyTo,
      references: message.references,
      attachments: message.attachments,
    };

    const info = await this.transporter.sendMail(mailOptions);
    return info;
  }

  async verifyConnection(): Promise<boolean> {
    try {
      const transporter = this.createTransporter();
      await transporter.verify();
      return true;
    } catch (error) {
      console.error('SMTP verification failed:', error);
      return false;
    }
  }

  static async testConnection(config: SmtpConfig): Promise<boolean> {
    const service = new SmtpService(config);
    return await service.verifyConnection();
  }
}
