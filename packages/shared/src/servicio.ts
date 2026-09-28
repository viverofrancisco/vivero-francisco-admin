import { z } from "zod";

/** Qué es el ítem. Es lo único que clasifica un producto del catálogo. */
export const tipoProductoSchema = z.enum(["SERVICIO", "BIEN"]);
export type TipoProducto = z.infer<typeof tipoProductoSchema>;

/**
 * Cada cuánto se cobra una suscripción. Vive en el contrato y no en el
 * catálogo: el mismo producto puede ser mensual para un cliente y trimestral
 * para otro.
 */
export const periodicidadSchema = z.enum([
  "MENSUAL",
  "TRIMESTRAL",
  "SEMESTRAL",
  "ANUAL",
]);
export type Periodicidad = z.infer<typeof periodicidadSchema>;

/** Si ya se puede vender. Un borrador no aparece en los selectores. */
export const estadoProductoSchema = z.enum(["ACTIVO", "BORRADOR"]);
export type EstadoProducto = z.infer<typeof estadoProductoSchema>;

export const ESTADO_PRODUCTO_LABEL: Record<EstadoProducto, string> = {
  ACTIVO: "Activo",
  BORRADOR: "Borrador",
};

export const createServicioSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  descripcion: z.string().trim().max(2000).optional().nullable(),
  tipo: tipoProductoSchema.default("SERVICIO"),
  /// Porcentaje. En Ecuador conviven 0% y 15%.
  ivaTasa: z.number().min(0).max(100).optional().nullable(),
  /**
   * El código del catálogo: va al `sku` de la variante única, que es de
   * donde sale el `codigoPrincipal` de la factura. Con varias variantes cada
   * una tiene el suyo y esto no aplica.
   */
  codigo: z.string().trim().max(60).optional().nullable(),
  estado: estadoProductoSchema.optional(),
  /** En qué categorías está. Reemplaza el conjunto entero. */
  categoriaIds: z.array(z.string().min(1)).optional(),
});
export type CreateServicioBody = z.infer<typeof createServicioSchema>;

// Edits allow partial updates but require nombre to remain non-empty when
// present.
export const updateServicioSchema = z.object({
  nombre: z.string().trim().min(1).max(120).optional(),
  descripcion: z.string().trim().max(2000).optional().nullable(),
  tipo: tipoProductoSchema.optional(),
  ivaTasa: z.number().min(0).max(100).optional().nullable(),
  codigo: z.string().trim().max(60).optional().nullable(),
  estado: estadoProductoSchema.optional(),
  categoriaIds: z.array(z.string().min(1)).optional(),
});
export type UpdateServicioBody = z.infer<typeof updateServicioSchema>;

/**
 * En qué unidad está el peso de una variante. Las cuatro de Shopify: el
 * vivero es métrico, pero la libra se usa a diario en Ecuador para lo que se
 * vende suelto, y una bolsa importada viene marcada en onzas.
 */
export const UNIDADES_DE_PESO = ["G", "KG", "LB", "OZ"] as const;
export type UnidadPeso = (typeof UNIDADES_DE_PESO)[number];

export const UNIDAD_PESO_LABEL: Record<UnidadPeso, string> = {
  G: "g",
  KG: "kg",
  LB: "lb",
  OZ: "oz",
};

/**
 * Lo que deja vender una unidad al precio de lista, sabiendo su costo.
 *
 * Es lo que Shopify muestra al lado del costo: la **ganancia** (precio menos
 * costo) y el **margen** (qué parte del precio es ganancia, en porcentaje).
 * Sin costo no hay nada que calcular y devuelve `null`; con precio en cero la
 * ganancia existe —es el costo, en negativo— pero el margen no, porque sería
 * dividir por cero, y ahí va `null` en vez de infinito.
 *
 * Se calcula y no se guarda: cambia cada vez que cambia el precio o el costo,
 * y una columna sería una segunda respuesta a la misma pregunta.
 */
export function gananciaDeVenta(
  precio: number,
  costo: number | null
): { ganancia: number; margen: number | null } | null {
  if (costo === null) return null;
  const ganancia = Math.round((precio - costo) * 100) / 100;
  const margen = precio > 0 ? Math.round((ganancia / precio) * 1000) / 10 : null;
  return { ganancia, margen };
}

