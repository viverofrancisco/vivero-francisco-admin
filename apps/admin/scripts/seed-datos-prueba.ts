/**
 * Datos de prueba para ver el portal con actividad.
 *
 *   npx tsx scripts/seed-datos-prueba.ts                 # crea
 *   npx tsx scripts/seed-datos-prueba.ts --limpiar       # borra lo que creó
 *   npx tsx scripts/seed-datos-prueba.ts --sin-contifico # no toca la API
 *
 * **No inventa clientes ni personal**: la base ya los tiene y son reales. Lo
 * que falta es movimiento —suscripciones, visitas, órdenes—, y eso es lo que
 * genera.
 *
 * Todo lo que crea queda anotado en `scripts/.datos-prueba.json`, y `--limpiar`
 * borra exactamente esos ids. Por eso no hace falta ningún marcador en los
 * datos: nada que ya estuviera en la base corre riesgo. El manifiesto guarda
 * también el host de la base, y limpiar contra otra base se rechaza.
 *
 * Las visitas se escriben con Prisma directo y no con `createVisitasBatch`: el
 * servicio dispara confirmaciones de WhatsApp y push al terminar, y un seed no
 * tiene por qué avisarle nada a nadie. Las órdenes sí van por el servicio
 * (`generarOrden`), que no llama a nada externo y aplica las reglas que evitan
 * facturar dos veces el mismo trabajo.
 *
 * **Emite facturas de verdad en Contífico** para que "Por cobrar" tenga algo que
 * mostrar: siete de cada diez órdenes se facturan y se cobran, entera o a
 * medias. Eso está bien contra la cuenta de pruebas y **no** contra una real:
 * Contífico no tiene DELETE y un documento emitido queda para siempre.
 * `--sin-contifico` deja todo en borrador.
 */
import "dotenv/config";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import type { Periodicidad } from "@/generated/prisma/enums";
import type { Viewer } from "@/lib/services/viewer";

const MANIFIESTO = join(__dirname, ".datos-prueba.json");

interface Manifiesto {
  host: string;
  creado: string;
  sectores: string[];
  clientesConSectorAsignado: string[];
  productos: string[];
  productosVinculados: string[];
  datosFacturacion: string[];
  suscripciones: string[];
  visitas: string[];
  mensajes: string[];
  ordenes: string[];
  /** Solo local: el documento en Contífico no se puede borrar. */
  facturas: string[];
}

const vacio = (host: string): Manifiesto => ({
  host,
  creado: new Date().toISOString(),
  sectores: [],
  clientesConSectorAsignado: [],
  productos: [],
  productosVinculados: [],
  datosFacturacion: [],
  suscripciones: [],
  visitas: [],
  mensajes: [],
  ordenes: [],
  facturas: [],
});

/** Host de la base, para no limpiar la equivocada. */
function hostDeLaBase(): string {
  try {
    return new URL(process.env.DATABASE_URL!).host;
  } catch {
    return "desconocido";
  }
}

// ──────────────────────────────────────────────
// Azar reproducible
// ──────────────────────────────────────────────

/** Mulberry32: la misma semilla da siempre el mismo set de datos. */
function azar(semilla: number) {
  let a = semilla;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = azar(20260822);
const entre = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));
const uno = <T>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)];
const chance = (p: number) => rnd() < p;

/** N elementos distintos, sin alterar el original. */
function algunos<T>(xs: T[], n: number): T[] {
  const copia = [...xs];
  const salida: T[] = [];
  while (salida.length < n && copia.length) {
    salida.push(copia.splice(Math.floor(rnd() * copia.length), 1)[0]);
  }
  return salida;
}

/** Fecha UTC sin hora, como las guarda `@db.Date`. */
const dia = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const masDias = (base: Date, n: number) => {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + n);
  return dia(d);
};
const masMeses = (base: Date, n: number) => {
  const d = new Date(base);
  d.setUTCMonth(d.getUTCMonth() + n);
  return dia(d);
};

