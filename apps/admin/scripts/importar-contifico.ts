/**
 * Trae de Contífico el plan de cuentas y los centros de costo: las áreas se
 * enlazan a su centro de costo del portal y el resto entra como obras.
 *
 *   CONTIFICO_IMPORT_API_KEY=… npx tsx --env-file=.env scripts/importar-contifico.ts
 *   … --solo-plan | --solo-obras
 *
 * La clave va en su propia variable y no en `CONTIFICO_API_KEY` a propósito:
 * es la del vivero, y en el `.env` de desarrollo esa variable apunta a la
 * cuenta de prueba. Solo lee de Contífico.
 *
 * Se puede correr las veces que haga falta: cada fila guarda su id de
 * Contífico (`contificoId`) y volver a importar actualiza el nombre en vez de
 * duplicar. Lo que ya se editó en el portal —una cuenta desactivada, una obra
 * con su cliente— no se pisa: solo se actualiza el nombre y, en el plan, el
 * tipo. Los cinco centros de costo base los crea la migración.
 */
import { prisma } from "../src/lib/prisma";
import { compararCodigos, codigoDelPadre } from "@vivero/shared";

const BASE = "https://api.contifico.com/sistema/api/v1";

async function leer<T>(ruta: string): Promise<T> {
  const key = process.env.CONTIFICO_IMPORT_API_KEY;
  if (!key) throw new Error("Falta CONTIFICO_IMPORT_API_KEY");
  const res = await fetch(`${BASE}/${ruta}/`, { headers: { Authorization: key } });
  if (!res.ok) throw new Error(`Contífico respondió ${res.status} en ${ruta}`);
  return (await res.json()) as T;
}

interface CuentaContifico {
  id: string;
  nombre: string;
  codigo: string;
  /** `G` grupo, `C` cuenta de movimiento. */
  tipo: string;
}

interface CentroContifico {
  id: string;
  nombre: string;
  codigo: string;
  /** `G` grupo, `T` centro de movimiento. */
  tipo: string;
  padre_id: string | null;
  estado: string;
}

async function importarPlan() {
  const cuentas = (await leer<CuentaContifico[]>("contabilidad/cuenta-contable")).sort((a, b) =>
    compararCodigos(a.codigo, b.codigo)
  );
  const idPorCodigo = new Map<string, string>(
    (await prisma.cuentaContable.findMany({ select: { id: true, codigo: true } })).map((c) => [
      c.codigo,
      c.id,
    ])
  );
  let creadas = 0;
  let actualizadas = 0;
  // Ordenadas por código: el padre siempre llega antes que sus hijas.
  for (const c of cuentas) {
    const codigo = c.codigo.trim();
    const padreCodigo = codigoDelPadre(codigo);
    const padreId = padreCodigo ? idPorCodigo.get(padreCodigo) ?? null : null;
    if (padreCodigo && !padreId) {
      console.warn(`  ⚠ ${codigo} ${c.nombre}: no está su padre ${padreCodigo}, queda en la raíz`);
    }
    const tipo = c.tipo === "G" ? "GRUPO" : "DETALLE";
    const nombre = c.nombre.trim();
    const existente = await prisma.cuentaContable.findFirst({
      where: { OR: [{ contificoId: c.id }, { codigo }] },
      select: { id: true },
    });
    if (existente) {
      await prisma.cuentaContable.update({
        where: { id: existente.id },
        data: { nombre, tipo, contificoId: c.id },
      });
      idPorCodigo.set(codigo, existente.id);
      actualizadas++;
    } else {
      const creada = await prisma.cuentaContable.create({
        data: {
          codigo,
          nombre,
          tipo,
          padreId,
          contificoId: c.id,
          // Las que el contador ya marcó para no usar entran desactivadas.
          activa: !/no\s+utilizar/i.test(nombre),
        },
        select: { id: true },
      });
      idPorCodigo.set(codigo, creada.id);
      creadas++;
    }
  }
  console.log(`Plan de cuentas: ${creadas} creadas, ${actualizadas} actualizadas (${cuentas.length} en Contífico).`);
}

/**
 * Los centros de costo de Contífico que en realidad son áreas de la empresa,
 * y a cuál de las del portal corresponden. Los demás son obras.
 */
const AREAS: [RegExp, string][] = [
  [/mantenimiento/i, "Mantenimiento"],
  [/hip[oó]dromo/i, "Vivero Hipódromo"],
  [/aurora/i, "Vivero Aurora"],
];

async function importarObras() {
  const centros = await leer<CentroContifico[]>("contabilidad/centro-costo");
  const obrasCentro = await prisma.centroCosto.findUnique({ where: { nombre: "Obras" } });
  if (!obrasCentro) throw new Error("Falta el centro de costo Obras: corre las migraciones");
  let creadas = 0;
  let actualizadas = 0;
  let areas = 0;
  for (const c of centros) {
    // El grupo es la empresa entera, no un lugar al que cargarle costos.
    if (c.tipo === "G") continue;
    const nombre = c.nombre.trim();

    const area = AREAS.find(([re]) => re.test(nombre));
    if (area) {
      await prisma.centroCosto.update({
        where: { nombre: area[1] },
        data: { contificoId: c.id },
      });
      areas++;
      continue;
    }

    const existente = await prisma.obra.findUnique({ where: { contificoId: c.id }, select: { id: true } });
    if (existente) {
      await prisma.obra.update({
        where: { id: existente.id },
        data: { nombre, contificoCodigo: c.codigo },
      });
      actualizadas++;
    } else {
      await prisma.obra.create({
        data: {
          nombre,
          centroCostoId: obrasCentro.id,
          // Contífico no distingue una obra terminada de una en curso: todas
          // dicen "Activo". Se corrigen en el portal.
          estado: c.estado === "A" ? "EN_CURSO" : "TERMINADA",
          contificoId: c.id,
          contificoCodigo: c.codigo,
          updatedByNombre: "Importación de Contífico",
        },
      });
      creadas++;
    }
  }
  console.log(`Obras: ${creadas} creadas, ${actualizadas} actualizadas; ${areas} áreas enlazadas a su centro de costo.`);
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.includes("--solo-obras")) await importarPlan();
  if (!args.includes("--solo-plan")) await importarObras();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