/* ------------------------------------------------------------------ */
/* Orden del catálogo                                                  */
/* ------------------------------------------------------------------ */

/**
 * Por qué se ordena la lista de productos, como en Shopify: **un campo y una
 * dirección**, no ocho opciones sueltas. En el teléfono la hoja muestra los
 * campos como filas y la elegida lleva su dirección al lado, que un segundo
 * toque invierte; en escritorio las ocho combinaciones van en un desplegable.
 *
 * No hay *Inventario*: el stock de un producto es la suma de sus variantes y
 * Prisma no ordena por un agregado de una relación. El día que haga falta es
 * una consulta cruda, no una opción más acá.
 */
export const CAMPOS_ORDEN_PRODUCTOS = [
  "nombre",
  "tipo",
  "creado",
  "actualizado",
] as const;
export type CampoOrdenProductos = (typeof CAMPOS_ORDEN_PRODUCTOS)[number];
export type DireccionDeOrden = "asc" | "desc";

export interface OrdenProductos {
  campo: CampoOrdenProductos;
  direccion: DireccionDeOrden;
}

export const CAMPO_ORDEN_PRODUCTOS_LABEL: Record<CampoOrdenProductos, string> = {
  nombre: "Producto",
  tipo: "Tipo",
  creado: "Creado",
  actualizado: "Actualizado",
};

export interface DireccionConEtiqueta {
  direccion: DireccionDeOrden;
  etiqueta: string;
}

/**
 * Qué dice cada dirección para ese campo. **La primera es la que se propone
 * al elegir el campo**: un nombre se lee de la A a la Z y una fecha desde lo
 * último. El tipo sigue el orden del enum en la base (`SERVICIO`, `BIEN`),
 * que es como Postgres lo ordena: ascendente son los servicios primero.
 */
export const DIRECCIONES_DE_ORDEN: Record<
  CampoOrdenProductos,
  readonly [DireccionConEtiqueta, DireccionConEtiqueta]
> = {
  nombre: [
    { direccion: "asc", etiqueta: "A–Z" },
    { direccion: "desc", etiqueta: "Z–A" },
  ],
  tipo: [
    { direccion: "asc", etiqueta: "Servicios primero" },
    { direccion: "desc", etiqueta: "Bienes primero" },
  ],
  creado: [
    { direccion: "desc", etiqueta: "Más recientes primero" },
    { direccion: "asc", etiqueta: "Más antiguos primero" },
  ],
  actualizado: [
    { direccion: "desc", etiqueta: "Más recientes primero" },
    { direccion: "asc", etiqueta: "Más antiguos primero" },
  ],
};

/**
 * Los últimos creados primero, como Shopify: lo que se acaba de cargar es lo
 * que se va a buscar, y por nombre quedaba en la página que le tocara.
 */
export const ORDEN_PRODUCTOS_POR_DEFECTO: OrdenProductos = {
  campo: "creado",
  direccion: "desc",
};

/** Ese campo con la dirección que se propone para él. */
export function ordenPorCampo(campo: CampoOrdenProductos): OrdenProductos {
  return { campo, direccion: DIRECCIONES_DE_ORDEN[campo][0].direccion };
}

/** El mismo campo al revés: el segundo toque sobre la fila ya elegida. */
export function invertirOrden(orden: OrdenProductos): OrdenProductos {
  return {
    campo: orden.campo,
    direccion: orden.direccion === "asc" ? "desc" : "asc",
  };
}

/** "Más recientes primero", "A–Z": lo que se lee al lado del campo elegido. */
export function etiquetaDeDireccion(orden: OrdenProductos): string {
  return (
    DIRECCIONES_DE_ORDEN[orden.campo].find(
      (d) => d.direccion === orden.direccion
    )?.etiqueta ?? ""
  );
}

export function mismoOrden(a: OrdenProductos, b: OrdenProductos): boolean {
  return a.campo === b.campo && a.direccion === b.direccion;
}

