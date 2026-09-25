import { z } from "zod/v4";

/**
 * Una línea del editor de órdenes. La descripción y el precio son la verdad:
 * el catálogo solo prellena. La procedencia (`suscripcionId` + período) va
 * cuando la línea es la de un período de plan.
 *
 * Una línea es de un producto **o** de un período de plan. Sin producto solo
 * puede ser la del plan —de ahí sale su `codigoPrincipal`—; eso lo cuida el
 * servicio (`validarLineas`), que es quien sabe de qué es la orden.
 */
export const ordenLineaSchema = z.object({
  descripcion: z.string().trim().min(1, "El producto necesita descripción").max(300),
  cantidad: z.number().positive("La cantidad debe ser mayor a 0"),
  precioUnitario: z.number().min(0, "El precio no puede ser negativo"),
  ivaTasa: z.number().min(0).max(100).default(0),
  productoId: z.string().min(1).nullable().optional(),
  /**
   * Qué variante se vende. La exige el servicio cuando el producto es un bien
   * —con una sola, la completa solo—: acá no se sabe el `tipo`.
   */
  varianteId: z.string().min(1).nullable().optional(),
  suscripcionId: z.string().min(1).nullable().optional(),
  periodoInicio: z.string().min(1).nullable().optional(),
  periodoFin: z.string().min(1).nullable().optional(),
});

export const crearOrdenSchema = z.object({
  clienteId: z.string().min(1, "Selecciona un cliente"),
  /** Con qué facturar. Sin esto, al emitir se usa el predeterminado. */
  datoFacturacionId: z.string().min(1).nullable().optional(),
  fecha: z.string().optional(),
  notas: z.string().max(1000).optional().or(z.literal("")),
  lineas: z.array(ordenLineaSchema).min(1, "Agrega al menos un producto"),
  /**
   * Qué visitas cubre. Solo traza: no carga líneas. La pantalla las marcaba
   * y el cuerpo no las mandaba, así que se perdían en silencio al crear.
   */
  visitaIds: z.array(z.string().min(1)).optional(),
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
