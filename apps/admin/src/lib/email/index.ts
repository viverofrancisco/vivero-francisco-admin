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
  /**
   * Archivos adjuntos. Los usa la factura electrónica, que se manda con su
   * RIDE en PDF y su XML: el PDF es el que la gente lee y el XML es el
   * documento legal, así que el cliente necesita los dos.
   */
  attachments?: { filename: string; content: Buffer; contentType: string }[];
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
    attachments: params.attachments,
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
 * El código para crear una cuenta de cliente desde la app. Un código y no un
 * enlace: quien se registra está mirando la app, y tener que ir al correo,
 * tocar un enlace y volver es perderlo a mitad de camino.
 */
export async function sendCodigoDeRegistroEmail(
  to: string,
  nombre: string,
  codigo: string
): Promise<SendEmailResult> {
  const saludo = nombre ? `Hola ${nombre},` : "Hola,";
  const subject = `${codigo} es tu código — Vivero Francisco`;
  const text = `${saludo}\n\nTu código para crear tu cuenta en la app de Vivero Francisco es:\n\n${codigo}\n\nVence en 15 minutos. Si no pediste esto, ignora este correo.`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #222; max-width: 480px; margin: 0 auto;">
      <p>${saludo}</p>
      <p>Tu código para crear tu cuenta en la app de <strong>Vivero Francisco</strong> es:</p>
      <p style="text-align: center; margin: 28px 0; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2e7d32;">${codigo}</p>
      <p style="font-size: 13px; color: #666;">Vence en 15 minutos. Si no pediste esto, ignora este correo.</p>
    </div>
  `;
  return sendEmail({ to, subject, html, text });
}

/** El código para confirmar el correo nuevo de un cliente, al correo nuevo. */
export async function sendCodigoDeCambioDeCorreoEmail(
  to: string,
  nombre: string,
  codigo: string
): Promise<SendEmailResult> {
  const saludo = nombre ? `Hola ${nombre},` : "Hola,";
  const subject = `${codigo} es tu código — Vivero Francisco`;
  const text = `${saludo}\n\nTu código para usar este correo en tu cuenta de Vivero Francisco es:\n\n${codigo}\n\nVence en 15 minutos. Si no pediste esto, ignora este correo.`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #222; max-width: 480px; margin: 0 auto;">
      <p>${saludo}</p>
      <p>Tu código para usar este correo en tu cuenta de <strong>Vivero Francisco</strong> es:</p>
      <p style="text-align: center; margin: 28px 0; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2e7d32;">${codigo}</p>
      <p style="font-size: 13px; color: #666;">Vence en 15 minutos. Si no pediste esto, ignora este correo.</p>
    </div>
  `;
  return sendEmail({ to, subject, html, text });
}

/**
 * El aviso al correo **anterior** cuando la cuenta cambia de correo: si no lo
 * cambió su dueño, es la única forma de que se entere.
 */
export async function sendAvisoDeCorreoCambiadoEmail(
  to: string,
  nombre: string,
  nuevo: string
): Promise<SendEmailResult> {
  const saludo = nombre ? `Hola ${nombre},` : "Hola,";
  const subject = "Cambiaste el correo de tu cuenta — Vivero Francisco";
  const text = `${saludo}\n\nEl correo de tu cuenta en la app de Vivero Francisco ahora es ${nuevo}. Desde ahora entras con ese.\n\nSi no fuiste tú, comunícate con el vivero.`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #222; max-width: 480px; margin: 0 auto;">
      <p>${saludo}</p>
      <p>El correo de tu cuenta en la app de <strong>Vivero Francisco</strong> ahora es <strong>${nuevo}</strong>. Desde ahora entras con ese.</p>
      <p style="font-size: 13px; color: #666;">Si no fuiste tú, comunícate con el vivero.</p>
    </div>
  `;
  return sendEmail({ to, subject, html, text });
}

/**
 * Un cliente hizo un pedido desde la app: al equipo, con lo pedido, cómo se
 * entrega y el enlace al pedido en el portal. Va **uno por persona** y no
 * todos en *Para*, que dejaría a cada uno viendo el correo de los demás.
 */
export async function sendNuevoPedidoEmail(
  destinatarios: string[],
  p: {
    numero: number;
    cliente: string;
    telefono: string | null;
    comoSeEntrega: string;
    notas: string | null;
    lineas: { descripcion: string; cantidad: number; total: number }[];
    total: number;
    enlace: string;
  }
): Promise<void> {
  const dinero = (n: number) => `$${n.toFixed(2)}`;
  const porCotizar = p.lineas.some((l) => l.total === 0);
  const subject = `Nuevo pedido #${p.numero} de ${p.cliente}`;
  const filasTexto = p.lineas
    .map((l) => `- ${l.cantidad} × ${l.descripcion}: ${l.total > 0 ? dinero(l.total) : "por cotizar"}`)
    .join("\n");
  const text = [
    `${p.cliente} hizo el pedido #${p.numero} desde la app.`,
    p.telefono ? `Teléfono: ${p.telefono}` : null,
    p.comoSeEntrega,
    "",
    filasTexto,
    "",
    `Total: ${dinero(p.total)}${porCotizar ? " (más lo que está por cotizar)" : ""}`,
    p.notas ? `\nNotas: ${p.notas}` : null,
    "",
    `Ver el pedido: ${p.enlace}`,
  ]
    .filter((x) => x !== null)
    .join("\n");
  const escapar = (t: string) =>
    t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const filasHtml = p.lineas
    .map(
      (l) => `<tr>
        <td style="padding: 6px 0; border-bottom: 1px solid #eee;">${l.cantidad} × ${escapar(l.descripcion)}</td>
        <td style="padding: 6px 0; border-bottom: 1px solid #eee; text-align: right; white-space: nowrap; color: ${l.total > 0 ? "#222" : "#8a5a00"};">${l.total > 0 ? dinero(l.total) : "Por cotizar"}</td>
      </tr>`
    )
    .join("");
  const html = `
    <div style="font-family: Arial, sans-serif; color: #222; max-width: 520px; margin: 0 auto;">
      <p><strong>${escapar(p.cliente)}</strong> hizo el pedido <strong>#${p.numero}</strong> desde la app.</p>
      <p style="color: #555; margin: 4px 0;">${escapar(p.comoSeEntrega)}${p.telefono ? ` · ${escapar(p.telefono)}` : ""}</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">${filasHtml}
        <tr><td style="padding: 8px 0; font-weight: bold;">Total</td><td style="padding: 8px 0; text-align: right; font-weight: bold;">${dinero(p.total)}</td></tr>
      </table>
      ${porCotizar ? `<p style="font-size: 13px; color: #8a5a00;">Tiene productos por cotizar: ponles precio antes de confirmarlo.</p>` : ""}
      ${p.notas ? `<p style="font-size: 13px; color: #555;"><strong>Notas:</strong> ${escapar(p.notas)}</p>` : ""}
      <p style="text-align: center; margin: 24px 0;">
        <a href="${p.enlace}" style="background: #2e7d32; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Ver el pedido</a>
      </p>
    </div>
  `;
  await Promise.all(destinatarios.map((to) => sendEmail({ to, subject, html, text })));
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