// ──────────────────────────────────────────────
// Identificaciones que Contífico acepta
// ──────────────────────────────────────────────

/** Cédula con dígito verificador correcto (módulo 10). */
function cedula(n: number): string {
  const provincia = String((n % 24) + 1).padStart(2, "0");
  const cuerpo = provincia + String(n % 5) + String(100000 + (n * 7919) % 900000).slice(0, 6);
  const coef = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let p = Number(cuerpo[i]) * coef[i];
    if (p > 9) p -= 9;
    suma += p;
  }
  return cuerpo + String((10 - (suma % 10)) % 10);
}

/** RUC de sociedad: tercer dígito 9 y sufijo 001. */
function ruc(n: number): string {
  const provincia = String((n % 24) + 1).padStart(2, "0");
  return provincia + "9" + String(1000000 + (n * 6131) % 8999999).slice(0, 7) + "001";
}

// ──────────────────────────────────────────────
// Catálogo que se agrega
// ──────────────────────────────────────────────

const PRODUCTOS_NUEVOS = [
  { nombre: "Poda de árboles y palmeras", tipo: "SERVICIO", ivaTasa: 15 },
  { nombre: "Diseño e instalación de jardín", tipo: "SERVICIO", ivaTasa: 15 },
  { nombre: "Control de plagas en jardín", tipo: "SERVICIO", ivaTasa: 15 },
  { nombre: "Fumigación de áreas verdes", tipo: "SERVICIO", ivaTasa: 15 },
  { nombre: "Mantenimiento integral de áreas verdes", tipo: "SERVICIO", ivaTasa: 15 },
  { nombre: "Jardinería quincenal", tipo: "SERVICIO", ivaTasa: 15 },
  { nombre: "Abono orgánico (saco 20 kg)", tipo: "BIEN", ivaTasa: 0 },
  { nombre: "Césped en rollo (m²)", tipo: "BIEN", ivaTasa: 15 },
  // Queda sin vincular a propósito: así se ve en el portal el estado "no
  // sincronizado" y por qué no se puede vender.
  { nombre: "Sistema de riego por goteo (instalación)", tipo: "SERVICIO", ivaTasa: 15, sinVincular: true },
] as const;

type VisitaNueva = Prisma.VisitaCreateManyInput;

const NOTAS_VISITA = [
  "El cliente pide avisar antes de entrar.",
  "Portón lateral: la clave está con el guardia.",
  "Hay perro suelto en el patio de atrás.",
  "Cortar solo el frente; el fondo lo ve el jardinero del vecino.",
  "Revisar los aspersores del jardín delantero.",
  "Dejar los residuos en la esquina, pasan los martes.",
];

const NOTAS_INCOMPLETO = [
  "Llovió a media mañana y no se pudo terminar la poda.",
  "No había nadie para abrir el portón.",
  "Se dañó la bordeadora, queda pendiente el filo del césped.",
];

const MENSAJES = [
  "Buenos días, ¿a qué hora llegan hoy?",
  "Perfecto, los esperamos.",
  "Quedó muy bien el jardín, gracias.",
  "¿Podrían revisar el aspersor de la entrada la próxima?",
  "Vamos en camino, llegamos en 20 minutos.",
];

