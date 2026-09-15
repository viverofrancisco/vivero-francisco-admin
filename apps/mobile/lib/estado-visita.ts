/**
 * Cómo se nombra y se pinta el estado de una visita.
 *
 * Estaba copiado en cuatro pantallas —las listas y las fichas del jardinero y
 * del cliente— y ninguna de las cuatro contemplaba `EN_CURSO`, que existe desde
 * que cada jardinero carga su propio parte: el chip decía "EN_CURSO" en crudo y
 * la barra salía del gris por defecto. Cuatro copias es exactamente por qué
 * ninguna se actualizó.
 *
 * Los colores son los mismos que usa el portal (`status-badge.tsx`): que el
 * mismo estado se vea de dos maneras según la pantalla es peor que no tener
 * color.
 */

const ESTADOS: Record<string, { label: string; color: string }> = {
  PROGRAMADA: { label: "Programada", color: "#2e7d32" },
  EN_CURSO: { label: "En curso", color: "#49829f" },
  COMPLETADA: { label: "Completada", color: "#9e9e9e" },
  INCOMPLETA: { label: "Incompleta", color: "#f57c00" },
  CANCELADA: { label: "Cancelada", color: "#c62828" },
};

export function estadoLabel(estado: string): string {
  return ESTADOS[estado]?.label ?? estado;
}

export function estadoColor(estado: string): string {
  return ESTADOS[estado]?.color ?? "#bdbdbd";
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
