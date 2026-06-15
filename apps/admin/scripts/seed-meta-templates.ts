import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const API_VERSION = "v21.0";
const token = process.env.WHATSAPP_API_TOKEN!;
const businessId = process.env.WHATSAPP_BUSINESS_ID!;

const SAMPLE_VALUES: Record<string, string> = {
  nombre: "Juan",
  apellido: "Pérez",
  fechaVisita: "lunes, 7 de abril de 2025",
  servicio: "Mantenimiento de jardín",
  direccion: "Av. Principal 123",
  fecha: "lunes, 7 de abril de 2025",
  totalVisitas: "5",
  listaVisitas: "1. Juan - Mantenimiento",
  estado: "COMPLETADA",
  horaEntrada: "09:00",
  horaSalida: "11:30",
  motivo: "Cliente no disponible",
};

function convertToPositional(contenido: string, variables: string[]): { bodyText: string; usedVars: string[] } {
  const usedVars = variables.filter((v) => contenido.includes(`{{${v}}}`));
  let bodyText = contenido;
  usedVars.forEach((varName, index) => {
    bodyText = bodyText.replaceAll(`{{${varName}}}`, `{{${index + 1}}}`);
  });
  return { bodyText, usedVars };
}

async function createTemplate(name: string, language: string, bodyText: string, exampleValues: string[]) {
  const url = `https://graph.facebook.com/${API_VERSION}/${businessId}/message_templates`;

  const bodyComponent: Record<string, unknown> = {
    type: "BODY",
    text: bodyText,
  };

  if (exampleValues.length > 0) {
    bodyComponent.example = {
      body_text: [exampleValues],
    };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      language,
      category: "UTILITY",
      components: [bodyComponent],
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    const errorMsg = data?.error?.error_user_msg || data?.error?.message || `HTTP ${res.status}`;
    return { success: false, error: errorMsg, status: null };
  }

  return { success: true, error: null, status: data.status as string };
}

async function createAuthTemplate(name: string, language: string) {
  const url = `https://graph.facebook.com/${API_VERSION}/${businessId}/message_templates`;

  const components: Record<string, unknown>[] = [
    { type: "BODY", add_security_recommendation: true },
    { type: "FOOTER", code_expiration_minutes: 5 },
    {
      type: "BUTTONS",
      buttons: [
        { type: "OTP", otp_type: "COPY_CODE", text: "Copiar código" },
      ],
    },
  ];

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      language,
      category: "AUTHENTICATION",
      components,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    const errorMsg = data?.error?.error_user_msg || data?.error?.message || `HTTP ${res.status}`;
    return { success: false, error: errorMsg, status: null };
  }

  return { success: true, error: null, status: data.status as string };
}

async function createInviteTemplate(name: string, language: string, bodyText: string) {
  const base = (process.env.APP_BASE_URL ?? "http://localhost:3001").replace(/\/$/, "");
  const url = `https://graph.facebook.com/${API_VERSION}/${businessId}/message_templates`;

  // UTILITY template con el saludo en el body ({{1}} = nombre) y el enlace en un
  // botón URL dinámico cuyo sufijo {{1}} es el token. Meta exige que la parte
  // variable esté al final de la URL. El dominio base se fija aquí desde
  // APP_BASE_URL, así que debe ser la URL pública real al crear el template.
  const components = [
    {
      type: "BODY",
      text: bodyText,
      example: { body_text: [["Juan"]] },
    },
    {
      type: "BUTTONS",
      buttons: [
        {
          type: "URL",
          text: "Crear contraseña",
          url: `${base}/establecer-contrasena?token={{1}}`,
          example: [`${base}/establecer-contrasena?token=token_de_ejemplo_123`],
        },
      ],
    },
  ];

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    // allow_category_change deja que Meta asigne la categoría correcta en vez de
    // rechazar con INCORRECT_CATEGORY (un enlace de "crear contraseña" cae en
    // zona gris entre UTILITY/MARKETING para Meta).
    body: JSON.stringify({
      name,
      language,
      category: "UTILITY",
      allow_category_change: true,
      components,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    const errorMsg = data?.error?.error_user_msg || data?.error?.message || `HTTP ${res.status}`;
    return { success: false, error: errorMsg, status: null };
  }

  return { success: true, error: null, status: data.status as string };
}

async function main() {
  if (!token || !businessId) {
    console.error("Error: WHATSAPP_API_TOKEN y WHATSAPP_BUSINESS_ID son requeridos en .env");
    process.exit(1);
  }

  console.log("Creando templates default en Meta...\n");

  const plantillas = await prisma.notificacionPlantilla.findMany();

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const p of plantillas) {
    // Skip if already has a default template
    if (p.whatsappDefaultTemplateName) {
      console.log(`- ${p.nombre}: ya tiene template default (${p.whatsappDefaultTemplateName})`);
      skipped++;
      continue;
    }

    // Meta bloquea por un tiempo el nombre de un template borrado, así que para
    // INVITACION_CUENTA usamos un nombre nuevo (el _default quedó bloqueado tras
    // borrar el rechazado). El nombre real se guarda en la DB y el envío lo lee
    // de ahí, así que cualquier nombre es válido mientras sea consistente.
    const TEMPLATE_NAME_OVERRIDES: Record<string, string> = {
      INVITACION_CUENTA: "invitacion_cuenta",
    };
    const templateName =
      TEMPLATE_NAME_OVERRIDES[p.tipo] ?? `${p.tipo.toLowerCase()}_default`;
    console.log(`Creando: ${templateName}...`);

    const result =
      p.tipo === "AUTENTICACION_OTP"
        ? await createAuthTemplate(templateName, p.whatsappTemplateLanguage)
        : p.tipo === "INVITACION_CUENTA"
          ? await (async () => {
              // Meta rechaza botones URL con localhost/http. El template solo se
              // puede crear/aprobar con el dominio público real en APP_BASE_URL.
              const base = (process.env.APP_BASE_URL ?? "").trim();
              if (!/^https:\/\//i.test(base) || /localhost|127\.0\.0\.1/i.test(base)) {
                return {
                  success: false,
                  error: `APP_BASE_URL debe ser una URL pública HTTPS (actual: "${base || "(vacío)"}"). Meta rechaza localhost/http en botones URL. Omitido.`,
                  status: null,
                };
              }
              const { bodyText } = convertToPositional(p.contenido, p.variables);
              return createInviteTemplate(
                templateName,
                p.whatsappTemplateLanguage,
                bodyText
              );
            })()
          : await (async () => {
              const { bodyText, usedVars } = convertToPositional(
                p.contenido,
                p.variables
              );
              const exampleValues = usedVars.map((v) => SAMPLE_VALUES[v] || v);
              return createTemplate(
                templateName,
                p.whatsappTemplateLanguage,
                bodyText,
                exampleValues
              );
            })();

    if (!result.success) {
      console.error(`  ✗ Error: ${result.error}`);
      failed++;
      continue;
    }

    await prisma.notificacionPlantilla.update({
      where: { id: p.id },
      data: {
        contenidoOriginal: p.contenido,
        whatsappDefaultTemplateName: templateName,
        whatsappDefaultTemplateStatus: result.status || "PENDING",
      },
    });

    console.log(`  ✓ Creado (status: ${result.status || "PENDING"})`);
    created++;
  }

  console.log(`\nResumen: ${created} creados, ${skipped} ya existían, ${failed} fallaron`);
  console.log("\nLos templates deben ser aprobados por Meta antes de poder enviar mensajes.");
  console.log("Usa 'Verificar estado' en la app o espera el webhook para confirmar la aprobación.");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
