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

// ──────────────────────────────────────────────
// Cómo se muestra una propiedad
// ──────────────────────────────────────────────

/** Lo mínimo para escribir dónde queda y qué hay que mantener. */
export interface PropiedadMostrable {
  nombre?: string | null;
  ciudad?: string | null;
  direccion?: string | null;
  numeroCasa?: string | null;
  referencia?: string | null;
  lat?: number | null;
  lng?: number | null;
  m2Total?: number | null;
  jardinerasPlantaAlta?: boolean | null;
  numeroArboles?: number | null;
  mlVegetacionBaja?: number | null;
  mlVegetacionMedia?: number | null;
  mlVegetacionAlta?: number | null;
  m2Cesped?: number | null;
  sector?: { nombre: string } | null;
}

/** La calle y el número, en un renglón. Vacío si nadie los cargó. */
export function direccionDePropiedad(p: PropiedadMostrable): string {
  return [p.direccion, p.numeroCasa].filter(Boolean).join(" ").trim();
}

/** Dónde queda eso: "Vía a la Costa · Guayaquil". */
export function zonaDePropiedad(p: PropiedadMostrable): string {
  return [p.sector?.nombre, p.ciudad].filter(Boolean).join(" · ");
}

/**
 * Las medidas cargadas, listas para mostrar.
 *
 * **Solo lo que alguien midió.** Todas son opcionales porque se completan con
 * el tiempo, y una fila que dice "Árboles: —" ocupa lo mismo que una con el
 * dato y no informa nada. `jardinerasPlantaAlta` sigue la misma regla y aparece
 * solo cuando es verdadera: es un booleano con `false` por defecto, así que un
 * "No" sería indistinguible de "todavía nadie miró".
 *
 * Vive acá y no en cada pantalla porque la ficha de la visita la muestra en el
 * teléfono y en el portal, y dos listas de lo mismo terminan midiendo cosas
 * distintas.
 */
export function medidasDePropiedad(
  p: PropiedadMostrable
): { etiqueta: string; valor: string }[] {
  const filas: { etiqueta: string; valor: string }[] = [];
  const numero = (etiqueta: string, valor: number | null | undefined, sufijo = "") => {
    if (valor === null || valor === undefined) return;
    filas.push({ etiqueta, valor: `${valor}${sufijo}` });
  };

  numero("Área total", p.m2Total, " m²");
  numero("Césped", p.m2Cesped, " m²");
  numero("Árboles", p.numeroArboles);
  numero("Vegetación baja", p.mlVegetacionBaja, " m");
  numero("Vegetación media", p.mlVegetacionMedia, " m");
  numero("Vegetación alta", p.mlVegetacionAlta, " m");
  if (p.jardinerasPlantaAlta) {
    filas.push({ etiqueta: "Jardineras en planta alta", valor: "Sí" });
  }
  return filas;
}

/**
 * El enlace para **llegar**, no para mirar.
 *
 * Lo que se necesita parado en la puerta es que arranque la navegación, así que
 * el destino va como coordenadas y no como dirección escrita: "Blue Bay" son
 * doscientas casas, y el pin es justo lo que se cargó para no depender de eso.
 */
export function enlaceParaLlegar(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
