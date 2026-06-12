import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../config';

/**
 * Schlanker, gemeinsamer SMTP-Versand (Einladungen, künftig weitere transaktionale
 * Mails). Spiegelt die Transporter-Konfiguration aus services/newsletter.ts, hält
 * aber generische Mails entkoppelt vom Newsletter-Template.
 */

let transporter: Transporter | null = null;

export function mailerConfigured(): boolean {
  return !!(config.smtpHost && config.smtpUser && config.smtpPass);
}

function getTransporter(): Transporter {
  if (!mailerConfigured()) throw new Error('SMTP ist nicht vollständig konfiguriert');
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: { user: config.smtpUser, pass: config.smtpPass },
    });
  }
  return transporter;
}

export async function sendMail(to: string, subject: string, html: string): Promise<void> {
  await getTransporter().sendMail({ from: config.smtpFrom, to, subject, html });
}