// ──────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const limpiar = args.includes("--limpiar");
  const sinContifico = args.includes("--sin-contifico");
  const host = hostDeLaBase();

  const { prisma } = await import("@/lib/prisma");

  console.log(`base: ${host}\n`);

  if (limpiar) {
    await limpiarTodo(prisma, host);
    await prisma.$disconnect();
    return;
  }

  if (existsSync(MANIFIESTO)) {
    console.error(
      "Ya hay datos de prueba sembrados (scripts/.datos-prueba.json).\n" +
        "Corré `--limpiar` antes de volver a sembrar."
    );
    process.exit(1);
  }

  const m = vacio(host);
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) throw new Error("No hay usuario ADMIN. Corré `npx tsx prisma/seed.ts` primero.");
  const viewer = {
    id: admin.id,
    role: "ADMIN" as const,
    personalId: null,
    clienteId: null,
    nombre: admin.name ?? "Datos de prueba",
  };

  try {
    await sembrar(prisma, viewer, m, sinContifico);
  } finally {
    // Se guarda pase lo que pase: si falla a la mitad, `--limpiar` igual sabe
    // qué borrar.
    writeFileSync(MANIFIESTO, JSON.stringify(m, null, 2));
  }

  console.log("\nresumen");
  console.log("  sectores            ", m.sectores.length);
  console.log("  productos nuevos    ", m.productos.length);
  console.log("  productos vinculados", m.productosVinculados.length);
  console.log("  datos de facturación", m.datosFacturacion.length);
  console.log("  suscripciones       ", m.suscripciones.length);
  console.log("  visitas             ", m.visitas.length);
  console.log("  mensajes            ", m.mensajes.length);
  console.log("  órdenes             ", m.ordenes.length);
  console.log("  facturas            ", m.facturas.length);
  console.log(`\nmanifiesto: ${MANIFIESTO}`);
  if (m.facturas.length > 0) {
    console.log(
      "\n⚠️  Las facturas quedan en Contífico para siempre: no tiene DELETE.\n" +
        "    `--limpiar` borra las filas locales, no los documentos de allá."
    );
  }

  await prisma.$disconnect();
}

