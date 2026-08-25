/**
 * Helpers para mostrar los servicios de una visita.
 *
 * Una visita cubre uno o más productos (`VisitaProducto`), así que
 * casi toda la UI necesita convertir esa lista en texto. Estos helpers aceptan
 * la forma mínima que devuelven los `include` de Prisma para que sirvan tanto en
 * server components como en el cliente.
 */

export interface VisitaProductoLike {
  producto: { id?: string; nombre: string; descripcion?: string | null };
}

export interface VisitaConProductos {
  productos: VisitaProductoLike[];
}

/** Nombres de los servicios de la visita, en el orden guardado. */
export function nombresProductos(visita: VisitaConProductos): string[] {
  return visita.productos.map((vs) => vs.producto.nombre);
}

/**
 * Texto de una línea con los servicios de la visita.
 * Con más de `max` servicios corta y agrega "+N".
 */
export function resumenProductos(
  visita: VisitaConProductos,
  max = 2
): string {
  const nombres = nombresProductos(visita);
  if (nombres.length === 0) return "Sin servicio";
  if (nombres.length <= max) return nombres.join(", ");
  return `${nombres.slice(0, max).join(", ")} +${nombres.length - max}`;
}

/** Todos los nombres unidos, sin cortar. Para notificaciones y PDFs. */
export function listaProductos(visita: VisitaConProductos): string {
  const nombres = nombresProductos(visita);
  return nombres.length > 0 ? nombres.join(", ") : "Sin servicio";
}

/** El primer servicio, para vistas que solo tienen espacio para uno. */
export function productoPrincipal(
  visita: VisitaConProductos
): string | null {
  return visita.productos[0]?.producto.nombre ?? null;
}

/**
 * `select` de Prisma para traer los servicios de una visita con la forma que
 * esperan los helpers de arriba. Reutilizable en cualquier query de visitas.
 */
export const PRODUCTOS_DE_VISITA_SELECT = {
  orderBy: { orden: "asc" },
  select: {
    productoId: true,
    suscripcionItemId: true,
    // Si tiene línea de orden, este trabajo ya se cobró (o está por cobrarse).
    ordenLinea: { select: { ordenId: true, orden: { select: { numero: true } } } },
    producto: {
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        tipo: true,
      },
    },
  },
} as const;

/** Fila serializada de servicio, tal como la reciben los componentes cliente. */
export interface ProductoDeVisita {
  productoId: string;
  suscripcionItemId: string | null;
  ordenLinea: { ordenId: string; orden: { numero: number } } | null;
  producto: {
    id: string;
    nombre: string;
    descripcion: string | null;
    tipo: string;
  };
}
