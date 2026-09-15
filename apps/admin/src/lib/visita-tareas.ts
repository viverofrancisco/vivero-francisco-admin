/**
 * Helpers para leer las tareas de una visita.
 *
 * Reemplazan a `visita-productos.ts`: una visita ya no lleva productos —eso era
 * plata, y agendar no es cotizar— sino tareas, que las carga cada jardinero al
 * terminar. Como el dato vive repartido entre las personas, casi toda la UI
 * necesita las mismas dos cuentas: qué se hizo en total y qué falta de lo que
 * se exigía.
 *
 * Están acá y no en el servicio porque las usa también el navegador; aceptan la
 * forma mínima que devuelven los `include` de Prisma.
 */

export interface TareaDeVisita {
  id: string;
  nombre: string;
  orden: number;
}

/**
 * Lo mínimo para contar qué se hizo: quién y qué marcó.
 *
 * Es a propósito más chico que el parte completo. Las notificaciones y los
 * resúmenes traen solo esto, y pedirles las horas o el id de la asignación las
 * obligaría a un `select` más grande para datos que no usan.
 */
export interface ParteMinimo {
  personal: { nombre: string; apellido: string | null };
  tareas: { tarea: TareaDeVisita }[];
}

export interface VisitaConTareas {
  tareasObligatorias: { tarea: TareaDeVisita }[];
  personal: ParteMinimo[];
}

/** Dónde estaba alguien al marcar. `null` en todo = no hubo ubicación. */
export interface UbicacionMarcada {
  lat: number | null;
  lng: number | null;
  /** Radio en metros que informó el dispositivo. ±2000 no dice nada. */
  precision: number | null;
  /** Android delata una ubicación de mock. iOS no: ahí es `null`, "no sabemos". */
  simulada: boolean | null;
}

/** El parte completo, como lo muestra la ficha de la visita. */
export interface PersonalDeVisita extends ParteMinimo {
  id: string;
  personalId: string;
  personal: { id: string; nombre: string; apellido: string | null };
  /** Cuándo marcó. `null` = todavía no marcó esa punta. */
  entradaEl: string | Date | null;
  salidaEl: string | Date | null;
  entradaLat: number | null;
  entradaLng: number | null;
  entradaPrecision: number | null;
  entradaSimulada: boolean | null;
  salidaLat: number | null;
  salidaLng: number | null;
  salidaPrecision: number | null;
  salidaSimulada: boolean | null;
  /** `null` = todavía no cargó su parte. */
  registradoEl: string | Date | null;
}

/** La ubicación de una de las dos marcas, ya agrupada. */
export function ubicacionDe(
  parte: PersonalDeVisita,
  cual: "entrada" | "salida"
): UbicacionMarcada | null {
  const lat = cual === "entrada" ? parte.entradaLat : parte.salidaLat;
  const lng = cual === "entrada" ? parte.entradaLng : parte.salidaLng;
  if (lat === null || lng === null) return null;
  return {
    lat,
    lng,
    precision: cual === "entrada" ? parte.entradaPrecision : parte.salidaPrecision,
    simulada: cual === "entrada" ? parte.entradaSimulada : parte.salidaSimulada,
  };
}

/** Cómo se nombra a alguien del personal en una línea. */
export function nombrePersonal(p: {
  nombre: string;
  apellido: string | null;
}): string {
  return [p.nombre, p.apellido].filter(Boolean).join(" ");
}

export interface TareaHecha extends TareaDeVisita {
  /** Quiénes la hicieron. Más de uno es normal: se reparten el jardín. */
  porQuienes: string[];
}

/**
 * Lo que se hizo en la visita: la unión de lo que cargó cada uno, sin repetir.
 *
 * Con quiénes la hicieron al lado, que es la pregunta que el modelo viejo —una
 * sola persona reportando por todo el grupo— no podía contestar.
 */
export function tareasHechas(visita: VisitaConTareas): TareaHecha[] {
  const porTarea = new Map<string, TareaHecha>();
  for (const p of visita.personal) {
    for (const { tarea } of p.tareas) {
      const ya = porTarea.get(tarea.id);
      if (ya) {
        ya.porQuienes.push(nombrePersonal(p.personal));
      } else {
        porTarea.set(tarea.id, {
          ...tarea,
          porQuienes: [nombrePersonal(p.personal)],
        });
      }
    }
  }
  return [...porTarea.values()].sort(
    (a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es")
  );
}

/**
 * Las obligatorias que **nadie** hizo.
 *
 * "Cubierta" es que la haya hecho cualquiera de los que fueron, no una persona
 * en particular: lo que la oficina pregunta al revisar es si el trabajo está
 * hecho, no quién lo hizo.
 */
export function obligatoriasSinCubrir(visita: VisitaConTareas): TareaDeVisita[] {
  const hechas = new Set(
    visita.personal.flatMap((p) => p.tareas.map((t) => t.tarea.id))
  );
  return visita.tareasObligatorias
    .map((o) => o.tarea)
    .filter((t) => !hechas.has(t.id))
    .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es"));
}

/** Quiénes todavía no cargaron su parte. */
export function personalSinRegistrar(
  partes: PersonalDeVisita[]
): PersonalDeVisita[] {
  return partes.filter((p) => p.registradoEl === null);
}

/** Texto de una línea con lo que se hizo. Con más de `max`, corta y suma "+N". */
export function resumenTareas(visita: VisitaConTareas, max = 2): string {
  const nombres = tareasHechas(visita).map((t) => t.nombre);
  if (nombres.length === 0) return "Sin tareas registradas";
  if (nombres.length <= max) return nombres.join(", ");
  return `${nombres.slice(0, max).join(", ")} +${nombres.length - max}`;
}

/** Todos los nombres unidos, sin cortar. Para notificaciones y PDFs. */
export function listaTareas(visita: VisitaConTareas): string {
  const nombres = tareasHechas(visita).map((t) => t.nombre);
  return nombres.length > 0 ? nombres.join(", ") : "Sin tareas registradas";
}

/**
 * `include` de Prisma para traer lo que estos helpers esperan.
 *
 * **Ojo: `as const` lo saca del chequeo de tipos.** Al spreadearse dentro de un
 * `include`, TypeScript no lo compara contra el esquema, así que un campo que
 * cambió de nombre compila igual y revienta recién en tiempo de ejecución. Tras
 * tocar `VisitaPersonalTarea` o `VisitaTareaObligatoria`, hay que abrir la
 * ficha de una visita para saber que sigue vivo.
 */
export const TAREAS_DE_VISITA_INCLUDE = {
  tareasObligatorias: {
    select: {
      tarea: { select: { id: true, nombre: true, orden: true } },
    },
  },
  personal: {
    where: { removedAt: null },
    orderBy: { addedAt: "asc" },
    select: {
      id: true,
      personalId: true,
      entradaEl: true,
      salidaEl: true,
      entradaLat: true,
      entradaLng: true,
      entradaPrecision: true,
      entradaSimulada: true,
      salidaLat: true,
      salidaLng: true,
      salidaPrecision: true,
      salidaSimulada: true,
      registradoEl: true,
      personal: {
        select: { id: true, nombre: true, apellido: true, tipo: true },
      },
      tareas: {
        select: {
          tarea: { select: { id: true, nombre: true, orden: true } },
        },
      },
    },
  },
} as const;