async function sembrar(
  prisma: PrismaClient,
  viewer: Viewer,
  m: Manifiesto,
  sinContifico: boolean
) {
  const hoy = dia(new Date());

  // ── 1. Catálogo ───────────────────────────────────────────────────────
  console.log("catálogo...");
  for (const p of PRODUCTOS_NUEVOS) {
    const ya = await prisma.producto.findFirst({
      where: { nombre: p.nombre, deletedAt: null },
      select: { id: true },
    });
    if (ya) continue;
    const creado = await prisma.producto.create({
      data: {
        nombre: p.nombre,
        tipo: p.tipo,
        ivaTasa: p.ivaTasa,
        descripcion: null,
        createdById: viewer.id,
        updatedById: viewer.id,
      },
      select: { id: true },
    });
    m.productos.push(creado.id);
  }

  // Sin vínculo con Contífico un producto no se puede vender, así que las
  // suscripciones y las órdenes dependen de este paso.
  const sinVincular = await prisma.producto.findMany({
    where: {
      deletedAt: null,
      contificoProductoId: null,
      nombre: { not: "Sistema de riego por goteo (instalación)" },
    },
    select: {
      id: true, nombre: true, descripcion: true, tipo: true,
      codigo: true, ivaTasa: true, contificoProductoId: true,
      contificoCategoriaId: true,
    },
  });

  if (sinContifico) {
    console.log(`  ${sinVincular.length} producto(s) quedan sin vincular (--sin-contifico)`);
  } else if (sinVincular.length) {
    const { sincronizarProducto } = await import("@/lib/contifico/productos");
    for (const p of sinVincular) {
      try {
        await sincronizarProducto(p);
        m.productosVinculados.push(p.id);
        console.log(`  vinculado: ${p.nombre}`);
      } catch (e) {
        console.log(`  NO vinculado: ${p.nombre} — ${(e as Error).message}`);
      }
    }
  }

  const vendibles = await prisma.producto.findMany({
    where: { deletedAt: null, contificoProductoId: { not: null } },
    select: { id: true, nombre: true, ivaTasa: true },
  });
  // Ya no hay productos "recurrentes" en el catálogo: se eligen unos cuantos
  // para armar planes y el resto queda como trabajo suelto.
  const recurrentes = algunos(vendibles, Math.min(4, vendibles.length));
  const idsRecurrentes = new Set(recurrentes.map((p) => p.id));
  const sueltos = vendibles.filter((p) => !idsRecurrentes.has(p.id));
  if (!vendibles.length) {
    throw new Error(
      "Ningún producto quedó vinculado con Contífico: sin eso no se pueden crear " +
        "suscripciones ni órdenes. Revisá las credenciales o corré sin --sin-contifico."
    );
  }

  // ── 2. Sectores ───────────────────────────────────────────────────────
  console.log("sectores...");
  const nombresSector = ["Samborondón", "Vía a la Costa"];
  const sectores = await prisma.sector.findMany({ where: { deletedAt: null }, select: { id: true } });
  for (const nombre of nombresSector) {
    const ya = await prisma.sector.findUnique({ where: { nombre }, select: { id: true } });
    if (ya) {
      sectores.push(ya);
      continue;
    }
    const s = await prisma.sector.create({ data: { nombre }, select: { id: true } });
    m.sectores.push(s.id);
    sectores.push(s);
  }

  // Repartir solo los clientes que no tienen sector: los que ya tienen uno son
  // dato real y no se toca.
  const huerfanos = await prisma.cliente.findMany({
    where: { deletedAt: null, sectorId: null },
    select: { id: true },
  });
  for (const c of huerfanos) {
    await prisma.cliente.update({
      where: { id: c.id },
      data: { sectorId: uno(sectores).id },
    });
    m.clientesConSectorAsignado.push(c.id);
  }
  console.log(`  ${m.sectores.length} nuevo(s), ${huerfanos.length} cliente(s) asignados`);

  // ── 3. Datos de facturación ───────────────────────────────────────────
  console.log("datos de facturación...");
  const { crearDatoFacturacion } = await import("@/lib/services/dato-facturacion.service");
  const clientes = await prisma.cliente.findMany({
    where: { deletedAt: null },
    select: {
      id: true, nombre: true, apellido: true, empresa: true,
      direccion: true, telefono: true, email: true,
    },
    orderBy: { nombre: "asc" },
  });

  const conFacturacion = algunos(clientes, Math.min(30, clientes.length));
  for (const [i, c] of conFacturacion.entries()) {
    const juridica = Boolean(c.empresa);
    const razonSocial = (
      juridica ? c.empresa! : `${c.nombre} ${c.apellido ?? ""}`
    ).trim();
    try {
      const d = await crearDatoFacturacion(viewer, c.id, {
        tipoIdentificacion: juridica ? "RUC" : "CEDULA",
        identificacion: juridica ? ruc(i + 3) : cedula(i + 11),
        razonSocial,
        tipoPersona: juridica ? "JURIDICA" : "NATURAL",
        direccion: c.direccion ?? null,
        telefono: c.telefono ?? null,
        email: c.email ?? null,
      });
      m.datosFacturacion.push(d.id);
    } catch (e) {
      console.log(`  ${razonSocial}: ${(e as Error).message}`);
    }
  }
  console.log(`  ${m.datosFacturacion.length} creados`);

  // ── 4. Suscripciones ──────────────────────────────────────────────────
  console.log("suscripciones...");
  const { crearSuscripcion } = await import("@/lib/services/suscripcion.service");
  const PERIODICIDADES = ["MENSUAL", "MENSUAL", "MENSUAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL"];
  const MESES: Record<Periodicidad, number> = {
    MENSUAL: 1, TRIMESTRAL: 3, SEMESTRAL: 6, ANUAL: 12,
  };
  const suscriptores = recurrentes.length ? algunos(conFacturacion, 14) : [];

  for (const c of suscriptores) {
    const periodicidad = uno(PERIODICIDADES) as Periodicidad;
    const meses = MESES[periodicidad];
    const items = algunos(recurrentes, entre(1, Math.min(2, recurrentes.length))).map((p) => ({
      productoId: p.id,
      // Precio del período completo, no mensual.
      precio: entre(60, 220) * meses,
      ivaTasa: p.ivaTasa != null ? Number(p.ivaTasa) : 15,
      visitasPorPeriodo: entre(2, 4) * meses,
    }));
    try {
      const s = await crearSuscripcion(viewer, {
        clienteId: c.id,
        periodicidad,
        // Arrancan entre 2 y 8 meses atrás, para que haya períodos por cobrar.
        fechaInicio: masMeses(hoy, -entre(2, 8)),
        items,
      });
      m.suscripciones.push(s.id);
    } catch (e) {
      console.log(`  ${c.nombre}: ${(e as Error).message}`);
    }
  }
  console.log(`  ${m.suscripciones.length} creadas`);

  // ── 5. Visitas ────────────────────────────────────────────────────────
  console.log("visitas...");
  const grupos = await prisma.grupo.findMany({
    where: { deletedAt: null },
    select: { id: true, miembros: { select: { personalId: true } } },
  });
  const items = await prisma.suscripcionItem.findMany({
    where: { suscripcion: { estado: "ACTIVO" } },
    select: { id: true, productoId: true, suscripcion: { select: { clienteId: true } } },
  });
  // Qué ítem de plan cubre a cada (cliente, producto).
  const cubre = new Map<string, string>(
    items.map((i) => [`${i.suscripcion.clienteId}|${i.productoId}`, i.id])
  );

  // El alta rechaza dos visitas del mismo cliente y día con el mismo producto,
  // y el seed no debería crear algo que la app no crearía. Acá se va más
  // estricto: una sola visita por cliente y día.
  const ocupado = new Set<string>();
  for (const v of await prisma.visita.findMany({
    where: { deletedAt: null, estado: { not: "CANCELADA" } },
    select: { clienteId: true, fechaProgramada: true },
  })) {
    ocupado.add(`${v.clienteId}|${v.fechaProgramada.toISOString().slice(0, 10)}`);
  }

  const candidatos = [...suscriptores, ...algunos(clientes, 18)];
  const visitas: VisitaNueva[] = [];
  // Qué productos lleva cada visita, indexado por cliente+fecha en vez de por
  // posición: `createManyAndReturn` no promete devolver las filas en el orden
  // en que se mandaron.
  const productosDe = new Map<string, string[]>();

  for (let n = 0; n < 190; n++) {
    const cliente = uno(candidatos);
    // De cuatro meses atrás a mes y medio adelante.
    const fecha = masDias(hoy, entre(-120, 45));
    const delPlan = recurrentes.filter((p) => cubre.has(`${cliente.id}|${p.id}`));
    const elegibles = delPlan.length && chance(0.7) ? delPlan : sueltos;
    if (!elegibles.length) continue;

    const productoIds = algunos(elegibles, chance(0.2) ? 2 : 1).map((p) => p.id);
    // Una visita por cliente y día: es lo realista, y hace que cliente+fecha
    // identifique la fila sin ambigüedad.
    const clave = `${cliente.id}|${fecha.toISOString().slice(0, 10)}`;
    if (ocupado.has(clave)) continue;
    ocupado.add(clave);

    const pasada = fecha < hoy;
    const estado = pasada
      ? chance(0.82) ? "COMPLETADA" : chance(0.5) ? "INCOMPLETA" : "CANCELADA"
      : "PROGRAMADA";
    const grupo = chance(0.85) ? uno(grupos) : null;

    visitas.push({
      clienteId: cliente.id,
      fechaProgramada: fecha,
      fechaRealizada: estado === "COMPLETADA" || estado === "INCOMPLETA" ? fecha : null,
      horaEntrada: estado === "PROGRAMADA" ? null : `${String(entre(7, 11)).padStart(2, "0")}:${uno(["00", "15", "30", "45"])}`,
      horaSalida: estado === "PROGRAMADA" ? null : `${String(entre(12, 17)).padStart(2, "0")}:${uno(["00", "15", "30", "45"])}`,
      estado,
      grupoId: grupo?.id ?? null,
      notas: chance(0.35) ? uno(NOTAS_VISITA) : null,
      notasIncompleto: estado === "INCOMPLETA" ? uno(NOTAS_INCOMPLETO) : null,
      createdById: viewer.id,
      updatedById: viewer.id,
    });
    productosDe.set(clave, productoIds);
  }

  const creadas = await prisma.visita.createManyAndReturn({ data: visitas });
  m.visitas.push(...creadas.map((v) => v.id));

  await prisma.visitaProducto.createMany({
    data: creadas.flatMap((v) => {
      const clave = `${v.clienteId}|${v.fechaProgramada.toISOString().slice(0, 10)}`;
      return (productosDe.get(clave) ?? []).map((productoId, posicion) => {
        const item = cubre.get(`${v.clienteId}|${productoId}`) ?? null;
        return {
          visitaId: v.id,
          productoId,
          // Una de cada seis cubiertas se deja fuera del plan a propósito, que
          // es lo que hace quien agenda un trabajo extra acordado por fuera.
          // Sin esto no habría en la base ninguna visita con ese estado.
          suscripcionItemId: item && chance(0.83) ? item : null,
          posicion,
        };
      });
    }),
  });

  // El personal del grupo queda asignado, como cuando se agenda desde el portal.
  const porGrupo = new Map(grupos.map((g) => [g.id, g.miembros.map((x) => x.personalId)]));
  const asignaciones = creadas.flatMap((v) =>
    ((porGrupo.get(v.grupoId ?? "") as string[]) ?? []).map((personalId) => ({
      visitaId: v.id,
      personalId,
      addedById: viewer.id,
    }))
  );
  if (asignaciones.length) {
    await prisma.visitaPersonal.createMany({ data: asignaciones, skipDuplicates: true });
  }
  console.log(`  ${creadas.length} creadas`);

  // ── 6. Chat de visita ─────────────────────────────────────────────────
  console.log("mensajes...");
  for (const v of algunos(creadas, 12)) {
    for (let i = 0; i < entre(1, 3); i++) {
      const msg = await prisma.visitaMessage.create({
        data: { visitaId: v.id, authorUserId: viewer.id, body: uno(MENSAJES) },
        select: { id: true },
      });
      m.mensajes.push(msg.id);
    }
  }
  console.log(`  ${m.mensajes.length} creados`);

  // ── 7. Órdenes ────────────────────────────────────────────────────────
  console.log("órdenes...");
  const {
    generarOrden,
    generarBorradoresDeVisitas,
    actualizarOrden,
    getOrden,
  } = await import("@/lib/services/orden.service");
  const { cobrarOrden, facturarOrden } = await import(
    "@/lib/services/factura.service"
  );

  // Las visitas se escriben con Prisma directo, así que `completeVisita` nunca
  // corrió y sus borradores no existen. Esto los arma igual que el cron: es el
  // mismo camino que sigue el portal en producción.
  const deVisitas = await generarBorradoresDeVisitas();
  for (const c of deVisitas.creadas) m.ordenes.push(c.ordenId);
  console.log(`  ${deVisitas.creadas.length} borrador(es) de visitas completadas`);

  for (const c of algunos(conFacturacion, 16)) {
    try {
      // Una orden por suscripción y otra con las visitas sueltas: mezclarlas
      // está prohibido, así que esto devuelve varias.
      const creadas = await generarOrden(viewer, {
        clienteId: c.id,
        desde: masMeses(hoy, -6),
        hasta: hoy,
      });

      for (const orden of creadas) {
        m.ordenes.push(orden.id);

        // Lo que viene de una visita suelta entra en $0: la visita no lleva
        // precio, se cotiza al armar la orden. Acá se cotiza, porque un
        // borrador lleno de ceros no sirve para ver nada.
        const completa = await getOrden(viewer, orden.id);
        if (completa.lineas.some((l) => Number(l.precioUnitario) === 0)) {
          await actualizarOrden(viewer, orden.id, {
            lineas: completa.lineas.map((l) => ({
              descripcion: l.descripcion,
              cantidad: Number(l.cantidad),
              precioUnitario: Number(l.precioUnitario) || entre(45, 260),
              ivaTasa: Number(l.ivaTasa),
              productoId: l.productoId,
              visitaProductoId: l.visitaProductoId,
              suscripcionItemId: l.suscripcionItemId,
              periodoInicio: l.periodoInicio,
              periodoFin: l.periodoFin,
            })),
          });
        }

        // Un reparto que muestre los tres estados de cobro. Sin él la pantalla
        // "Por cobrar" queda vacía y no se ve nada de lo que hace el portal.
        //
        // Emitir crea documentos **de verdad** en Contífico, y no hay DELETE:
        // por eso `--sin-contifico` deja todo en borrador, que es como las deja
        // el cron. La cuenta de pruebas aguanta; una de producción no.
        if (sinContifico) continue;

        const suerte = rnd();
        if (suerte < 0.2) continue; // se queda en borrador

        // El total **después** de repreciar: `completa` es de antes del update
        // y usarlo dejaba el cobro por encima del saldo, que Contífico rechaza.
        const total = Number((await getOrden(viewer, orden.id)).total);

        if (suerte < 0.4) {
          // Facturada y sin cobrar: la venta a crédito.
          const { factura, errorFactura } = await facturarOrden(viewer, orden.id);
          if (factura) {
            m.facturas.push(factura.facturaId);
            console.log(`    ${factura.numero} · sin cobrar`);
          } else {
            console.log(`    ⚠ ${c.nombre}: ${errorFactura}`);
          }
          continue;
        }

        const parcial = suerte < 0.7;
        const monto = parcial ? Math.round(total * 0.4 * 100) / 100 : total;
        const { facturaId, numero } = await cobrarOrden(viewer, orden.id, {
          formaCobro: "EF",
          monto,
          fecha: hoy.toISOString().slice(0, 10),
        });
        m.facturas.push(facturaId);
        console.log(
          `    ${numero} · ${parcial ? "cobrado parcialmente" : "cobrado"}`
        );
      }
    } catch (e) {
      // "No hay nada pendiente" es lo normal para muchos clientes, pero un
      // fallo al facturar no: en silencio quedaba una factura emitida sin su
      // cobro y nadie se enteraba.
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("pendiente")) console.log(`    ⚠ ${c.nombre}: ${msg}`);
    }
  }
  // Los borradores que salieron de visitas quedan en $0. Se le pone precio a
  // buena parte y se factura, para que el portal muestre las cuatro etapas
  // —borrador, sin cobrar, cobrado en parte, cobrado— y no una fila de ceros.
  if (!sinContifico) {
    for (const { ordenId } of deVisitas.creadas) {
      if (chance(0.45)) continue; // se queda en borrador, en $0
      try {
        const o = await getOrden(viewer, ordenId);
        await actualizarOrden(viewer, ordenId, {
          lineas: o.lineas.map((l) => ({
            descripcion: l.descripcion,
            cantidad: Number(l.cantidad),
            precioUnitario: Number(l.precioUnitario) || entre(45, 260),
            ivaTasa: Number(l.ivaTasa),
            productoId: l.productoId,
            visitaProductoId: l.visitaProductoId,
            suscripcionItemId: l.suscripcionItemId,
            periodoInicio: l.periodoInicio,
            periodoFin: l.periodoFin,
          })),
        });
        const total = Number((await getOrden(viewer, ordenId)).total);
        const suerte = rnd();
        if (suerte < 0.3) {
          const { factura } = await facturarOrden(viewer, ordenId);
          if (factura) m.facturas.push(factura.facturaId);
        } else {
          const { facturaId } = await cobrarOrden(viewer, ordenId, {
            formaCobro: "EF",
            monto: suerte < 0.65 ? Math.round(total * 0.4 * 100) / 100 : total,
            fecha: hoy.toISOString().slice(0, 10),
          });
          m.facturas.push(facturaId);
        }
      } catch (e) {
        console.log(`    ⚠ ${(e as Error).message.slice(0, 70)}`);
      }
    }
  }

  console.log(`  ${m.ordenes.length} creadas`);
}

