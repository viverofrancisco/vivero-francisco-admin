import { Resend } from "resend";

// Single Resend client, created lazily so the app boots without an API key.
// When RESEND_API_KEY is unset we fall back to logging the email to the server
// console — enough to test flows (e.g. the set-password link) in local dev.
let client: Resend | null = null;

function getClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new Resend(apiKey);
  return client;
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
  const resend = getClient();
  const from = process.env.EMAIL_FROM;

  if (!resend || !from) {
    // Dev bypass: no provider configured — print to console so flows are testable.
    console.log(
      `\n📧 [DEV EMAIL BYPASS]\n  To:      ${params.to}\n  Subject: ${params.subject}\n  Body:\n${params.text ?? params.html}\n`
    );
    return { success: true };
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, id: data?.id };
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
