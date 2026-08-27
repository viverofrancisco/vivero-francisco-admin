import { OAuth2Client } from "google-auth-library";
import MailComposer from "nodemailer/lib/mail-composer";

// Sends email through the Gmail API using OAuth2 with a refresh token. The
// refresh token is obtained once (consent by the sender Workspace account) and
// stored in env — no service-account key is needed (the org blocks those). The
// message is sent as the account that authorized the refresh token ("me").
// When the OAuth env vars are unset we fall back to logging the email to the
// server console — enough to test flows (e.g. the set-password link) in dev.
const GMAIL_SEND_URL =
  "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

let oauthClient: OAuth2Client | null = null;

function getClient(): OAuth2Client | null {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;

  if (!oauthClient) {
    oauthClient = new OAuth2Client({ clientId, clientSecret });
    oauthClient.setCredentials({ refresh_token: refreshToken });
  }
  return oauthClient;
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
  const message = await new MailComposer({
    from: process.env.EMAIL_FROM,
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
    // Dev bypass: no OAuth credentials configured — print to console so flows are testable.
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

/**
 * El enlace de acceso al **portal**, para alguien del personal.
 *
 * Aparte del de clientes porque dice otra cosa: los clientes entran a la app,
 * el personal al portal, y el enlace de invitación dura otra cantidad de días
 * que el de restablecer. Un solo correo genérico terminaba mandando a la mitad
 * de la gente al lugar equivocado.
 */
export async function sendEnlacePortalEmail(
  to: string,
  nombre: string,
  link: string,
  tipo: "invitacion" | "restablecer",
  /** Cuánto dura, ya escrito: "7 días", "1 hora". */
  vigencia: string
): Promise<SendEmailResult> {
  const saludo = nombre ? `Hola ${nombre},` : "Hola,";
  const esInvitacion = tipo === "invitacion";
  const subject = esInvitacion
    ? "Tu acceso al portal — Vivero Francisco"
    : "Restablece tu contraseña — Vivero Francisco";
  const intro = esInvitacion
    ? "Te damos acceso al portal de <strong>Vivero Francisco</strong>. Crea tu contraseña para entrar:"
    : "Pediste restablecer tu contraseña del portal de <strong>Vivero Francisco</strong>. Elige una nueva:";
  const introTexto = esInvitacion
    ? "Te damos acceso al portal de Vivero Francisco. Crea tu contraseña para entrar:"
    : "Pediste restablecer tu contraseña del portal de Vivero Francisco. Elige una nueva:";
  const boton = esInvitacion ? "Crear mi contraseña" : "Cambiar mi contraseña";
  const caducidad = `El enlace caduca en ${vigencia}. Si no esperabas este correo, ignóralo.`;

  const text = `${saludo}\n\n${introTexto}\n${link}\n\n${caducidad}`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #222; max-width: 480px; margin: 0 auto;">
      <p>${saludo}</p>
      <p>${intro}</p>
      <p style="text-align: center; margin: 28px 0;">
        <a href="${link}" style="background: #2e7d32; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
          ${boton}
        </a>
      </p>
      <p style="font-size: 13px; color: #666;">O copia este enlace en tu navegador:<br />
        <a href="${link}" style="color: #2e7d32;">${link}</a>
      </p>
      <p style="font-size: 13px; color: #666;">${caducidad}</p>
    </div>
  `;
  return sendEmail({ to, subject, html, text });
}
