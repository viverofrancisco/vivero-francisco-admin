/**
 * Cómo se ordena el catálogo de tareas, del lado del cliente.
 *
 * El enum vive en Prisma y el orden de verdad lo decide el servidor; esto es
 * cómo se llama cada opción en pantalla, cómo se ordena una lista ya cargada
 * —para pintar el cambio sin esperar al servidor— y cómo se mueve una selección
 * de a varias.
 *
 * Está acá y no en el portal porque la app hace exactamente lo mismo: la misma
 * pantalla, los mismos tres modos y el mismo "mover a la posición N". Escrito
 * dos veces, el día que uno se arregle el otro sigue roto.
 */
export type ModoOrdenTareas =
  | "PERSONALIZADO"
  | "ALFABETICO_AZ"
  | "ALFABETICO_ZA";

export const OPCIONES_ORDEN_TAREAS: {
  value: ModoOrdenTareas;
  label: string;
  /** Una línea de ayuda, para donde haya lugar (el cajón del teléfono). */
  detalle: string;
}[] = [
  {
    value: "PERSONALIZADO",
    label: "Personalizado",
    detalle: "El orden que armaste a mano",
  },
  { value: "ALFABETICO_AZ", label: "Alfabético (A–Z)", detalle: "Por nombre" },
  { value: "ALFABETICO_ZA", label: "Alfabético (Z–A)", detalle: "Al revés" },
];

interface Ordenable {
  nombre: string;
  orden: number;
}

/**
 * `localeCompare` con `es` y no una comparación de strings a secas: sin eso
 * "Árboles" se va después de "Zanja", porque la Á está fuera del alfabeto ASCII.
 */
export function ordenarTareas<T extends Ordenable>(
  items: T[],
  modo: ModoOrdenTareas
): T[] {
  const copia = [...items];
  if (modo === "PERSONALIZADO") {
    return copia.sort((a, b) => a.orden - b.orden || cmp(a.nombre, b.nombre));
  }
  const signo = modo === "ALFABETICO_AZ" ? 1 : -1;
  return copia.sort((a, b) => signo * cmp(a.nombre, b.nombre));
}

function cmp(a: string, b: string): number {
  return a.localeCompare(b, "es", { sensitivity: "base" });
}

export type DestinoDeOrden = "inicio" | "fin" | number;

/**
 * Lleva las marcadas a donde se pidió, **juntas y en el orden que ya tenían**
 * entre ellas.
 *
 * Se saca la selección de la lista y se la vuelve a insertar de una: así "mover
 * 3 a la posición 5" deja esas tres seguidas a partir de la 5, sin importar de
 * dónde venía cada una. Reubicarlas de a una daría un resultado distinto según
 * el orden en que se procesan.
 *
 * La posición se cuenta sobre la lista **final** y se recorta a lo que existe:
 * pedir la 20 de 17 es pedir el final, y la 0 o un negativo es el principio.
 */
export function moverEnOrden<T extends { id: string }>(
  lista: T[],
  ids: string[],
  destino: DestinoDeOrden
): T[] {
  const marcadas = new Set(ids);
  const elegidas = lista.filter((t) => marcadas.has(t.id));
  if (elegidas.length === 0) return lista;
  const resto = lista.filter((t) => !marcadas.has(t.id));

  const corte =
    destino === "inicio"
      ? 0
      : destino === "fin"
        ? resto.length
        : Math.min(Math.max(destino - 1, 0), resto.length);

  return [...resto.slice(0, corte), ...elegidas, ...resto.slice(corte)];
}
