/**
 * Cómo se ordena el catálogo de tareas, del lado del navegador.
 *
 * El enum vive en Prisma; esto es solo cómo se llama cada opción en pantalla y
 * cómo se ordena una lista ya cargada, que es lo que hace falta para pintar el
 * cambio sin esperar al servidor.
 */
export type ModoOrden = "PERSONALIZADO" | "ALFABETICO_AZ" | "ALFABETICO_ZA";

export const OPCIONES_ORDEN: { value: ModoOrden; label: string }[] = [
  { value: "PERSONALIZADO", label: "Personalizado" },
  { value: "ALFABETICO_AZ", label: "Alfabético (A–Z)" },
  { value: "ALFABETICO_ZA", label: "Alfabético (Z–A)" },
];

interface Ordenable {
  nombre: string;
  orden: number;
}

/**
 * `localeCompare` con `es` y no una comparación de strings a secas: sin eso
 * "Árboles" se va después de "Zanja", porque la Á está fuera del alfabeto ASCII.
 */
export function ordenar<T extends Ordenable>(items: T[], modo: ModoOrden): T[] {
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

export type Destino = "inicio" | "fin" | number;

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
export function moverA<T extends { id: string }>(
  lista: T[],
  ids: string[],
  destino: Destino
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
