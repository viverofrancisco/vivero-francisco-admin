/**
 * Una visita lista para probar el informe: con partes cargados y fotos reales.
 *
 * Existe porque el flujo nuevo no se puede probar con lo que ya está en la
 * base: las visitas viejas no tienen partes —nadie cargó lo que hizo— y no hay
 * una sola foto. Esto arma el escenario mínimo que hace visible lo que cambió:
 *
 *   - dos visitas del mismo cliente, cerradas, con **dos personas** cada una;
 *   - una tarea hecha en **las dos** visitas, para ver que el wizard la junta
 *     en una sola sección con las fotos de ambas;
 *   - una tarea hecha **sin fotos**, que igual tiene que aparecer;
 *   - una foto etiquetada con una tarea que **nadie cargó**, que también;
 *   - y una foto **sin etiquetar**, que no debe inventar ninguna sección.
 *
 * **Las fotos se suben de verdad a R2.** Una URL inventada rompe la vista
 * previa del informe y el PDF: `lib/informes/fotos.ts` las descarga para
 * encogerlas. Se generan con `sharp` —un color plano con el nombre de la tarea
 * encima— así que cada una se reconoce de un vistazo en el PDF.
 *
 * No inventa clientes ni personal: usa los que ya están. Todo lo que crea queda
 * anotado en `scripts/.visita-con-fotos.json`, y `--limpiar` borra exactamente
 * eso, los objetos de R2 incluidos.
 *
 *   npx tsx --env-file=.env scripts/seed-visita-con-fotos.ts
 *   npx tsx --env-file=.env scripts/seed-visita-con-fotos.ts --limpiar
 */
import "dotenv/config";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MANIFIESTO = join(__dirname, ".visita-con-fotos.json");

interface Manifiesto {
  visitas: string[];
  keys: string[];
}

