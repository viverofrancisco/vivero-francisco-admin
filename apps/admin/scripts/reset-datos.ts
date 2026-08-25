/**
 * Borra el movimiento y deja la base lista para volver a sembrar.
 *
 *   npx tsx --env-file=.env scripts/reset-datos.ts             # solo muestra
 *   npx tsx --env-file=.env scripts/reset-datos.ts --ejecutar  # borra
 *
 * **Qué se va:** órdenes, facturas, visitas, suscripciones, informes y el
 * historial de notificaciones. Todo lo que se puede volver a generar.
 *
 * **Qué se queda:** clientes, personal, grupos, sectores, productos, datos de
 * facturación y usuarios. Es la base sobre la que siembra el seed, y dos cosas
 * de ahí **no se pueden rehacer**: los `contificoProductoId` se vincularon a
 * mano y Contífico no tiene DELETE, así que un producto borrado acá obliga a
 * re-vincularlo (o peor, a crear un duplicado permanente allá).
 *
 * Sin `--ejecutar` no toca nada: imprime lo que borraría y lo que dejaría.
 *
 * Ojo con la numeración. Las facturas se van de nuestra base pero **siguen
 * existiendo en Contífico**, y `siguienteSecuencial()` sale del máximo local.
 * Por eso al final imprime el piso que hay que dejar en
 * `CONTIFICO_SECUENCIAL_INICIAL`: sin eso la próxima emisión arranca de un
 * número ya usado y se pelea contra la serie a fuerza de reintentos.
 */
import "dotenv/config";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const EJECUTAR = process.argv.includes("--ejecutar");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL");
  const host = new URL(url).host;
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

  try {
    console.log(`Base: ${host}\n`);

    // El máximo emitido, antes de borrarlo. Es el dato que hace falta después.
    const ultima = await prisma.factura.findFirst({
      orderBy: { numero: "desc" },
      select: { numero: true },
    });

    const quedan = {
      Cliente: await prisma.cliente.count(),
      Personal: await prisma.personal.count(),
      Grupo: await prisma.grupo.count(),
      Sector: await prisma.sector.count(),
      Producto: await prisma.producto.count(),
      DatoFacturacion: await prisma.datoFacturacion.count(),
      User: await prisma.user.count(),
    };

    /** En orden de dependencia: los hijos antes que los padres. */
    const pasos: [string, () => Promise<{ count: number }>][] = [
      ["OrdenLinea", () => prisma.ordenLinea.deleteMany()],
      ["Factura", () => prisma.factura.deleteMany()],
      ["Orden", () => prisma.orden.deleteMany()],
      ["InformeSeccionFoto", () => prisma.informeSeccionFoto.deleteMany()],
      ["InformeSeccion", () => prisma.informeSeccion.deleteMany()],
      ["InformeVisita", () => prisma.informeVisita.deleteMany()],
      ["Informe", () => prisma.informe.deleteMany()],
      ["VisitaMessageMedia", () => prisma.visitaMessageMedia.deleteMany()],
      ["VisitaMessage", () => prisma.visitaMessage.deleteMany()],
      ["VisitaChatRead", () => prisma.visitaChatRead.deleteMany()],
      ["VisitaMedia", () => prisma.visitaMedia.deleteMany()],
      ["VisitaPersonal", () => prisma.visitaPersonal.deleteMany()],
      ["VisitaProducto", () => prisma.visitaProducto.deleteMany()],
      ["Visita", () => prisma.visita.deleteMany()],
      ["SuscripcionItem", () => prisma.suscripcionItem.deleteMany()],
      ["Suscripcion", () => prisma.suscripcion.deleteMany()],
      ["NotificacionLog", () => prisma.notificacionLog.deleteMany()],
    ];

    if (!EJECUTAR) {
      console.log("SE BORRARÍA (nada se tocó todavía):");
      const cuentas: Record<string, number> = {
        OrdenLinea: await prisma.ordenLinea.count(),
        Factura: await prisma.factura.count(),
        Orden: await prisma.orden.count(),
        InformeSeccionFoto: await prisma.informeSeccionFoto.count(),
        InformeSeccion: await prisma.informeSeccion.count(),
        InformeVisita: await prisma.informeVisita.count(),
        Informe: await prisma.informe.count(),
        VisitaMessageMedia: await prisma.visitaMessageMedia.count(),
        VisitaMessage: await prisma.visitaMessage.count(),
        VisitaChatRead: await prisma.visitaChatRead.count(),
        VisitaMedia: await prisma.visitaMedia.count(),
        VisitaPersonal: await prisma.visitaPersonal.count(),
        VisitaProducto: await prisma.visitaProducto.count(),
        Visita: await prisma.visita.count(),
        SuscripcionItem: await prisma.suscripcionItem.count(),
        Suscripcion: await prisma.suscripcion.count(),
        NotificacionLog: await prisma.notificacionLog.count(),
      };
      for (const [k, v] of Object.entries(cuentas)) {
        console.log(`  ${k.padEnd(20)} ${v}`);
      }
    } else {
      console.log("BORRANDO:");
      for (const [nombre, fn] of pasos) {
        const { count } = await fn();
        console.log(`  ${nombre.padEnd(20)} ${count}`);
      }
    }

    console.log("\nSE QUEDA:");
    for (const [k, v] of Object.entries(quedan)) {
      console.log(`  ${k.padEnd(20)} ${v}`);
    }

    if (ultima) {
      const n = Number(ultima.numero.slice(ultima.numero.lastIndexOf("-") + 1));
      console.log(
        `\n⚠️  La última factura emitida fue ${ultima.numero}, y en Contífico sigue\n` +
          `    existiendo. Antes de volver a facturar, dejá en el .env:\n\n` +
          `      CONTIFICO_SECUENCIAL_INICIAL="${n}"\n`
      );
    }

    if (!EJECUTAR) console.log("Nada se borró. Corré de nuevo con --ejecutar.");
  } finally {
    await prisma.$disconnect();
  }
}

main();
