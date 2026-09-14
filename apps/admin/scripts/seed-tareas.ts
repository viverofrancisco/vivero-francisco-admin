/**
 * Siembra el catálogo de tareas de visita.
 *
 * **En producción esto ya corrió solo.** La migración
 * `20260914160957_tareas_de_visita` inserta esta misma lista, y el build hace
 * `prisma migrate deploy` antes de compilar: al desplegar, las tareas están en
 * la base el mismo minuto que la pantalla que las usa. Este script existe para
 * volver a sembrar en desarrollo —una base nueva, un branch de Neon recién
 * creado, una tarea borrada de más— sin escribir SQL a mano.
 *
 * Es idempotente **por nombre**: lo que ya está se saltea, no se duplica ni se
 * pisa. Si alguien renombró "Poda de setos" a "Poda de setos y arbustos", esto
 * crea la original al lado en vez de deshacer el cambio; es intencional, porque
 * el catálogo lo manda el admin desde el portal y este script no tiene por qué
 * ganarle.
 *
 *   npx tsx --env-file=.env scripts/seed-tareas.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

/**
 * El catálogo inicial, en el orden en que se trabaja un jardín.
 *
 * El `orden` va de a diez para poder meter una tarea entre dos sin renumerar
 * las demás, igual que los firmantes.
 */
const TAREAS = [
  { nombre: "Poda de césped", orden: 10 },
  { nombre: "Perfilado", orden: 20 },
  { nombre: "Control de maleza", orden: 30 },
  { nombre: "Poda de setos", orden: 40 },
  { nombre: "Poda de árboles", orden: 50 },
  { nombre: "Poda de palmas", orden: 60 },
  {
    nombre:
      "Deshoje de plantas de hojas grandes (alocasias, bijao, heliconias, etc.)",
    orden: 70,
  },
  { nombre: "Control manual de maleza", orden: 80 },
  { nombre: "Control químico de maleza", orden: 90 },
  { nombre: "Fertilización foliar", orden: 100 },
  { nombre: "Fertilización química", orden: 110 },
  { nombre: "Control fitosanitario (prevención de plagas)", orden: 120 },
  { nombre: "Control fitosanitario (tratamiento de plagas)", orden: 130 },
  { nombre: "Verificación del sistema de riego", orden: 140 },
  { nombre: "Aeración, escarificado y top dressing del césped", orden: 150 },
  { nombre: "Aplicación de tierra de sembrado", orden: 160 },
  { nombre: "Siembra de plantas", orden: 170 },
];

async function main() {
  let creadas = 0;
  let existentes = 0;

  for (const tarea of TAREAS) {
    // Solo entre las vivas: una tarea eliminada no bloquea que se vuelva a
    // crear con el mismo nombre — es exactamente lo que hace el índice único
    // parcial de la migración.
    const existe = await prisma.tarea.findFirst({
      where: { nombre: tarea.nombre, deletedAt: null },
      select: { id: true },
    });

    if (existe) {
      console.log(`- Ya existe: ${tarea.nombre}`);
      existentes++;
      continue;
    }

    await prisma.tarea.create({ data: tarea });
    console.log(`✓ Creada:   ${tarea.nombre}`);
    creadas++;
  }

  console.log(`\nResumen: ${creadas} creadas, ${existentes} ya existían`);
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