/** Una imagen de verdad, con el texto encima para reconocerla en el PDF. */
async function imagen(texto: string, color: string): Promise<Buffer> {
  const svg = `<svg width="1400" height="1050">
    <rect width="1400" height="1050" fill="${color}"/>
    <text x="700" y="500" font-family="Helvetica" font-size="64" font-weight="bold"
          fill="#ffffff" text-anchor="middle">${texto.replace(/&/g, "&amp;").slice(0, 34)}</text>
    <text x="700" y="580" font-family="Helvetica" font-size="34"
          fill="#ffffffcc" text-anchor="middle">foto de prueba</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
}

async function limpiar() {
  if (!existsSync(MANIFIESTO)) {
    console.log("No hay nada sembrado por este script.");
    return;
  }
  const m: Manifiesto = JSON.parse(readFileSync(MANIFIESTO, "utf8"));
  const { prisma } = await import("@/lib/prisma");
  const { deleteObjects } = await import("@/lib/s3");

  // Primero R2: si falla la base, al menos no quedan archivos huérfanos que
  // nadie sepa que están.
  await deleteObjects(m.keys);
  console.log(`  ${m.keys.length} archivo(s) borrados de R2`);

  for (const id of m.visitas) {
    await prisma.visitaMedia.deleteMany({ where: { visitaId: id } });
    await prisma.visitaPersonalTarea.deleteMany({
      where: { visitaPersonal: { visitaId: id } },
    });
    await prisma.visitaTareaObligatoria.deleteMany({ where: { visitaId: id } });
    await prisma.visitaPersonal.deleteMany({ where: { visitaId: id } });
    await prisma.visita.delete({ where: { id } }).catch(() => {
      console.log(`  ⚠ la visita ${id} no se pudo borrar (¿tiene informe u orden?)`);
    });
  }
  console.log(`  ${m.visitas.length} visita(s) borradas`);
  unlinkSync(MANIFIESTO);
  await prisma.$disconnect();
}

async function sembrar() {
  if (existsSync(MANIFIESTO)) {
    console.log(
      "Ya hay una visita de prueba sembrada (scripts/.visita-con-fotos.json).\n" +
        "Corré con --limpiar antes de volver a sembrar."
    );
    return;
  }

  const { prisma } = await import("@/lib/prisma");
  const { getUploadUrl, publicUrlForKey } = await import("@/lib/s3");
  const visitaSvc = await import("@/lib/services/visita.service");

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true, name: true, apellido: true },
  });
  if (!admin) throw new Error("No hay ningún ADMIN en la base.");
  const viewer = {
    id: admin.id,
    role: "ADMIN" as const,
    personalId: null,
    clienteId: null,
    nombre: [admin.name, admin.apellido].filter(Boolean).join(" ") || "Admin",
  };

  // Un cliente con dirección, que es el que mejor se ve en el encabezado del
  // informe; si no hay ninguno así, el primero que aparezca.
  const cliente =
    (await prisma.cliente.findFirst({
      where: { deletedAt: null, direccion: { not: null } },
      select: { id: true, nombre: true, apellido: true, empresa: true },
    })) ??
    (await prisma.cliente.findFirst({
      where: { deletedAt: null },
      select: { id: true, nombre: true, apellido: true, empresa: true },
    }));
  if (!cliente) throw new Error("No hay clientes en la base.");

  const personal = await prisma.personal.findMany({
    where: { deletedAt: null, estado: "ACTIVO" },
    select: { id: true, nombre: true, apellido: true },
    take: 2,
  });
  if (personal.length < 2) {
    throw new Error("Hacen falta al menos dos personas activas en Personal.");
  }

  const tareas = await prisma.tarea.findMany({
    where: { deletedAt: null },
    orderBy: { orden: "asc" },
    select: { id: true, nombre: true },
  });
  if (tareas.length < 5) {
    throw new Error(
      "Hacen falta al menos cinco tareas. Corré scripts/seed-tareas.ts."
    );
  }
  const [compartida, soloEnUna, sinFotos, , soloEtiqueta] = tareas;

  const m: Manifiesto = { visitas: [], keys: [] };

  // Dos días seguidos y en el pasado: un informe cuenta lo que ya se hizo.
  const hoy = new Date();
  const dia = (atras: number) => {
    const d = new Date(hoy);
    d.setUTCDate(d.getUTCDate() - atras);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  };

  /** Una hora concreta de un día, en ISO: las marcas ahora son instantes. */
  const aLaHora = (fecha: Date, hm: string) => {
    const [h, min] = hm.split(":").map(Number);
    const d = new Date(fecha);
    d.setHours(h, min, 0, 0);
    return d.toISOString();
  };

  /** Sube una foto de verdad y la engancha a la visita, con su etiqueta. */
  async function subirFoto(
    visitaId: string,
    tarea: { id: string; nombre: string } | null,
    color: string
  ) {
    const key = `visitas/${visitaId}/prueba-${m.keys.length + 1}.jpg`;
    const cuerpo = await imagen(tarea?.nombre ?? "Sin etiquetar", color);
    const url = await getUploadUrl(key, "image/jpeg");
    const res = await fetch(url, {
      method: "PUT",
      body: new Uint8Array(cuerpo),
      headers: { "Content-Type": "image/jpeg" },
    });
    if (!res.ok) throw new Error(`R2 rechazó la subida (${res.status})`);
    m.keys.push(key);
    await prisma.visitaMedia.create({
      data: {
        visitaId,
        key,
        url: publicUrlForKey(key),
        tipo: "imagen",
        tareaId: tarea?.id ?? null,
      },
    });
  }

  try {
    // ── Visita A ────────────────────────────────────────────────────────
    const [a] = await visitaSvc.createVisitasBatch(viewer, {
      clienteId: cliente.id,
      fechas: [dia(9)],
      personalIds: personal.map((p) => p.id),
      // Una de las obligatorias se va a hacer y la otra no, para ver las dos
      // caras del chequeo.
      tareasObligatoriasIds: [compartida.id, soloEtiqueta.id],
      notas: "Visita de prueba para el informe.",
    });
    m.visitas.push(a.id);

    await visitaSvc.registrarParte(a.id, viewer, {
      personalId: personal[0].id,
      entradaEl: aLaHora(dia(9), "08:15"),
      salidaEl: aLaHora(dia(9), "12:30"),
      tareaIds: [compartida.id, sinFotos.id],
    });
    await visitaSvc.registrarParte(a.id, viewer, {
      personalId: personal[1].id,
      entradaEl: aLaHora(dia(9), "08:40"),
      salidaEl: aLaHora(dia(9), "13:10"),
      tareaIds: [soloEnUna.id],
    });

    await subirFoto(a.id, compartida, "#2e7d32");
    await subirFoto(a.id, compartida, "#388e3c");
    await subirFoto(a.id, soloEnUna, "#1565c0");
    // Etiquetada con algo que nadie cargó: en el campo se fotografía lo que
    // aparece, y esa foto igual necesita su sección.
    await subirFoto(a.id, soloEtiqueta, "#ef6c00");

    await visitaSvc.completeVisita(a.id, viewer, { fechaRealizada: dia(9) });

    // ── Visita B ────────────────────────────────────────────────────────
    const [b] = await visitaSvc.createVisitasBatch(viewer, {
      clienteId: cliente.id,
      fechas: [dia(2)],
      personalIds: [personal[0].id],
      tareasObligatoriasIds: [compartida.id],
    });
    m.visitas.push(b.id);

    await visitaSvc.registrarParte(b.id, viewer, {
      personalId: personal[0].id,
      entradaEl: aLaHora(dia(2), "07:50"),
      salidaEl: aLaHora(dia(2), "11:20"),
      tareaIds: [compartida.id],
    });

    await subirFoto(b.id, compartida, "#43a047");
    // Sin etiquetar: no tiene que inventar ninguna sección, y queda en el pool
    // para asignarla a mano desde el asistente.
    await subirFoto(b.id, null, "#616161");

    await visitaSvc.completeVisita(b.id, viewer, { fechaRealizada: dia(2) });

    const nombre =
      cliente.empresa ||
      `${cliente.nombre} ${cliente.apellido ?? ""}`.trim() ||
      "el cliente";
    console.log(`\nListo. Cliente: ${nombre}`);
    console.log(`  Visita #${a.numero} — ${dia(9).toISOString().slice(0, 10)} · 4 fotos · 2 personas`);
    console.log(`  Visita #${b.numero} — ${dia(2).toISOString().slice(0, 10)} · 2 fotos · 1 persona`);
    console.log("\nLo que el asistente de informes debería proponer:");
    console.log(`  ${compartida.nombre.padEnd(46)} las 2 visitas · 3 fotos`);
    console.log(`  ${soloEnUna.nombre.padEnd(46)} 1 visita · 1 foto`);
    console.log(`  ${sinFotos.nombre.padEnd(46)} 1 visita · sin fotos`);
    console.log(`  ${soloEtiqueta.nombre.padEnd(46)} ninguna · 1 foto (solo etiqueta)`);
    console.log("  y 1 foto sin etiquetar, que no arma sección");
    console.log("\n  → /dashboard/informes/nuevo");
  } finally {
    writeFileSync(MANIFIESTO, JSON.stringify(m, null, 2));
    await prisma.$disconnect();
  }
}

const limpia = process.argv.slice(2).includes("--limpiar");
(limpia ? limpiar() : sembrar()).catch((e) => {
  console.error("Error:", e instanceof Error ? e.message : e);
  process.exit(1);
});
