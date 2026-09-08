import type { Prisma } from "@/generated/prisma/client";

const INSENSIBLE = { mode: "insensitive" as const };

/**
 * Lo que se escribe en un buscador de clientes, hecho condición.
 *
 * **Cada palabra tiene que aparecer en alguno de los campos**, y no la frase
 * entera en uno solo. "Maria Luisa" es el nombre completo en una ficha y
 * nombre + apellido en otra: buscando la frase contra `nombre` la segunda no
 * aparecía nunca, y había que buscar el nombre o el apellido por separado.
 * Como se mira palabra por palabra, tampoco importa el orden ni que sobre un
 * segundo apellido: "Luisa Maria" y "Maria Rosario" encuentran lo mismo.
 *
 * `extras` agrega campos a la misma pregunta —el teléfono en la lista de
 * clientes, por ejemplo—, que se evalúan por palabra igual que el resto.
 *
 * Devuelve `null` cuando no hay nada que buscar, para poder omitir la
 * condición en vez de armar una que no filtra.
 */
export function filtroClientePorTexto(
  texto: string | null | undefined,
  extras: (palabra: string) => Prisma.ClienteWhereInput[] = () => []
): Prisma.ClienteWhereInput | null {
  const palabras = (texto ?? "").trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return null;
  return {
    AND: palabras.map((palabra) => ({
      OR: [
        { nombre: { contains: palabra, ...INSENSIBLE } },
        { apellido: { contains: palabra, ...INSENSIBLE } },
        { empresa: { contains: palabra, ...INSENSIBLE } },
        ...extras(palabra),
      ],
    })),
  };
}

/**
 * Lo mismo para las consultas que van en SQL crudo: las palabras sueltas, ya
 * con sus comodines, para pedirlas con `ILIKE` una por una contra el texto
 * concatenado del cliente. Vacío = no hay nada que filtrar.
 */
export function palabrasParaIlike(texto: string | null | undefined): string[] {
  return (texto ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((palabra) => `%${palabra}%`);
}

/**
 * El número que se escribió, con o sin `#`, o `null` si no es un número suelto.
 *
 * Es como la gente nombra las cosas en voz alta —"la visita 137", "el informe
 * 54"—, y cada tabla tiene su propia secuencia, así que el número solo
 * significa algo dentro de la lista donde se lo busca.
 */
export function numeroBuscado(texto: string | null | undefined): number | null {
  const t = (texto ?? "").trim();
  return /^#?\d{1,9}$/.test(t) ? Number(t.replace("#", "")) : null;
}

/**
 * Un dígito suelto es un número y nada más.
 *
 * Buscarlo también como texto engancha cualquier nombre o empresa que lleve un
 * uno adentro: filas de ruido tapando la visita #1, que es lo único que se
 * puede haber querido al escribir un solo carácter. Misma regla que en la
 * búsqueda global.
 */
export function esSoloNumero(texto: string | null | undefined): boolean {
  const t = (texto ?? "").trim();
  return numeroBuscado(t) !== null && t.replace("#", "").length < 2;
}