// ──────────────────────────────────────────────

async function limpiarTodo(prisma: PrismaClient, host: string) {
  if (!existsSync(MANIFIESTO)) {
    console.log("No hay manifiesto: nada que limpiar.");
    return;
  }
  const m: Manifiesto = JSON.parse(readFileSync(MANIFIESTO, "utf8"));
  if (m.host !== host) {
    console.error(
      `El manifiesto se sembró contra ${m.host} y estás apuntando a ${host}.\n` +
        "No se borra nada."
    );
    process.exit(1);
  }

  // Orden inverso a la creación, para no chocar con las foreign keys.
  const borrar = async (nombre: string, f: () => Promise<{ count: number }>) => {
    const { count } = await f();
    console.log(`  ${nombre.padEnd(22)} ${count}`);
  };

  // La factura se va de nuestra base; el documento sigue en Contífico, que no
  // tiene DELETE. Por eso conviene revisar `CONTIFICO_SECUENCIAL_INICIAL`.
  await borrar("factura", () =>
    prisma.factura.deleteMany({ where: { id: { in: m.facturas ?? [] } } })
  );
  await borrar("ordenLinea", () =>
    prisma.ordenLinea.deleteMany({ where: { ordenId: { in: m.ordenes } } })
  );
  await borrar("orden", () => prisma.orden.deleteMany({ where: { id: { in: m.ordenes } } }));
  await borrar("visitaMessage", () =>
    prisma.visitaMessage.deleteMany({ where: { id: { in: m.mensajes } } })
  );
  await borrar("visitaPersonal", () =>
    prisma.visitaPersonal.deleteMany({ where: { visitaId: { in: m.visitas } } })
  );
  await borrar("visitaProducto", () =>
    prisma.visitaProducto.deleteMany({ where: { visitaId: { in: m.visitas } } })
  );
  await borrar("visita", () => prisma.visita.deleteMany({ where: { id: { in: m.visitas } } }));
  await borrar("suscripcionItem", () =>
    prisma.suscripcionItem.deleteMany({ where: { suscripcionId: { in: m.suscripciones } } })
  );
  await borrar("suscripcion", () =>
    prisma.suscripcion.deleteMany({ where: { id: { in: m.suscripciones } } })
  );
  await borrar("datoFacturacion", () =>
    prisma.datoFacturacion.deleteMany({ where: { id: { in: m.datosFacturacion } } })
  );
  await borrar("producto", () => prisma.producto.deleteMany({ where: { id: { in: m.productos } } }));
  await borrar("cliente.sectorId", () =>
    prisma.cliente.updateMany({
      where: { id: { in: m.clientesConSectorAsignado } },
      data: { sectorId: null },
    })
  );
  await borrar("sector", () => prisma.sector.deleteMany({ where: { id: { in: m.sectores } } }));

  // El vínculo local se suelta; el producto en Contífico queda, porque su API
  // no tiene DELETE (solo `PATCH {estado:"I"}`).
  if (m.productosVinculados.length) {
    await borrar("producto.contifico", () =>
      prisma.producto.updateMany({
        where: { id: { in: m.productosVinculados } },
        data: { contificoProductoId: null, codigo: null },
      })
    );
  }

  unlinkSync(MANIFIESTO);
  console.log("\nListo. Los productos creados en Contífico siguen ahí: su API no borra.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
