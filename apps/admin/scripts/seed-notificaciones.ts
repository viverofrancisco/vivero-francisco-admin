import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const DEFAULT_PLANTILLAS = [
  {
    tipo: "CONFIRMACION_VISITA_CLIENTE" as const,
    nombre: "Confirmación de visita",
    contenido:
      "Hola {{nombre}} {{apellido}}, le confirmamos su visita de {{servicio}} programada para el {{fechaVisita}}. ¡Gracias por confiar en Vivero Francisco!",
    variables: ["nombre", "apellido", "fechaVisita", "servicio", "direccion"],
  },
  {
    tipo: "RECORDATORIO_VISITA_CLIENTE" as const,
    nombre: "Recordatorio de visita",
    contenido:
      "Hola {{nombre}} {{apellido}}, le recordamos que mañana tiene programada una visita de {{servicio}}. ¡Lo esperamos!",
    variables: ["nombre", "apellido", "fechaVisita", "servicio", "direccion"],
  },
  {
    tipo: "RESUMEN_DIARIO_ADMIN" as const,
    nombre: "Resumen diario de visitas",
    contenido:
      "Resumen del día {{fecha}}\n\nTotal de visitas programadas: {{totalVisitas}}\n\n{{listaVisitas}}",
    variables: ["fecha", "totalVisitas", "listaVisitas"],
  },
  {
    tipo: "ALERTA_VISITA_COMPLETADA" as const,
    nombre: "Alerta de visita completada",
    contenido:
      "Visita completada\nCliente: {{nombre}} {{apellido}}\nServicio: {{servicio}}\nFecha: {{fechaVisita}}\nHora: {{horaEntrada}} - {{horaSalida}}",
    variables: [
      "nombre",
      "apellido",
      "fechaVisita",
      "servicio",
      "estado",
      "horaEntrada",
      "horaSalida",
    ],
  },
  {
    tipo: "ALERTA_VISITA_INCOMPLETA" as const,
    nombre: "Alerta de visita incompleta/cancelada",
    contenido:
      "Visita {{estado}}\nCliente: {{nombre}} {{apellido}}\nServicio: {{servicio}}\nFecha: {{fechaVisita}}\nMotivo: {{motivo}}",
    variables: ["nombre", "apellido", "fechaVisita", "servicio", "estado", "motivo"],
  },
  {
    tipo: "MENSAJE_ENTRANTE_CLIENTE" as const,
    nombre: "Notificación de mensaje entrante",
    contenido:
      "Nuevo mensaje recibido.\nCliente: {{nombre}}\nTeléfono: {{telefono}}\nMensaje: {{mensaje}}",
    variables: ["nombre", "telefono", "mensaje"],
  },
  {
    tipo: "AUTENTICACION_OTP" as const,
    nombre: "Código de verificación",
    contenido: "{{codigo}} es tu código de verificación.",
    variables: ["codigo"],
  },
];

async function main() {
  console.log("Seeding notificaciones...\n");

  // 1. Ensure NotificacionConfig exists
  const existingConfig = await prisma.notificacionConfig.findFirst();
  if (!existingConfig) {
    await prisma.notificacionConfig.create({ data: {} });
    console.log("✓ NotificacionConfig creado");
  } else {
    console.log("- NotificacionConfig ya existe");
  }

  // 2. Seed plantillas
  let created = 0;
  let skipped = 0;

  for (const p of DEFAULT_PLANTILLAS) {
    const existing = await prisma.notificacionPlantilla.findUnique({
      where: { tipo: p.tipo },
    });

    if (!existing) {
      await prisma.notificacionPlantilla.create({ data: p });
      console.log(`✓ Plantilla creada: ${p.nombre}`);
      created++;
    } else {
      console.log(`- Plantilla ya existe: ${p.nombre}`);
      skipped++;
    }
  }

  console.log(`\nResumen: ${created} creadas, ${skipped} ya existían`);
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
