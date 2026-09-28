/**
 * Cómo se nombra y se pinta el estado de una visita.
 *
 * Estaba copiado en cuatro pantallas —las listas y las fichas del jardinero y
 * del cliente— y ninguna de las cuatro contemplaba `EN_CURSO`, que existe desde
 * que cada jardinero carga su propio parte: el chip decía "EN_CURSO" en crudo y
 * la barra salía del gris por defecto. Cuatro copias es exactamente por qué
 * ninguna se actualizó.
 *
 * Los colores salen del sistema de diseño (`lib/tema.ts`): que el mismo estado
 * se vea de dos maneras según la pantalla es peor que no tener color.
 */
import { estadoVisual, tema } from "@/lib/tema";

export function estadoLabel(estado: string): string {
  return estadoVisual[estado]?.etiqueta ?? estado;
}

export function estadoColor(estado: string): string {
  return estadoVisual[estado]?.punto ?? tema.texto3;
}

/** El par fondo + texto de la píldora de estado. */
export function estadoPildora(estado: string) {
  return estadoVisual[estado] ?? estadoVisual.COMPLETADA;
}

/**
 * Si el trabajo ya terminó, de una forma u otra.
 *
 * Es lo que decide si la fila se muestra apagada. La condición era
 * `estado !== "PROGRAMADA"`, que metía a `EN_CURSO` en la misma bolsa: una
 * visita en la que alguien está trabajando ahora mismo salía al 60% de opacidad
 * y con la barra gris. Era la fila más importante de la pantalla y se veía como
 * la menos.
 */
export function visitaTerminada(estado: string): boolean {
  return (
    estado === "COMPLETADA" ||
    estado === "INCOMPLETA" ||
    estado === "NO_REALIZADA" ||
    estado === "CANCELADA"
  );
}

/**
 * El estado como lo ve quien lo mira: **el de lo que él marcó**.
 *
 * Mientras la visita está abierta —programada o en curso—, lo que la base
 * dice de ella es la suma de lo que hicieron todos, y a un jardinero eso le
 * miente sobre lo suyo: la entrada de un compañero la pone "En curso" antes de
 * que él llegue, y la novedad de otro la pondría "Con novedad" cuando él ni
 * reportó. Así que acá se mira solo su parte: nada marcado, *Programada*; su
 * entrada, *En curso*; su salida, *Completada* —lo suyo está cargado y se fue
 * del jardín, aunque la visita siga esperando el parte de otro—; y si reportó
 * que no pudo, *Con novedad* (`NOVEDAD`, que no es un estado de la base sino
 * una forma de verlo).
 *
 * **Solo pisa `PROGRAMADA` y `EN_CURSO`.** Lo que la oficina cerró
 * —`COMPLETADA`, `INCOMPLETA`, `NO_REALIZADA`, `CANCELADA`— es lo que pasó y
 * no lo tapa nada. Sin `personalId` (la oficina mirando desde la app) se ve
 * el estado de la visita.
 */
export function estadoParaMi(
  visita: {
    estado: string;
    personal?: { personalId: string; entradaEl?: string | null; salidaEl: string | null }[] | null;
    novedades?: { personalId?: string }[] | null;
  },
  personalId: string | null
): string {
  const abierta = visita.estado === "PROGRAMADA" || visita.estado === "EN_CURSO";
  if (!abierta || !personalId) return visita.estado;
  // El servidor ya manda solo la propia; el `personalId` es por si una copia
  // vieja del teléfono trae las de todos.
  if (visita.novedades?.some((n) => n.personalId === personalId)) return "NOVEDAD";
  const mio = visita.personal?.find((p) => p.personalId === personalId);
  if (mio?.salidaEl) return "COMPLETADA";
  if (mio?.entradaEl) return "EN_CURSO";
  return "PROGRAMADA";
}
