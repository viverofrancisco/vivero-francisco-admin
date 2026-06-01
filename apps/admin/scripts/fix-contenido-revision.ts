import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

/**
 * One-off migration script to fix `contenido` field semantics.
 *
 * Before this change, `contenido` could hold either the approved content
 * or the in-review content. Now `contenido` always holds the approved
 * content, and `contenidoEnRevision` holds in-review content.
 *
 * Cleanup rules:
 * 1. If there's no custom template AND contenido != contenidoOriginal:
 *    reset contenido = contenidoOriginal (leftover from a cancelled review)
 *
 * 2. If whatsappTemplateName has PENDING status (first-edit in review):
 *    move contenido → contenidoEnRevision, reset contenido = contenidoOriginal
 *
 * 3. If whatsappPendingTemplateName exists (update of approved custom):
 *    move contenido → contenidoEnRevision. We don't know what the
 *    previously approved custom content was, so leave contenido as-is.
 */
async function main() {
  const plantillas = await prisma.notificacionPlantilla.findMany();

  let reset = 0;
  let firstEditFixed = 0;
  let updateFixed = 0;

  for (const p of plantillas) {
    if (!p.contenidoOriginal) {
      console.log(`- ${p.nombre}: sin contenidoOriginal, saltando`);
      continue;
    }

    const hasPending = !!p.whatsappPendingTemplateName;
    const hasCustom = !!p.whatsappTemplateName;
    const customPending =
      hasCustom && p.whatsappTemplateStatus !== "APPROVED";

    // Case 3: Has pending (update)
    if (hasPending) {
      await prisma.notificacionPlantilla.update({
        where: { id: p.id },
        data: { contenidoEnRevision: p.contenido },
      });
      console.log(`  ✓ ${p.nombre}: movido contenido → contenidoEnRevision (update pendiente)`);
      updateFixed++;
      continue;
    }

    // Case 2: First-edit pending
    if (customPending) {
      await prisma.notificacionPlantilla.update({
        where: { id: p.id },
        data: {
          contenidoEnRevision: p.contenido,
          contenido: p.contenidoOriginal,
        },
      });
      console.log(`  ✓ ${p.nombre}: movido a revision, contenido = original (primer edit pendiente)`);
      firstEditFixed++;
      continue;
    }

    // Case 1: No custom, content was edited but no template exists (leftover from cancelled review)
    if (!hasCustom && p.contenido !== p.contenidoOriginal) {
      await prisma.notificacionPlantilla.update({
        where: { id: p.id },
        data: { contenido: p.contenidoOriginal },
      });
      console.log(`  ✓ ${p.nombre}: resetado contenido = original (sin custom)`);
      reset++;
      continue;
    }

    console.log(`- ${p.nombre}: ya esta OK`);
  }

  console.log(`\nResumen:`);
  console.log(`- ${reset} contenidos reseteados a original`);
  console.log(`- ${firstEditFixed} primeros edits movidos a revision`);
  console.log(`- ${updateFixed} updates movidos a revision`);
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
