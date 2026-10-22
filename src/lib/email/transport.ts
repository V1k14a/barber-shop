import nodemailer, { type Transporter } from "nodemailer";

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: { filename: string; content: string; contentType: string }[];
}

export type SendMail = (msg: MailMessage) => Promise<void>;

let transporter: Transporter | null = null;

/**
 * SMTP transport from environment variables. Without SMTP_HOST (local
 * development) e-mails are printed to the server log instead of sent.
 */
function getTransport(): Transporter | null {
  if (!process.env.SMTP_HOST) return null;
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transporter;
}

export const sendMail: SendMail = async (msg) => {
  const from = process.env.MAIL_FROM ?? "Salon de Choix <no-reply@salondechoix.dk>";
  const t = getTransport();
  if (!t) {
    console.info(`[email:dev] To: ${msg.to} | ${msg.subject}\n${msg.text}\n`);
    return;
  }
  await t.sendMail({ from, replyTo: process.env.MAIL_REPLY_TO, ...msg });
};

export function appUrl(path = ""): string {
  return `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}${path}`;
}
