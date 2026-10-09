import { z } from "zod";

/**
 * Para buscar sin que importen las tildes ni las mayúsculas: "mocoli"
 * encuentra "MOCOLÍ GOLF". Los nombres vienen de Contífico escritos de las dos
 * maneras, y quien busca casi nunca pone la tilde.
 */
export function paraBuscar(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// ──────────────────────────────────────────────
// Plan de cuentas
// ──────────────────────────────────────────────

export type TipoCuentaContable = "GRUPO" | "DETALLE";

export const ETIQUETA_TIPO_CUENTA: Record<TipoCuentaContable, string> = {
  GRUPO: "Grupo",
  DETALLE: "Detalle",
};

export type Naturaleza = "DEUDORA" | "ACREEDORA";

/**
 * De qué lado crece una cuenta, por su primer dígito.
 *
 * Activo (1) y costos y gastos (5 en adelante) crecen por el debe; pasivo (2),
 * patrimonio (3) e ingresos (4) por el haber. No se guarda en la cuenta porque
 * sale de su código, y un dato guardado al lado de su regla es el que se
 * desincroniza.
 */
export function naturalezaDeCuenta(codigo: string): Naturaleza {
  const raiz = codigo.split(".")[0];
  return raiz === "2" || raiz === "3" || raiz === "4" ? "ACREEDORA" : "DEUDORA";
}

/** "1.1.3" → "1.1"; una cuenta raíz no tiene padre. */
export function codigoDelPadre(codigo: string): string | null {
  const partes = codigo.split(".");
  return partes.length > 1 ? partes.slice(0, -1).join(".") : null;
}

/** Para ordenar "1.10" después de "1.9", no antes de "1.2". */
export function compararCodigos(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? -1;
    const y = pb[i] ?? -1;
    if (x !== y) return x - y;
  }
  return 0;
}

export const CODIGO_DE_CUENTA = /^\d+(\.\d+)*$/;

export const crearCuentaSchema = z.object({
  /** Sin padre es una raíz: `6`. Con padre, el código empieza por el suyo. */
  padreId: z.string().min(1).nullable(),
  codigo: z
    .string()
    .trim()
    .regex(CODIGO_DE_CUENTA, "El código son números separados por puntos: 1.1.3"),
  nombre: z.string().trim().min(1, "Escribe el nombre").max(200),
  tipo: z.enum(["GRUPO", "DETALLE"]),
});
export type CrearCuentaBody = z.infer<typeof crearCuentaSchema>;

/**
 * El código no se edita: ordena el árbol y nombra la cuenta en los asientos.
 * El tipo sí, mientras la regla lo permita (un grupo con hijas no pasa a
 * detalle).
 */
export const editarCuentaSchema = z.object({
  nombre: z.string().trim().min(1, "Escribe el nombre").max(200).optional(),
  activa: z.boolean().optional(),
  tipo: z.enum(["GRUPO", "DETALLE"]).optional(),
});
export type EditarCuentaBody = z.infer<typeof editarCuentaSchema>;

export interface CuentaDelPlan {
  id: string;
  codigo: string;
  nombre: string;
  tipo: TipoCuentaContable;
  padreId: string | null;
  activa: boolean;
}

// ──────────────────────────────────────────────
// Centros de costo: las partes de la empresa
// ──────────────────────────────────────────────

export const centroCostoSchema = z.object({
  nombre: z.string().trim().min(1, "Escribe el nombre").max(100),
  activo: z.boolean().optional(),
  orden: z.number().int().min(0).max(10_000).optional(),
});
export type CentroCostoBody = z.infer<typeof centroCostoSchema>;

export interface CentroCostoFila {
  id: string;
  nombre: string;
  orden: number;
  activo: boolean;
  /** Cuántas obras vivas le pertenecen. */
  obras: number;
}

// ──────────────────────────────────────────────
// Obras
// ──────────────────────────────────────────────

export type EstadoObra = "EN_CURSO" | "TERMINADA" | "CANCELADA";

export const ETIQUETA_ESTADO_OBRA: Record<EstadoObra, string> = {
  EN_CURSO: "En curso",
  TERMINADA: "Terminada",
  CANCELADA: "Cancelada",
};

const fechaOpcional = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional();

export const obraSchema = z
  .object({
    nombre: z.string().trim().min(1, "Escribe el nombre de la obra").max(200),
    centroCostoId: z.string().min(1).nullable().optional(),
    estado: z.enum(["EN_CURSO", "TERMINADA", "CANCELADA"]),
    clienteId: z.string().min(1).nullable().optional(),
    propiedadId: z.string().min(1).nullable().optional(),
    /** Sin IVA. Vacío es "todavía no se sabe", que no es cero. */
    presupuesto: z.number().nonnegative().max(99_999_999).nullable().optional(),
    fechaInicio: fechaOpcional,
    fechaFin: fechaOpcional,
    notas: z.string().trim().max(5000).nullable().optional(),
  })
  .refine(
    (o) => !o.fechaInicio || !o.fechaFin || o.fechaFin >= o.fechaInicio,
    { message: "La fecha de fin no puede ser antes que la de inicio", path: ["fechaFin"] }
  )
  .refine((o) => !o.propiedadId || o.clienteId, {
    message: "Elige primero el cliente",
    path: ["propiedadId"],
  });
export type ObraBody = z.infer<typeof obraSchema>;

export interface ObraFila {
  id: string;
  numero: number;
  nombre: string;
  centroCosto: { id: string; nombre: string } | null;
  estado: EstadoObra;
  cliente: { id: string; nombre: string; apellido: string | null; empresa: string | null } | null;
  propiedad: { id: string; nombre: string } | null;
  presupuesto: number | null;
  fechaInicio: string | null;
  fechaFin: string | null;
}

export interface ObraDetalle extends ObraFila {
  notas: string | null;
  contificoCodigo: string | null;
  updatedAt: string;
  updatedByNombre: string | null;
}
