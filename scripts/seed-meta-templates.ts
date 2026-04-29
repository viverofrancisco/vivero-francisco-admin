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

    const templateName = `${p.tipo.toLowerCase()}_default`;
    const { bodyText, usedVars } = convertToPositional(p.contenido, p.variables);
    const exampleValues = usedVars.map((v) => SAMPLE_VALUES[v] || v);

    console.log(`Creando: ${templateName}...`);

    const result = await createTemplate(
      templateName,
      p.whatsappTemplateLanguage,
      bodyText,
      exampleValues
    );

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
