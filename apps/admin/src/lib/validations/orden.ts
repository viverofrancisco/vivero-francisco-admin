import { z } from "zod/v4";

/**
 * Una línea del editor de órdenes. La descripción y el precio son la verdad:
 * el catálogo solo prellena. La procedencia (`visitaProductoId` o
 * `suscripcionItemId` + período) va cuando la línea viene de trabajo pendiente.
 *
 * `productoId` es obligatorio: Contífico exige `producto_id` en cada línea y no
 * acepta texto libre, así que una línea suelta sería una venta incobrable.
 */
export const ordenLineaSchema = z.object({
  descripcion: z.string().trim().min(1, "El producto necesita descripción").max(300),
  cantidad: z.number().positive("La cantidad debe ser mayor a 0"),
  precioUnitario: z.number().min(0, "El precio no puede ser negativo"),
  ivaTasa: z.number().min(0).max(100).default(0),
  productoId: z.string().min(1, "Cada ítem necesita un producto del catálogo"),
  visitaProductoId: z.string().min(1).nullable().optional(),
  suscripcionItemId: z.string().min(1).nullable().optional(),
  periodoInicio: z.string().min(1).nullable().optional(),
  periodoFin: z.string().min(1).nullable().optional(),
});

export const crearOrdenSchema = z.object({
  clienteId: z.string().min(1, "Selecciona un cliente"),
  /** Con qué facturar. Sin esto, al emitir se usa el predeterminado. */
  datoFacturacionId: z.string().min(1).nullable().optional(),
  fecha: z.string().optional(),
  notas: z.string().max(1000).optional().or(z.literal("")),
  lineas: z.array(ordenLineaSchema).min(1, "Agregá al menos un producto"),
});

/** Editar un borrador. `lineas` reemplaza el conjunto entero si viene. */
export const actualizarOrdenSchema = z.object({
  clienteId: z.string().min(1).optional(),
  datoFacturacionId: z.string().min(1).nullable().optional(),
  fecha: z.string().min(1).optional(),
  notas: z.string().max(1000).nullable().optional(),
  lineas: z.array(ordenLineaSchema).min(1, "La orden necesita al menos un producto").optional(),
});

export const generarOrdenSchema = z.object({
  clienteId: z.string().min(1, "Selecciona un cliente"),
  desde: z.string().min(1, "La fecha desde es obligatoria"),
  hasta: z.string().min(1, "La fecha hasta es obligatoria"),
  fecha: z.string().optional(),
  notas: z.string().max(1000).optional().or(z.literal("")),
});

/**
 * El rango es opcional: sin él se devuelve *todo* lo que el cliente debe, que
 * es lo que necesita el editor de órdenes para ofrecerlo como líneas.
 */
export const pendientesQuerySchema = z.object({
  clienteId: z.string().min(1),
  desde: z.string().min(1).optional(),
  hasta: z.string().min(1).optional(),
});

export const ordenesQuerySchema = z.object({
  clienteId: z.string().optional(),
  estado: z.enum(["BORRADOR", "CONFIRMADA", "ANULADA"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
