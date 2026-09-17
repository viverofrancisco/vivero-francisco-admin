/**
 * De qué propiedad es un informe o una orden.
 *
 * **No es una columna, y no debería serlo.** Un informe cuenta el trabajo de
 * unas visitas y una orden cobra el de otras; la visita es la que sabe dónde
 * pasó —`Visita.propiedadId` es NOT NULL— así que la propiedad se deriva de
 * ahí. Guardarla aparte sería una segunda respuesta a la misma pregunta, que
 * es exactamente lo que se desincroniza el día que alguien corrige la visita.
 *
 * Son **varias**, además: cobrar el mes entero de un cliente con dos casas es
 * una sola orden que cubre visitas de las dos. Una columna no puede decir eso.
 *
 * Y a veces no hay ninguna: un informe puede armarse sin visitas —es un
 * documento igual— y una orden puede ser el período de un plan, que es del
 * cliente y no de un lugar. Ahí no se muestra nada, que es distinto de mostrar
 * un guión.
 */
export interface PropiedadNombrada {
  id: string;
  nombre: string;
}

/** Las propiedades distintas de un conjunto de visitas, en el orden en que aparecen. */
export function propiedadesDeVisitas(
  visitas: ReadonlyArray<{ propiedad?: PropiedadNombrada | null } | null | undefined>
): PropiedadNombrada[] {
  const vistas = new Map<string, PropiedadNombrada>();
  for (const v of visitas) {
    const p = v?.propiedad;
    if (p && !vistas.has(p.id)) vistas.set(p.id, { id: p.id, nombre: p.nombre });
  }
  return [...vistas.values()];
}

/**
 * Cómo se dice en un renglón: el nombre cuando es una, cuántas cuando son varias.
 *
 * Con dos o tres todavía entran los nombres, y son los que permiten reconocer
 * de cuál se trata; de ahí en adelante la enumeración es más larga que la fila.
 */
export function resumenDePropiedades(nombres: readonly string[]): string | null {
  if (nombres.length === 0) return null;
  if (nombres.length <= 3) return nombres.join(" · ");
  return `${nombres.length} propiedades`;
}
