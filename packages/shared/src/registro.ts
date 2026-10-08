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
export const registroSchema = z.object({
  nombre: z.string().trim().min(1, "Escribe tu nombre").max(80),
  apellido: z.string().trim().max(80).optional(),
  email: z.string().trim().toLowerCase().email("Escribe un correo válido").max(120),
  telefono: z.string().trim().max(30).optional(),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(72),
});
export type RegistroBody = z.infer<typeof registroSchema>;

export const confirmarRegistroSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(120),
  codigo: z.string().trim().regex(/^\d{6}$/, "El código tiene 6 dígitos"),
});
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
  /**
   * Con IVA. `null` en un servicio —se cotiza cada vez— y en un bien sin
   * precio puesto, que no se muestra como gratis.
   */
  precioDesde: number | null;
  /** Igual a `precioDesde` cuando todas las variantes cuestan lo mismo. */
  precioHasta: number | null;
  categorias: string[];
}

export interface VarianteDelCatalogo {
  id: string;
  /** "Rojo / Grande"; vacío en un producto sin opciones. */
  nombre: string;
  precio: number | null;
  imagenUrl: string | null;
}

export interface ProductoDelCatalogoDetalle extends ProductoDelCatalogo {
  /** Texto plano con sus saltos de párrafo. */
  descripcion: string | null;
  imagenes: string[];
  variantes: VarianteDelCatalogo[];
}

/** "$12,50", "Desde $8,00" o "Se cotiza". */
export function precioDelCatalogo(
  p: Pick<ProductoDelCatalogo, "tipo" | "precioDesde" | "precioHasta">
): string {
  if (p.tipo === "SERVICIO" || p.precioDesde === null) return "Se cotiza";
  const desde = `$${p.precioDesde.toFixed(2)}`;
  if (p.precioHasta !== null && p.precioHasta > p.precioDesde) {
    return `Desde ${desde}`;
  }
  return desde;
}

// ──────────────────────────────────────────────
// Solicitudes: lo que un cliente le pide al vivero desde la app
// ──────────────────────────────────────────────

export const crearSolicitudSchema = z.object({
  mensaje: z.string().trim().min(1, "Cuéntanos qué necesitas").max(2000),
  /** Si viene de la ficha de un producto: de cuál se pide cotización. */
  productoId: z.string().min(1).optional(),
  /** Dónde: lo escribe quien todavía no tiene una propiedad cargada. */
  direccion: z.string().trim().max(300).optional(),
});
export type CrearSolicitudBody = z.infer<typeof crearSolicitudSchema>;

/**
 * La misma solicitud, desde el modo invitado: sin cuenta, así que trae con
 * quién hablar. El teléfono es obligatorio porque es como el vivero contesta
 * —la mayoría de los clientes no usa correo—.
 */
export const solicitudDeInvitadoSchema = crearSolicitudSchema.extend({
  nombre: z.string().trim().min(1, "Escribe tu nombre").max(120),
  telefono: z
    .string()
    .trim()
    .min(7, "Escribe tu teléfono")
    .max(30)
    .regex(/^[+\d\s()-]+$/, "Escribe un teléfono válido"),
  email: z.string().trim().toLowerCase().email("Escribe un correo válido").max(120).optional(),
});
export type SolicitudDeInvitadoBody = z.infer<typeof solicitudDeInvitadoSchema>;

export interface SolicitudItem {
  id: string;
  numero: number;
  mensaje: string;
  direccion: string | null;
  producto: { id: string; nombre: string } | null;
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
  contacto: { nombre: string; telefono: string | null; email: string | null };
  createdAt: string;
  atendidaEl: string | null;
  atendidaPorNombre: string | null;
}
