import { JWT } from "google-auth-library";
import MailComposer from "nodemailer/lib/mail-composer";

// Sends email through the Gmail API using a Google service account with
// domain-wide delegation: the service account impersonates a Workspace mailbox
// (GMAIL_SENDER) and sends with the gmail.send scope. No static mailbox
// password is stored. When the service-account env vars are unset we fall back
// to logging the email to the server console — enough to test flows (e.g. the
// set-password link) in local dev.
const SCOPES = ["https://www.googleapis.com/auth/gmail.send"];
const GMAIL_SEND_URL =
  "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

let jwtClient: JWT | null = null;

/** The Workspace mailbox to send as (impersonated by the service account). */
function getSenderAddress(): string | null {
  if (process.env.GMAIL_SENDER) return process.env.GMAIL_SENDER;
  // Fall back to the address inside EMAIL_FROM ("Nombre <addr>" or "addr").
  const from = process.env.EMAIL_FROM;
  if (!from) return null;
  const match = from.match(/<([^>]+)>/);
  return match ? match[1] : from.trim();
}

function getClient(): JWT | null {
  const email = process.env.GMAIL_CLIENT_EMAIL;
  const key = process.env.GMAIL_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const subject = getSenderAddress();
  if (!email || !key || !subject) return null;

  if (!jwtClient) {
    jwtClient = new JWT({ email, key, scopes: SCOPES, subject });
  }
  return jwtClient;
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

/** Build a base64url-encoded RFC822 message for the Gmail API. */
async function buildRawMessage(params: SendEmailParams): Promise<string> {
  const from = process.env.EMAIL_FROM ?? getSenderAddress() ?? undefined;
  const message = await new MailComposer({
    from,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
  })
    .compile()
    .build();

  return message
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const client = getClient();

  if (!client) {
    // Dev bypass: no service account configured — print to console so flows are testable.
    console.log(
      `\n📧 [DEV EMAIL BYPASS]\n  To:      ${params.to}\n  Subject: ${params.subject}\n  Body:\n${params.text ?? params.html}\n`
    );
    return { success: true };
  }

  try {
    const raw = await buildRawMessage(params);
    const { token } = await client.getAccessToken();
    if (!token) return { success: false, error: "No se pudo obtener token de Gmail" };

    const res = await fetch(GMAIL_SEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return { success: false, error: `Gmail API ${res.status}: ${detail}` };
    }

    const data = (await res.json()) as { id?: string };
    return { success: true, id: data.id };
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
