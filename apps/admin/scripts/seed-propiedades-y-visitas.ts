/**
 * Datos para mirar la interfaz: propiedades con y sin pin, clientes con más de
 * una, y visitas repartidas en el tiempo y en todos los estados.
 *
 * Existe porque la base de desarrollo tenía **una sola** propiedad con
 * ubicación de 57, todas llamadas "Principal" y una por cliente: con eso no se
 * puede ver nada de lo que el portal y la app muestran ahora — ni el mapa de la
 * visita, ni la pregunta de en cuál de sus casas es, ni cómo queda la tarjeta
 * cuando **no** hay pin, que es el caso que hay que ver más que ningún otro.
 *
 * No inventa clientes ni personal: usa los que ya están.
 *
 * **Las visitas viejas se archivan, no se borran.** Son 194, y 81 están citadas
 * por una orden y 75 por un informe; borrarlas de verdad se llevaría esos
 * vínculos —lo que dice de qué visitas es cada orden— para siempre. Archivar es
 * lo que el propio dominio hace al eliminar una visita (`deletedAt`), así que
 * desaparecen de todas las listas y las órdenes siguen sabiendo lo suyo.
 * `--limpiar` las devuelve.
 *
 *   npx tsx --env-file=.env scripts/seed-propiedades-y-visitas.ts
 *   npx tsx --env-file=.env scripts/seed-propiedades-y-visitas.ts --limpiar
 */
import "dotenv/config";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { prisma } from "@/lib/prisma";
import { hoyISOEcuador } from "@/lib/fechas";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MANIFIESTO = join(__dirname, ".propiedades-y-visitas.json");

interface Manifiesto {
  /** Las que estaban vivas antes de sembrar: se archivaron, no se borraron. */
  visitasArchivadas: string[];
  /** Lo que creó este script. */
  visitasCreadas: string[];
  propiedadesCreadas: string[];
  /** Propiedades que ya estaban y a las que se les puso pin o medidas. */
  propiedadesTocadas: { id: string; campos: string[] }[];
}

/**
 * Un punto cerca del centro del sector, con unos cientos de metros de dispersión.
 *
 * Son coordenadas **de prueba**: caen en la zona correcta para que el mapa
 * muestre algo reconocible, no en la puerta de ninguna casa real.
 */
const CENTROS: Record<string, { lat: number; lng: number }> = {
  "Isla Mocoli": { lat: -1.9668, lng: -79.8556 },
  Samborondón: { lat: -2.1394, lng: -79.8598 },
  "Vía a la Costa": { lat: -2.1786, lng: -80.0215 },
};
const CENTRO_POR_DEFECTO = { lat: -2.1709, lng: -79.9224 }; // Guayaquil

