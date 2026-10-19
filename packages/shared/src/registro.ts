import { z } from "zod";

/**
 * Crear una cuenta de cliente desde la app, sin que nadie del vivero la cree.
 *
 * Son dos pasos: el primero manda los datos y recibe un código de seis
 * dígitos en el correo; el segundo devuelve el código y, si coincide, crea la
 * cuenta y abre la sesión. El código es la prueba de que el correo es suyo,
 * que es lo que permite vincular la cuenta a una ficha que ya existía con ese
 * correo sin regalarle a cualquiera las visitas de otro.
 */
/**
 * Las reglas del correo y la contraseña al crear la cuenta. Las usan el
 * servidor y la pantalla, que las muestra debajo de cada campo mientras se
 * escribe: una sola definición para que no digan cosas distintas.
 */
export const correoDeRegistro = z
  .string()
  .trim()
  .toLowerCase()
  .email("Escribe un correo válido")
  .max(120, "El correo es demasiado largo");
export const contrasenaDeRegistro = z
  .string()
  .min(8, "Al menos 8 caracteres")
  // bcrypt ignora lo que pase de 72 bytes: más largo no protege más.
  .max(72, "Máximo 72 caracteres");

/**
 * Nombre y apellido: dos letras como mínimo —una sola es casi siempre alguien
 * apurado, y "Li" u "Oz" existen— y solo letras (con tildes y ñ), espacios,
 * guion y apóstrofo: pasan *María José*, *Pérez-Ruiz* y *D'Angelo*.
 */
function parteDelNombre(vacio: string) {
  return z
    .string({ error: vacio })
    .trim()
    .min(1, vacio)
    .min(2, "Al menos 2 letras")
    .max(80, "Es demasiado largo")
    .regex(/^[\p{L}][\p{L}\p{M}\s'’-]*$/u, "Solo letras, espacios, guion o apóstrofo");
}
export const nombreDeRegistro = parteDelNombre("Escribe tu nombre");
export const apellidoDeRegistro = parteDelNombre("Escribe tu apellido");

/** El primer error de un valor contra una regla, o null si la cumple. */
export function errorDe(regla: z.ZodType, valor: unknown): string | null {
  const r = regla.safeParse(valor);
  return r.success ? null : (r.error.issues[0]?.message ?? "Dato inválido");
}

export const registroSchema = z.object({
  nombre: nombreDeRegistro,
  apellido: apellidoDeRegistro,
  email: correoDeRegistro,
  telefono: z.string().trim().max(30).optional(),
  /**
   * Sin ella, se elige después del código: el *Crear cuenta* del aviso de un
   * pedido o una solicitud de invitado va directo a verificar el correo.
   */
  password: contrasenaDeRegistro.optional(),
});

export const correoRegistroSchema = z.object({ email: correoDeRegistro });
export type RegistroBody = z.infer<typeof registroSchema>;

export const confirmarRegistroSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(120),
  codigo: z.string().trim().regex(/^\d{6}$/, "El código tiene 6 dígitos"),
  /** La contraseña, cuando no vino en el primer paso. */
  password: contrasenaDeRegistro.optional(),
});
export const verificarCodigoDeRegistroSchema = confirmarRegistroSchema.omit({ password: true });
export type ConfirmarRegistroBody = z.infer<typeof confirmarRegistroSchema>;

// ──────────────────────────────────────────────
// Catálogo que ve el cliente
// ──────────────────────────────────────────────

export interface ProductoDelCatalogo {
  id: string;
  nombre: string;
  tipo: "SERVICIO" | "BIEN";
  /** Texto plano, para la fila. */
  resumen: string | null;
  imagenUrl: string | null;
  /** Con IVA. `null` en un servicio, que se cotiza cada vez; 0 es *Gratis*. */
  precioDesde: number | null;
  /** Igual a `precioDesde` cuando todas las variantes cuestan lo mismo. */
  precioHasta: number | null;
  categorias: string[];
  /** Todas sus variantes llevan inventario y no queda ninguna. */
  agotado: boolean;
  /** Con una sola variante, su id: la tarjeta la añade al carrito directo. */
  varianteUnicaId: string | null;
  /** Lo que queda de esa variante única (`null` = sin límite). */
  disponibleUnica: number | null;
}

export interface VarianteDelCatalogo {
  id: string;
  /** "Rojo / Grande"; vacío en un producto sin opciones. */
  nombre: string;
  /** Sus valores, uno por opción y en el orden de `opciones`: ["Rojo", "Grande"]. */
  valores: string[];
  precio: number | null;
  imagenUrl: string | null;
  /**
   * Cuántas se pueden pedir: `null` sin límite (servicio, sin inventario o
   * vendible sin stock), un número lo que queda, y 0 es *Agotado*.
   */
  disponible: number | null;
}

