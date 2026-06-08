import nodemailer, { type Transporter } from "nodemailer";

// Single SMTP transport, created lazily so the app boots without SMTP config.
// Designed for Google Workspace (smtp.gmail.com) using an App Password, but
// works with any SMTP server. When the SMTP env vars are unset we fall back to
// logging the email to the server console — enough to test flows (e.g. the
// set-password link) in local dev.
let transporter: Transporter | null = null;

function getTransport(): Transporter | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !user || !pass) return null;

  if (!transporter) {
    const port = Number(process.env.SMTP_PORT ?? 465);
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS
      auth: { user, pass },
    });
  }
  return transporter;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const transport = getTransport();
  const from = process.env.EMAIL_FROM ?? process.env.SMTP_USER;

  if (!transport || !from) {
    // Dev bypass: no SMTP configured — print to console so flows are testable.
    console.log(
      `\n📧 [DEV EMAIL BYPASS]\n  To:      ${params.to}\n  Subject: ${params.subject}\n  Body:\n${params.text ?? params.html}\n`
    );
    return { success: true };
  }

  try {
    const info = await transport.sendMail({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    return { success: true, id: info.messageId };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Error de envío" };
  }
}

/**
 * Envía al cliente el enlace para crear o restablecer su contraseña.
 */
export async function sendSetPasswordEmail(
  to: string,
  nombre: string,
  link: string
): Promise<SendEmailResult> {
  const saludo = nombre ? `Hola ${nombre},` : "Hola,";
  const subject = "Crea tu contraseña — Vivero Francisco";
  const text = `${saludo}\n\nUsa este enlace para crear tu contraseña y acceder a la app de Vivero Francisco:\n${link}\n\nEl enlace caduca en 24 horas. Si no solicitaste esto, ignora este correo.`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #222; max-width: 480px; margin: 0 auto;">
      <p>${saludo}</p>
      <p>Usa este botón para crear tu contraseña y acceder a la app de <strong>Vivero Francisco</strong>:</p>
      <p style="text-align: center; margin: 28px 0;">
        <a href="${link}" style="background: #2e7d32; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
          Crear mi contraseña
        </a>
      </p>
      <p style="font-size: 13px; color: #666;">O copia este enlace en tu navegador:<br />
        <a href="${link}" style="color: #2e7d32;">${link}</a>
      </p>
      <p style="font-size: 13px; color: #666;">El enlace caduca en 24 horas. Si no solicitaste esto, ignora este correo.</p>
    </div>
  `;
  return sendEmail({ to, subject, html, text });
}
