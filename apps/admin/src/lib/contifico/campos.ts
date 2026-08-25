/**
 * Los campos que el portal escribe en un producto de Contífico.
 *
 * Vive aparte de `productos.ts` porque ese módulo importa Prisma y no puede
 * cargarse en el navegador. La UI muestra un resumen de lo que se va a escribir
 * antes de confirmar, y tiene que salir de la **misma** función que arma el
 * POST: si fueran dos listas separadas, se desincronizarían en el primer cambio.
 */

/** Qué es el ítem, en el vocabulario de Contífico. */
export type TipoContifico = "SER" | "PRO";

export interface ProductoDelPortal {
  id: string;
  nombre: string;
  descripcion: string | null;
  /** `SERVICIO` | `BIEN` del portal. */
  tipo: string;
  ivaTasa: number | null;
  contificoCategoriaId?: string | null;
}

/**
 * Código determinístico y estable del portal. Es la llave anti-duplicados:
 * Contífico rechaza códigos repetidos pero acepta nombres repetidos, así que el
 * código es lo único que evita ensuciar su catálogo.
 *
 * Se deriva del id y **no** se lee `producto.codigo`: cuando el producto está
 * vinculado, ese campo tiene el código de Contífico, y reusarlo para crear
 * devolvería por 409 el mismo producto al que ya estaba vinculado.
 */
export function codigoParaProducto(producto: { id: string }): string {
  return `VF-${producto.id.slice(-10).toUpperCase()}`;
}

export function camposParaCrear(producto: ProductoDelPortal) {
  return {
    codigo: codigoParaProducto(producto),
    nombre: producto.nombre,
    descripcion: producto.descripcion ?? "",
    tipo: (producto.tipo === "SERVICIO" ? "SER" : "PRO") as TipoContifico,
    estado: "A",
    // El precio no vive en el catálogo sino en cada suscripción o visita, así
    // que el producto se marca como precio manual. Contífico rechaza un
    // producto sin `pvp1` ni `pvp_manual`.
    pvp_manual: true,
    pvp1: "0.0",
    minimo: "0.0",
    porcentaje_iva: producto.ivaTasa != null ? Number(producto.ivaTasa) : 0,
    ...(producto.contificoCategoriaId
      ? { categoria_id: producto.contificoCategoriaId }
      : {}),
  };
}

/** Lo mismo, en filas etiquetadas para mostrar antes de confirmar. */
export function resumenParaCrear(
  producto: ProductoDelPortal | null
): { etiqueta: string; valor: string }[] {
  const campos = producto ? camposParaCrear(producto) : null;
  return [
    {
      etiqueta: "Código",
      valor: campos?.codigo ?? "se genera al guardar el producto",
    },
    { etiqueta: "Nombre", valor: campos?.nombre ?? "—" },
    {
      etiqueta: "Descripción",
      valor: campos?.descripcion || "(vacía)",
    },
    {
      etiqueta: "Tipo",
      valor: campos ? `${campos.tipo} (${producto!.tipo.toLowerCase()})` : "—",
    },
    { etiqueta: "IVA", valor: `${campos?.porcentaje_iva ?? 0}%` },
    { etiqueta: "Estado", valor: "Activo" },
    { etiqueta: "Precio", valor: "manual (vive en el portal)" },
  ];
}