export interface ProductoDelCatalogoDetalle extends ProductoDelCatalogo {
  /** Texto plano con sus saltos de párrafo. */
  descripcion: string | null;
  imagenes: string[];
  /** Las opciones con sus valores, en orden: la ficha dibuja una fila por opción. */
  opciones: { nombre: string; valores: string[] }[];
  variantes: VarianteDelCatalogo[];
  /** *Se pide junto con*: lo que más aparece en los mismos pedidos. */
  compradosJuntos: ProductoDelCatalogo[];
  /** *También te puede gustar*: de sus categorías, o de su mismo tipo. */
  teGustaria: ProductoDelCatalogo[];
}

/** Un precio con IVA para mostrar: `null` es *Se cotiza* y 0 es *Gratis*. */
export function textoDePrecio(precio: number | null): string {
  if (precio === null) return "Se cotiza";
  if (precio === 0) return "Gratis";
  return `$${precio.toFixed(2)}`;
}

/**
 * "$12.50", "$4.60 – $15.53" (variantes con precios distintos: el rango, de la
 * más barata a la más cara), "Gratis" o "Se cotiza".
 */
export function precioDelCatalogo(
  p: Pick<ProductoDelCatalogo, "tipo" | "precioDesde" | "precioHasta">
): string {
  if (p.tipo === "SERVICIO" || p.precioDesde === null) return "Se cotiza";
  if (p.precioHasta === 0) return "Gratis";
  const desde = `$${p.precioDesde.toFixed(2)}`;
  if (p.precioHasta !== null && p.precioHasta > p.precioDesde) {
    return `${desde} – $${p.precioHasta.toFixed(2)}`;
  }
  return desde;
}

// ──────────────────────────────────────────────
// Pedidos: el carrito del cliente
// ──────────────────────────────────────────────

/**
 * Lo que la app manda al confirmar el carrito: **qué** y **cuánto**, nunca el
 * precio —el servidor lo toma del catálogo— y cómo lo recibe: retiro en una
 * de las ubicaciones del vivero (`Ubicacion`, las de *Configuración →
 * Ubicaciones*), entrega en una de sus propiedades, o en un punto del mapa.
 */
export const pedidoSchema = z.object({
  lineas: z
    .array(
      z.object({
        varianteId: z.string().min(1),
        cantidad: z.number().int().min(1, "La cantidad mínima es 1").max(999),
      })
    )
    .min(1, "El carrito está vacío")
    .max(50),
  entrega: z.discriminatedUnion("tipo", [
    z.object({ tipo: z.literal("RETIRO"), ubicacionId: z.string().min(1) }),
    z.object({ tipo: z.literal("PROPIEDAD"), propiedadId: z.string().min(1) }),
    z.object({
      tipo: z.literal("UBICACION"),
      direccion: z.string().trim().min(3, "Escribe la dirección").max(300),
      /** Los mismos campos que la dirección de una propiedad. */
      numeroCasa: z.string().trim().max(40).optional(),
      ciudad: z.string().trim().max(120).optional(),
      referencia: z.string().trim().max(300).optional(),
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      /** *Guardar esta dirección en mi cuenta*: la vuelve una propiedad suya. */
      guardar: z.boolean().optional(),
    }),
  ]),
  notas: z.string().trim().max(1000).optional(),
});
export type PedidoBody = z.infer<typeof pedidoSchema>;

/**
 * El pedido de un **invitado**: el mismo carrito, más con quién hablar —sin
 * cuenta no hay a quién atarlo—. Nombre y teléfono obligatorios (es como el
 * vivero coordina el pago y la entrega) y el correo también: con él crea su
 * cuenta después y ve el pedido. Recibe en el vivero o en una
 * dirección escrita; el servidor rechaza una propiedad.
 */
export const pedidoInvitadoSchema = pedidoSchema.extend({
  contacto: z.object({
    nombre: z.string().trim().min(1, "Escribe tu nombre").max(120),
    /** Opcional para no romper una app de antes del campo; la de hoy lo pide. */
    apellido: z.string().trim().max(120).optional(),
    telefono: z
      .string()
      .trim()
      .min(7, "Escribe tu teléfono")
      .max(30)
      .regex(/^[+\d\s()-]+$/, "Escribe un teléfono válido"),
    email: z.string().trim().toLowerCase().email("Escribe un correo válido").max(120),
  }),
});
export type PedidoInvitadoBody = z.infer<typeof pedidoInvitadoSchema>;

