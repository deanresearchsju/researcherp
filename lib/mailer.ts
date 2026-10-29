import nodemailer from "nodemailer";

/**
 * Outgoing mail through the university's SMTP account. The settings live in the server
 * environment (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM); without them the
 * ERP keeps working and simply does not send mail.
 */
export function mailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;

function transporter() {
  if (transport) return transport;
  const port = Number(process.env.SMTP_PORT) || 587;
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return transport;
}

export async function sendMail(message: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  if (!mailConfigured()) return { ok: false as const, reason: "not-configured" as const };
  try {
    await transporter().sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    return { ok: true as const };
  } catch (error) {
    console.error("mail failed", error instanceof Error ? error.message : error);
    return { ok: false as const, reason: "failed" as const };
  }
}