/** Azar reproducible: dos corridas siembran lo mismo. */
function generadorDeAzar(semilla: number) {
  let s = semilla;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
const azar = generadorDeAzar(20260917);

function puntoEn(sector: string | null | undefined) {
  const c = (sector && CENTROS[sector]) || CENTRO_POR_DEFECTO;
  // ±0.008° ≈ ±900 m.
  return {
    lat: Number((c.lat + (azar() - 0.5) * 0.016).toFixed(6)),
    lng: Number((c.lng + (azar() - 0.5) * 0.016).toFixed(6)),
  };
}

function entero(min: number, max: number) {
  return Math.floor(min + azar() * (max - min + 1));
}

function elegir<T>(xs: T[]): T {
  return xs[Math.floor(azar() * xs.length)];
}

/** Un día del calendario, como lo espera una columna `@db.Date`. */
function dia(desplazamiento: number): Date {
  const hoy = new Date(`${hoyISOEcuador()}T00:00:00.000Z`);
  hoy.setUTCDate(hoy.getUTCDate() + desplazamiento);
  return hoy;
}

/** Un instante de ese día a esa hora **de Ecuador**, que es UTC-5. */
function instante(desplazamiento: number, hora: number, minuto = 0): Date {
  const d = dia(desplazamiento);
  d.setUTCHours(hora + 5, minuto, 0, 0);
  return d;
}

const CALLES = [
  "Av. Principal",
  "Calle Los Ceibos",
  "Av. Las Palmas",
  "Calle del Río",
  "Av. Central",
  "Calle Las Orquídeas",
  "Av. del Bosque",
  "Calle Los Almendros",
];

const NOMBRES_SEGUNDA = [
  "Casa de la playa",
  "Oficina",
  "Quinta",
  "Casa de Samborondón",
  "Departamento",
  "Bodega",
  "Casa de los papás",
  "Local comercial",
];

async function limpiar() {
  if (!existsSync(MANIFIESTO)) {
    console.log("No hay nada sembrado por este script.");
    return;
  }
  const m: Manifiesto = JSON.parse(readFileSync(MANIFIESTO, "utf8"));

  for (const id of m.visitasCreadas) {
    await prisma.visitaPersonalTarea.deleteMany({
      where: { visitaPersonal: { visitaId: id } },
    });
    await prisma.visitaTareaObligatoria.deleteMany({ where: { visitaId: id } });
    await prisma.visitaPersonal.deleteMany({ where: { visitaId: id } });
    await prisma.visitaMedia.deleteMany({ where: { visitaId: id } });
    await prisma.visita.delete({ where: { id } }).catch(() => {
      console.log(`  ⚠ la visita ${id} no se pudo borrar`);
    });
  }
  console.log(`  ${m.visitasCreadas.length} visita(s) borradas`);

  for (const id of m.propiedadesCreadas) {
    await prisma.propiedad.delete({ where: { id } }).catch(() => {
      console.log(`  ⚠ la propiedad ${id} tiene visitas: queda`);
    });
  }
  console.log(`  ${m.propiedadesCreadas.length} propiedad(es) borradas`);

  // Solo los campos que este script tocó vuelven a null: el resto es dato real.
  for (const p of m.propiedadesTocadas) {
    const data: Record<string, null> = {};
    for (const campo of p.campos) data[campo] = null;
    await prisma.propiedad.update({ where: { id: p.id }, data }).catch(() => {});
  }
  console.log(`  ${m.propiedadesTocadas.length} propiedad(es) devueltas a como estaban`);

  const vueltas = await prisma.visita.updateMany({
    where: { id: { in: m.visitasArchivadas } },
    data: { deletedAt: null, deletedById: null, deletedByNombre: null },
  });
  console.log(`  ${vueltas.count} visita(s) desarchivadas`);

  unlinkSync(MANIFIESTO);
  console.log("Listo.");
}

async function sembrar() {
  if (existsSync(MANIFIESTO)) {
    console.log(
      "Ya hay datos de este script. Corré --limpiar antes de volver a sembrar."
    );
    return;
  }

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", accesoRevocadoEl: null },
    select: { id: true, name: true, apellido: true },
  });
  if (!admin) throw new Error("No hay ADMIN en la base");
  const nombreAdmin = `${admin.name ?? ""} ${admin.apellido ?? ""}`.trim();

  const personal = await prisma.personal.findMany({
    where: { deletedAt: null },
    select: { id: true, nombre: true, apellido: true },
  });
  /**
   * El jardinero con el que se puede entrar a la app.
   *
   * Sembrar y repartir las visitas al azar dejaba al de prueba con una sola, y
   * entonces la app se abre, muestra una tarjeta y no se puede ver nada más.
   * Este va sí o sí en la mitad de las visitas, incluidas las de hoy y varias
   * cerradas con su parte.
   */
  const debutante = await prisma.personal.findFirst({
    where: {
      deletedAt: null,
      user: { password: { not: null }, accesoRevocadoEl: null },
    },
    select: { id: true, nombre: true, apellido: true, user: { select: { usuario: true } } },
  });

  const tareas = await prisma.tarea.findMany({
    where: { deletedAt: null },
    select: { id: true, nombre: true },
    orderBy: { orden: "asc" },
  });
  if (personal.length === 0 || tareas.length === 0) {
    throw new Error("Hacen falta personal y tareas cargados");
  }

  const manifiesto: Manifiesto = {
    visitasArchivadas: [],
    visitasCreadas: [],
    propiedadesCreadas: [],
    propiedadesTocadas: [],
  };

  // ── 1. Archivar lo que había ────────────────────────────────────────────
  const viejas = await prisma.visita.findMany({
    where: { deletedAt: null },
    select: { id: true },
  });
  manifiesto.visitasArchivadas = viejas.map((v) => v.id);
  await prisma.visita.updateMany({
    where: { id: { in: manifiesto.visitasArchivadas } },
    data: {
      deletedAt: new Date(),
      deletedById: admin.id,
      deletedByNombre: nombreAdmin || null,
    },
  });
  console.log(`1. ${viejas.length} visita(s) archivadas (las devuelve --limpiar)`);

  // ── 2. Pin y medidas en propiedades que ya estaban ──────────────────────
  const existentes = await prisma.propiedad.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      nombre: true,
      lat: true,
      direccion: true,
      m2Total: true,
      cliente: { select: { id: true, nombre: true, apellido: true, empresa: true } },
      sector: { select: { nombre: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Dos de cada tres reciben pin: la tercera queda sin ubicación **a
  // propósito**, que es el estado que hay que poder mirar.
  let conPin = 0;
  for (const [i, p] of existentes.entries()) {
    const campos: string[] = [];
    const data: Record<string, unknown> = {};

    if (p.lat === null && i % 3 !== 2) {
      const punto = puntoEn(p.sector?.nombre);
      data.lat = punto.lat;
      data.lng = punto.lng;
      campos.push("lat", "lng");
      conPin++;
    }
    if (!p.direccion) {
      data.direccion = `${elegir(CALLES)} ${entero(100, 899)}`;
      campos.push("direccion");
    }
    // Las medidas: a algunas todas, a otras ninguna, para ver las dos.
    if (p.m2Total === null && i % 4 !== 3) {
      const total = entero(180, 1400);
      Object.assign(data, {
        m2Total: total,
        m2Cesped: Math.round(total * 0.55),
        numeroArboles: entero(2, 24),
        mlVegetacionBaja: entero(10, 90),
        mlVegetacionMedia: entero(5, 60),
        mlVegetacionAlta: entero(0, 30),
        jardinerasPlantaAlta: azar() > 0.7,
      });
      campos.push(
        "m2Total",
        "m2Cesped",
        "numeroArboles",
        "mlVegetacionBaja",
        "mlVegetacionMedia",
        "mlVegetacionAlta"
      );
    }

    if (campos.length === 0) continue;
    await prisma.propiedad.update({
      where: { id: p.id },
      data: { ...data, updatedById: admin.id },
    });
    manifiesto.propiedadesTocadas.push({ id: p.id, campos });
  }
  console.log(
    `2. ${manifiesto.propiedadesTocadas.length} propiedad(es) completadas · ${conPin} con pin nuevo`
  );

  // ── 3. Segundas propiedades ─────────────────────────────────────────────
  // Uno de cada seis clientes pasa a tener dos, que es más o menos la
  // proporción real: la mayoría tiene una sola casa.
  const candidatos = existentes.filter((_, i) => i % 6 === 1).slice(0, 9);
  const segundas: { id: string; nombre: string; cliente: string; conPin: boolean }[] = [];

  for (const [i, base] of candidatos.entries()) {
    const sector = await prisma.sector.findFirst({
      where: { nombre: { not: base.sector?.nombre ?? "" } },
      select: { id: true, nombre: true },
    });
    // Una de cada tres nace sin ubicación, igual que en la vida real: se carga
    // la dirección y el pin se pone cuando alguien pasa por ahí.
    const ponerPin = i % 3 !== 2;
    const punto = ponerPin ? puntoEn(sector?.nombre) : { lat: null, lng: null };
    const tieneMedidas = i % 4 !== 3;
    const total = entero(150, 900);

    const creada = await prisma.propiedad.create({
      data: {
        clienteId: base.cliente.id,
        nombre: NOMBRES_SEGUNDA[i % NOMBRES_SEGUNDA.length],
        ciudad: "Guayaquil",
        sectorId: sector?.id ?? null,
        direccion: `${elegir(CALLES)} ${entero(100, 899)}`,
        numeroCasa: `${entero(1, 40)}`,
        referencia: elegir([
          "Casa esquinera, portón negro",
          "Frente al parque",
          "Junto a la garita 3",
          "Segunda entrada, a la derecha",
        ]),
        lat: punto.lat,
        lng: punto.lng,
        ...(tieneMedidas
          ? {
              m2Total: total,
              m2Cesped: Math.round(total * 0.4),
              numeroArboles: entero(1, 12),
              mlVegetacionBaja: entero(5, 50),
              mlVegetacionMedia: entero(0, 30),
              mlVegetacionAlta: entero(0, 15),
              jardinerasPlantaAlta: azar() > 0.5,
            }
          : {}),
        createdById: admin.id,
        updatedById: admin.id,
      },
      select: { id: true, nombre: true },
    });
    manifiesto.propiedadesCreadas.push(creada.id);
    segundas.push({
      id: creada.id,
      nombre: creada.nombre,
      cliente:
        `${base.cliente.nombre} ${base.cliente.apellido ?? ""}`.trim() ||
        base.cliente.empresa ||
        "Sin nombre",
      conPin: ponerPin,
    });
  }
  console.log(`3. ${segundas.length} segunda(s) propiedad(es) creadas`);

  // ── 4. Visitas ──────────────────────────────────────────────────────────
  /**
   * El plan del día, escrito a mano: qué día, en qué estado y con qué gente.
   * Las fechas son relativas a hoy, así que el seed sigue sirviendo mañana.
   */
  const plan: {
    dia: number;
    estado: "PROGRAMADA" | "EN_CURSO" | "COMPLETADA" | "INCOMPLETA" | "CANCELADA";
    notas?: string;
  }[] = [
    { dia: 0, estado: "PROGRAMADA" },
    { dia: 0, estado: "PROGRAMADA", notas: "Hay perro suelto en el patio de atrás." },
    { dia: 0, estado: "EN_CURSO" },
    { dia: 0, estado: "PROGRAMADA" },
    { dia: 1, estado: "PROGRAMADA", notas: "Tocar el timbre de la garita primero." },
    { dia: 1, estado: "PROGRAMADA" },
    { dia: 2, estado: "PROGRAMADA" },
    { dia: 2, estado: "PROGRAMADA" },
    { dia: 3, estado: "PROGRAMADA" },
    { dia: 4, estado: "PROGRAMADA" },
    { dia: 6, estado: "PROGRAMADA" },
    { dia: -1, estado: "COMPLETADA" },
    { dia: -1, estado: "COMPLETADA" },
    { dia: -2, estado: "COMPLETADA" },
    { dia: -2, estado: "INCOMPLETA", notas: "No había nadie para abrir el portón." },
    { dia: -3, estado: "COMPLETADA" },
    { dia: -4, estado: "COMPLETADA" },
    { dia: -5, estado: "COMPLETADA" },
    { dia: -6, estado: "CANCELADA", notas: "El cliente pidió moverla para la otra semana." },
    { dia: -7, estado: "COMPLETADA" },
    { dia: -9, estado: "COMPLETADA" },
    { dia: -12, estado: "COMPLETADA" },
  ];

  /**
   * Dónde es cada una. Primero las segundas propiedades —son las que hay que
   * poder ver— y después el resto, sin repetir cliente el mismo día (esa regla
   * la aplica el servicio, y acá no se la puede saltear tampoco).
   */
  const lugares = [
    ...segundas.map((s) => ({ propiedadId: s.id })),
    ...candidatos.map((c) => ({ propiedadId: c.id })),
    ...existentes.filter((_, i) => i % 5 === 0).map((p) => ({ propiedadId: p.id })),
    ...existentes.filter((_, i) => i % 7 === 3).map((p) => ({ propiedadId: p.id })),
  ];

  const usadoPorDia = new Map<string, Set<string>>();
  let indiceLugar = 0;
  const creadas: { numero: number; estado: string; propiedad: string; cliente: string }[] = [];

  for (const paso of plan) {
    // Buscar un lugar cuyo cliente no tenga ya una visita ese día.
    let elegido: { propiedadId: string } | null = null;
    let propiedad: {
      id: string;
      nombre: string;
      lat: number | null;
      lng: number | null;
      clienteId: string;
      cliente: { nombre: string; apellido: string | null; empresa: string | null };
    } | null = null;

    for (let intento = 0; intento < lugares.length; intento++) {
      const cand = lugares[(indiceLugar + intento) % lugares.length];
      const p = await prisma.propiedad.findUnique({
        where: { id: cand.propiedadId },
        select: {
          id: true,
          nombre: true,
          lat: true,
          lng: true,
          clienteId: true,
          cliente: { select: { nombre: true, apellido: true, empresa: true } },
        },
      });
      if (!p) continue;
      const clave = String(paso.dia);
      const ocupados = usadoPorDia.get(clave) ?? new Set<string>();
      if (ocupados.has(p.clienteId)) continue;
      ocupados.add(p.clienteId);
      usadoPorDia.set(clave, ocupados);
      elegido = cand;
      propiedad = p;
      indiceLugar = (indiceLugar + intento + 1) % lugares.length;
      break;
    }
    if (!elegido || !propiedad) continue;

    // El de prueba en una de cada dos, para que su lista tenga con qué
    // llenarse; el resto, al azar entre todos.
    const cuantos = azar() > 0.55 ? 2 : 1;
    const sorteados = [...personal].sort(() => azar() - 0.5);
    const gente =
      debutante && creadas.length % 2 === 0
        ? [
            personal.find((p) => p.id === debutante.id)!,
            ...sorteados.filter((p) => p.id !== debutante.id).slice(0, cuantos - 1),
          ]
        : sorteados.slice(0, cuantos);
    const obligatorias = tareas
      .slice(0, 6)
      .filter(() => azar() > 0.6)
      .slice(0, 3);

    const cerrada = paso.estado === "COMPLETADA" || paso.estado === "INCOMPLETA";

    const visita = await prisma.visita.create({
      data: {
        clienteId: propiedad.clienteId,
        propiedadId: propiedad.id,
        fechaProgramada: dia(paso.dia),
        fechaRealizada: cerrada ? dia(paso.dia) : null,
        estado: paso.estado,
        notas: paso.estado === "CANCELADA" || paso.estado === "INCOMPLETA" ? null : paso.notas ?? null,
        notasIncompleto:
          paso.estado === "CANCELADA" || paso.estado === "INCOMPLETA"
            ? paso.notas ?? null
            : null,
        completadaEl: paso.estado === "COMPLETADA" ? instante(paso.dia, 16) : null,
        completadaPorId: paso.estado === "COMPLETADA" ? admin.id : null,
        completadaPorNombre: paso.estado === "COMPLETADA" ? nombreAdmin || null : null,
        createdById: admin.id,
        updatedById: admin.id,
        tareasObligatorias: {
          create: obligatorias.map((t) => ({ tareaId: t.id })),
        },
      },
      select: { id: true, numero: true },
    });
    manifiesto.visitasCreadas.push(visita.id);

    // Los partes: quien estuvo, a qué hora y qué hizo.
    const entra = 8 + entero(0, 1);
    const sale = entra + 3 + entero(0, 2);
    for (const [i, p] of gente.entries()) {
      const marca =
        paso.estado === "EN_CURSO"
          ? { entradaEl: instante(paso.dia, entra, i * 5), salidaEl: null }
          : cerrada
            ? {
                entradaEl: instante(paso.dia, entra, i * 5),
                salidaEl: instante(paso.dia, sale, i * 7),
              }
            : { entradaEl: null, salidaEl: null };

      // La ubicación de la marca, cerca del pin de la propiedad cuando lo hay:
      // es lo que la oficina compara.
      const cerca =
        marca.entradaEl && propiedad.lat !== null && propiedad.lng !== null
          ? {
              entradaLat: Number((propiedad.lat + (azar() - 0.5) * 0.0006).toFixed(6)),
              entradaLng: Number((propiedad.lng! + (azar() - 0.5) * 0.0006).toFixed(6)),
              entradaPrecision: entero(5, 40),
              entradaSimulada: false,
            }
          : {};

      const vp = await prisma.visitaPersonal.create({
        data: {
          visitaId: visita.id,
          personalId: p.id,
          addedById: admin.id,
          ...marca,
          ...cerca,
        },
        select: { id: true },
      });

      // Con salida marcada hay tareas: marcar la salida es justo el momento en
      // que se preguntan.
      if (marca.salidaEl) {
        const hechas = tareas.filter(() => azar() > 0.75).slice(0, 4);
        const conAlMenosUna = hechas.length > 0 ? hechas : [tareas[0]];
        await prisma.visitaPersonalTarea.createMany({
          data: conAlMenosUna.map((t) => ({
            visitaPersonalId: vp.id,
            tareaId: t.id,
          })),
        });
      }
    }

    // Las horas de la visita se derivan de los partes.
    if (cerrada || paso.estado === "EN_CURSO") {
      const hh = (n: number) => `${String(n).padStart(2, "0")}:00`;
      await prisma.visita.update({
        where: { id: visita.id },
        data: {
          horaEntrada: hh(entra),
          horaSalida: cerrada ? hh(sale) : null,
        },
      });
    }

    creadas.push({
      numero: visita.numero,
      estado: paso.estado,
      propiedad: propiedad.nombre,
      cliente:
        `${propiedad.cliente.nombre} ${propiedad.cliente.apellido ?? ""}`.trim() ||
        propiedad.cliente.empresa ||
        "Sin nombre",
    });
  }
  console.log(`4. ${creadas.length} visita(s) creadas`);

  writeFileSync(MANIFIESTO, JSON.stringify(manifiesto, null, 2));

  // ── Qué mirar ───────────────────────────────────────────────────────────
  console.log("\n─────────── PARA MIRAR ───────────");
  if (debutante) {
    const suyas = await prisma.visita.count({
      where: {
        deletedAt: null,
        personal: { some: { personalId: debutante.id, removedAt: null } },
      },
    });
    console.log(
      `\nEn la app, como ${debutante.nombre} ${debutante.apellido ?? ""} (${debutante.user?.usuario ?? "sin usuario"}): ${suyas} visita(s) asignadas.`
    );
  }

  const conDos = await prisma.cliente.findMany({
    where: { deletedAt: null, propiedades: { some: { id: { in: manifiesto.propiedadesCreadas } } } },
    select: {
      id: true, nombre: true, apellido: true, empresa: true,
      propiedades: {
        where: { deletedAt: null },
        select: { id: true, nombre: true, lat: true, m2Total: true, sector: { select: { nombre: true } } },
      },
    },
  });
  console.log("\nClientes con más de una propiedad:");
  for (const c of conDos) {
    const nombre = `${c.nombre} ${c.apellido ?? ""}`.trim() || c.empresa;
    console.log(`  ${nombre}  /dashboard/clientes/${c.id}`);
    for (const p of c.propiedades) {
      console.log(
        `    · ${p.nombre} (${p.sector?.nombre ?? "sin sector"}) — ${p.lat !== null ? "con pin" : "SIN pin"}, ${p.m2Total !== null ? "con medidas" : "sin medidas"}`
      );
    }
  }

  console.log("\nVisitas creadas:");
  for (const v of creadas) {
    console.log(`  #${v.numero}  ${v.estado.padEnd(11)} ${v.cliente} — ${v.propiedad}`);
  }

  const totales = {
    propiedadesConPin: await prisma.propiedad.count({ where: { deletedAt: null, lat: { not: null } } }),
    propiedadesSinPin: await prisma.propiedad.count({ where: { deletedAt: null, lat: null } }),
    visitasVivas: await prisma.visita.count({ where: { deletedAt: null } }),
  };
  console.log("\nTotales:", totales);
}

const args = process.argv.slice(2);
(args.includes("--limpiar") ? limpiar() : sembrar())
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