/** Cómo ve el cliente el estado de su pedido: la orden por dentro, en sus palabras. */
export const ETIQUETA_ESTADO_PEDIDO: Record<"BORRADOR" | "CONFIRMADA" | "ANULADA", string> = {
  BORRADOR: "Recibido",
  CONFIRMADA: "Confirmado",
  ANULADA: "Anulado",
};

export interface PedidoDelCliente {
  id: string;
  numero: number;
  estado: "BORRADOR" | "CONFIRMADA" | "ANULADA";
  createdAt: string;
  /** Con IVA; las líneas por cotizar no suman hasta que el vivero les pone precio. */
  total: number;
  porCotizar: boolean;
  /** "Retiro en Vivero Aurora", "Entrega en Casa", "Entrega en Av. …". */
  entrega: string;
  notas: string | null;
  lineas: { descripcion: string; cantidad: number; total: number | null }[];
}

// ──────────────────────────────────────────────
// Solicitudes: lo que un cliente le pide al vivero desde la app
// ──────────────────────────────────────────────

/** Cuántas fotos o videos se pueden adjuntar a una solicitud. */
export const MAX_ADJUNTOS_SOLICITUD = 10;

export const crearSolicitudSchema = z.object({
  mensaje: z.string().trim().min(1, "Cuéntanos qué necesitas").max(2000),
  /**
   * Los servicios que marcó: **al menos uno** (lo exige el servicio, que
   * también acepta el `productoId` de una app vieja en su lugar). Es lo que
   * le dice al vivero qué trabajo es antes de leer el mensaje. Los servicios
   * no están en el catálogo de la app; se eligen acá.
   */
  servicioIds: z.array(z.string().min(1)).max(30).optional(),
  /** Marcó *Otros*: lo que quiere no está en la lista. Cuenta como servicio. */
  otroServicio: z.boolean().optional(),
  /**
   * El de una app vieja, que lo mandaba desde *Solicitar cotización* en la
   * ficha de un servicio. Se suma a `servicioIds`.
   */
  productoId: z.string().min(1).optional(),
  /**
   * Fotos o videos de su jardín, opcionales: ya subidos a R2 con las URLs de
   * `/api/mobile/solicitudes/upload-urls`, acá van sus `key`. El servicio
   * comprueba que cada una esté bajo el prefijo de ese cliente.
   */
  adjuntos: z
    .array(
      z.object({
        key: z.string().min(1).max(300),
        contentType: z
          .string()
          .refine((t) => t.startsWith("image/") || t.startsWith("video/")),
        nombre: z.string().max(200).optional(),
      })
    )
    .max(MAX_ADJUNTOS_SOLICITUD)
    .optional(),
  /**
   * Dónde es el trabajo: una de sus propiedades (`propiedadId`), u otra
   * dirección con los campos de una propiedad y el pin en el mapa.
   */
  propiedadId: z.string().min(1).optional(),
  direccion: z.string().trim().max(300).optional(),
  numeroCasa: z.string().trim().max(40).optional(),
  ciudad: z.string().trim().max(120).optional(),
  referencia: z.string().trim().max(300).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  /**
   * *Guardar esta dirección en mi cuenta*, con otra dirección: la vuelve una
   * propiedad del cliente y la solicitud queda en ella. El invitado no tiene
   * cuenta, así que ahí no se usa.
   */
  guardarDireccion: z.boolean().optional(),
  /**
   * A qué número llamarlo para coordinar. La app lo pide siempre (con el de
   * su ficha puesto); el servidor lo exige si la ficha no tiene uno.
   */
  telefono: z
    .string()
    .trim()
    .min(7, "Escribe un teléfono válido")
    .max(30)
    .regex(/^[+\d\s()-]+$/, "Escribe un teléfono válido")
    .optional(),
});
export type CrearSolicitudBody = z.infer<typeof crearSolicitudSchema>;

/**
 * La misma solicitud, desde el modo invitado: sin cuenta, así que trae con
 * quién hablar. El teléfono es obligatorio porque es como el vivero contesta
 * —la mayoría de los clientes no usa correo—.
 */
export const solicitudDeInvitadoSchema = crearSolicitudSchema.extend({
  nombre: z.string().trim().min(1, "Escribe tu nombre").max(120),
  /** Opcional para no romper una app de antes del campo; la de hoy lo pide. */
  apellido: z.string().trim().max(120).optional(),
  telefono: z
    .string()
    .trim()
    .min(7, "Escribe tu teléfono")
    .max(30)
    .regex(/^[+\d\s()-]+$/, "Escribe un teléfono válido"),
  /** Obligatorio: con él crea su cuenta después y la solicitud pasa a ella. */
  email: z.string().trim().toLowerCase().email("Escribe un correo válido").max(120),
});
export type SolicitudDeInvitadoBody = z.infer<typeof solicitudDeInvitadoSchema>;

