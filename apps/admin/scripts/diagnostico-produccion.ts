/**
 * Reproduce contra producción las consultas de las páginas que dan 500.
 *
 * Solo lecturas. Se corre con la DATABASE_URL de producción por delante:
 *   DATABASE_URL="postgresql://…" npx tsx apps/admin/scripts/diagnostico-produccion.ts
 */
import { prisma } from "@/lib/prisma";
import { listInformesYBorradores, getInforme } from "@/lib/services/informe.service";

async function probar(nombre: string, fn: () => Promise<unknown>) {
  try {
    const r = await fn();
    const n = Array.isArray(r) ? r.length : typeof r === "object" && r && "items" in r ? (r as { items: unknown[] }).items.length : 1;
    console.log(`✓ ${nombre} — ${n} fila(s)`);
  } catch (e) {
    console.log(`✗ ${nombre}`);
    console.log(`    ${e instanceof Error ? e.message.split("\n").join("\n    ") : String(e)}`);
  }
}

async function main() {
  console.log(`base: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":****@").slice(0, 80)}…\n`);

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true, name: true } });
  if (!admin) return console.log("✗ no hay ningún usuario ADMIN");
  const viewer = { id: admin.id, role: "ADMIN" as const, personalId: null, clienteId: null, nombre: admin.name ?? "" };

  // Lo que consulta /dashboard/productos
  await probar("productos: catálogo con variantes", () =>
    prisma.producto.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, nombre: true, tipo: true, descripcion: true, codigo: true, deletedAt: true,
        categorias: { select: { categoria: { select: { id: true, nombre: true } } } },
        variantes: { select: { manejaInventario: true, stock: true } },
      },
    })
  );
  await probar("productos: categorías", () =>
    prisma.categoria.findMany({ orderBy: [{ orden: "asc" }, { nombre: "asc" }], select: { id: true, nombre: true } })
  );

  // Lo que consulta /dashboard/informes
  await probar("informes: lista unida con borradores", () =>
    listInformesYBorradores(viewer, { offset: 0, limit: 20 })
  );

  const uno = await prisma.informe.findFirst({ select: { id: true, numero: true } });
  if (uno) {
    await probar(`informes: ficha del #${uno.numero}`, () => getInforme(viewer, uno.id));
  }

  // Cosas nuevas que las páginas tocan de refilón
  await probar("media: biblioteca", () => prisma.media.findMany({ take: 5 }));
  await probar("variantes", () => prisma.variante.findMany({ take: 5 }));
  await probar("versiones de informe", () => prisma.informeVersion.findMany({ take: 5 }));
  await probar("borradores de informe", () => prisma.informeBorrador.findMany({ take: 5 }));

  await prisma.$disconnect();
}
main().catch((e) => { console.error("FALLÓ ENTERO:", e); process.exit(1); });