/**
 * Cómo viaja: `creado-desc`, en la URL del portal y en el query de la app.
 * Lo que no se entiende —un valor viejo, uno tipeado a mano— es el orden por
 * defecto, nunca un error: ordenar distinto una lista no vale un 400.
 */
export function codificarOrden(orden: OrdenProductos): string {
  return `${orden.campo}-${orden.direccion}`;
}

export function decodificarOrden(
  texto: string | null | undefined
): OrdenProductos {
  if (!texto) return ORDEN_PRODUCTOS_POR_DEFECTO;
  const [campo, direccion] = texto.split("-");
  if (!(CAMPOS_ORDEN_PRODUCTOS as readonly string[]).includes(campo)) {
    return ORDEN_PRODUCTOS_POR_DEFECTO;
  }
  if (direccion !== "asc" && direccion !== "desc") {
    return ORDEN_PRODUCTOS_POR_DEFECTO;
  }
  return { campo: campo as CampoOrdenProductos, direccion };
}

/**
 * Las ocho combinaciones para el desplegable de escritorio, "Creado · Más
 * recientes primero", con el valor codificado como viaja en la URL.
 */
export const OPCIONES_ORDEN_PRODUCTOS: { value: string; label: string }[] =
  CAMPOS_ORDEN_PRODUCTOS.flatMap((campo) =>
    DIRECCIONES_DE_ORDEN[campo].map((d) => ({
      value: codificarOrden({ campo, direccion: d.direccion }),
      label: `${CAMPO_ORDEN_PRODUCTOS_LABEL[campo]} · ${d.etiqueta}`,
    }))
  );

/** Lo que hace falta de una fila para ordenarla en el navegador. */
export interface ProductoOrdenable {
  id: string;
  nombre: string;
  tipo: string;
  /** ISO. Los dos son instantes y en ese formato se comparan como texto. */
  createdAt: string;
  updatedAt: string;
}

/** El orden del enum en la base, que es el que Postgres usa al ordenar por tipo. */
const POSICION_DE_TIPO: Record<string, number> = { SERVICIO: 0, BIEN: 1 };

/**
 * Para ordenar en el navegador lo que ya llegó entero —el portal trae el
 * catálogo de un saque y filtra ahí—, con la misma regla que el servidor: el
 * campo, y de desempate el nombre (en tipo) y el id, **que no se invierten**:
 * en el servidor el id va siempre ascendente.
 *
 * **El nombre se compara por bytes, no con `localeCompare`.** La base de Neon
 * está en `C.UTF-8`, así que Postgres ordena los nombres por su código: las
 * mayúsculas antes que las minúsculas y "Césped" después de "Corteza", porque
 * la é vale más que la o. Es feo, pero es lo que la app recibe del servidor, y
 * un comparador más listo acá haría que el portal y la app mostraran el mismo
 * catálogo en dos órdenes. Lo que arregla eso es una colación en la columna
 * (`COLLATE "es-x-icu"`), que Prisma no expresa y va a mano en una migración;
 * el día que esté, este comparador cambia a `localeCompare("es")`.
 */
export function compararProductos(
  orden: OrdenProductos
): (a: ProductoOrdenable, b: ProductoOrdenable) => number {
  const signo = orden.direccion === "asc" ? 1 : -1;
  const texto = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  const porNombre = (a: ProductoOrdenable, b: ProductoOrdenable) =>
    texto(a.nombre, b.nombre);
  return (a, b) => {
    let r = 0;
    switch (orden.campo) {
      case "nombre":
        r = porNombre(a, b);
        break;
      case "tipo":
        r = (POSICION_DE_TIPO[a.tipo] ?? 9) - (POSICION_DE_TIPO[b.tipo] ?? 9);
        break;
      case "creado":
        r = texto(a.createdAt, b.createdAt);
        break;
      case "actualizado":
        r = texto(a.updatedAt, b.updatedAt);
        break;
    }
    if (r !== 0) return r * signo;
    if (orden.campo === "tipo") {
      const n = porNombre(a, b);
      if (n !== 0) return n;
    }
    return texto(a.id, b.id);
  };
}