export interface SolicitudItem {
  id: string;
  numero: number;
  mensaje: string;
  /** Dónde es el trabajo, en una línea. */
  direccion: string | null;
  /** La propiedad que eligió, si fue una de las suyas. */
  propiedad: { id: string; nombre: string } | null;
  /**
   * La otra dirección por partes, para precargarla como *Propiedad nueva* al
   * agendar. `null` en las de antes, que la guardaban en una sola línea.
   */
  direccionPorPartes: {
    calle: string | null;
    numeroCasa: string | null;
    ciudad: string | null;
    referencia: string | null;
  } | null;
  /** El pin del lugar, para *Ver en el mapa*. */
  lat: number | null;
  lng: number | null;
  /** Los servicios que marcó (puede no haber ninguno). */
  servicios: { id: string; nombre: string }[];
  /** Marcó *Otros*: lo que quiere no está en la lista, y lo cuenta en el mensaje. */
  otroServicio: boolean;
  /** Fotos o videos de su jardín que adjuntó. */
  adjuntos: { id: string; url: string; tipo: "imagen" | "video"; nombre: string | null }[];
  /** Las visitas que se agendaron desde ella (puede ser más de una). */
  visitas: { id: string; numero: number; fechaProgramada: string; estado: string }[];
  /** `null` cuando la mandó alguien sin cuenta, desde el modo invitado. */
  cliente: {
    id: string;
    nombre: string;
    apellido: string | null;
    empresa: string | null;
    telefono: string | null;
    email: string | null;
  } | null;
  /** Con quién hablar: el cliente, o lo que escribió el invitado. */
  contacto: {
    /** El nombre completo, para mostrar. */
    nombre: string;
    telefono: string | null;
    email: string | null;
    /**
     * Nombre y apellido por separado, de un invitado que los escribió así:
     * con ellos se precarga *Cliente nuevo* al agendar. `null` con cuenta o
     * en las de antes del campo.
     */
    porPartes: { nombre: string; apellido: string } | null;
  };
  createdAt: string;
  atendidaEl: string | null;
  atendidaPorNombre: string | null;
}

const sinTildes = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Si una solicitud responde a lo que se escribió en el buscador: **cada
 * palabra** tiene que estar en *algún* campo —quién la mandó, su teléfono o
 * correo, lo que pide, los servicios que marcó o el lugar—, sin importar el orden ni las
 * tildes, la misma regla que los demás buscadores. Un número suelto, con o
 * sin `#`, también la encuentra por su `numero`.
 */
export function coincideSolicitud(s: SolicitudItem, texto: string): boolean {
  const palabras = sinTildes(texto).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return true;
  const numero = /^#?(\d+)$/.exec(texto.trim());
  if (numero && Number(numero[1]) === s.numero) return true;
  const campos = sinTildes(
    [
      s.contacto.nombre,
      s.cliente?.empresa,
      s.contacto.telefono,
      s.contacto.email,
      s.mensaje,
      ...s.servicios.map((x) => x.nombre),
      s.otroServicio ? OTROS_SERVICIOS : null,
      s.propiedad?.nombre,
      s.direccion,
    ]
      .filter(Boolean)
      .join(" ")
  );
  return palabras.every((p) => campos.includes(p.replace(/^#/, "")));
}

/** Un servicio que se puede marcar al pedir una visita. */
export interface ServicioParaSolicitar {
  id: string;
  nombre: string;
  descripcion: string | null;
}

/**
 * *Otros*, la opción para lo que no está en la lista. En el formulario viaja
 * entre los ids elegidos con este valor, que no es el id de ningún producto, y
 * al enviar se separa en `otroServicio`.
 */
export const SERVICIO_OTRO = "otro";
export const OTROS_SERVICIOS = "Otros";

/** Los nombres de lo que marcó, *Otros* al final. */
export function nombresDeServicios(
  s: Pick<SolicitudItem, "servicios" | "otroServicio">
): string[] {
  return [...s.servicios.map((x) => x.nombre), ...(s.otroServicio ? [OTROS_SERVICIOS] : [])];
}

/** Los servicios de una solicitud en una línea, o `null` si no marcó ninguno. */
export function serviciosEnUnaLinea(
  s: Pick<SolicitudItem, "servicios" | "otroServicio">
): string | null {
  const n = nombresDeServicios(s);
  return n.length ? n.join(", ") : null;
}
