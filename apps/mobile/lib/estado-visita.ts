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
    estado === "CANCELADA"
  );
}
