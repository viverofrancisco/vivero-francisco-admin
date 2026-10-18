import type { ProductoDelCatalogoDetalle } from "@vivero/shared";

/**
 * Los productos que ya se abrieron, en memoria mientras la app está abierta:
 * volver a *Elegir opciones* o a la ficha del mismo producto pinta al
 * instante lo que ya llegó, y la respuesta nueva lo reemplaza detrás. No se
 * guarda en el teléfono: el stock y el precio cambian, y lo de hace una hora
 * solo sirve para no mirar una pantalla vacía.
 */
const productos = new Map<string, ProductoDelCatalogoDetalle>();

export function productoEnCache(id: string): ProductoDelCatalogoDetalle | null {
  return productos.get(id) ?? null;
}

/**
 * Guarda lo que llegó. La versión liviana del drawer (sin recomendaciones) no
 * pisa una completa: se le copian las recomendaciones que ya había.
 */
export function guardarProducto(p: ProductoDelCatalogoDetalle): void {
  const antes = productos.get(p.id);
  productos.set(
    p.id,
    antes && p.compradosJuntos.length === 0 && p.teGustaria.length === 0
      ? { ...p, compradosJuntos: antes.compradosJuntos, teGustaria: antes.teGustaria }
      : p
  );
}
