import { z } from "zod";

/** Un día del horario: abierto o no, y de qué hora a qué hora ("08:00"). */
export interface HorarioDeDia {
  abierto: boolean;
  desde: string;
  hasta: string;
}

/** Siete días, **de lunes a domingo**. */
export type HorarioSemanal = HorarioDeDia[];

export const DIAS_DE_LA_SEMANA = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
] as const;
const DIA_CORTO = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;

/** Con lo que arranca una ubicación nueva: lunes a viernes de 8 a 17, sábado medio día. */
export const HORARIO_POR_DEFECTO: HorarioSemanal = [
  ...Array.from({ length: 5 }, () => ({ abierto: true, desde: "08:00", hasta: "17:00" })),
  { abierto: true, desde: "08:00", hasta: "13:00" },
  { abierto: false, desde: "08:00", hasta: "13:00" },
];

/** "08:00" → "8:00". */
export function horaLegible(h: string): string {
  return h.replace(/^0(\d)/, "$1");
}
const hora = horaLegible;

/** Cada cuántos minutos se puede elegir: 5:15, 7:40… sin teclear. */
export const MINUTOS_DEL_HORARIO = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

/**
 * Las horas que se ofrecen para abrir y cerrar: **todo el día, cada 5
 * minutos** (0:00 a 23:55). Las mismas en el portal y en la app.
 */
export const HORAS_DEL_HORARIO: string[] = Array.from({ length: 24 * 12 }, (_, i) => {
  const m = i * 5;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
});

/**
 * El horario en una línea, juntando los días seguidos iguales: "Lun–Vie
 * 8:00–17:00 · Sáb 8:00–13:00 · Dom cerrado". `null` sin horario cargado.
 */
export function textoDelHorario(h: HorarioSemanal | null | undefined): string | null {
  if (!h || h.length !== 7) return null;
  const clave = (d: HorarioDeDia) => (d.abierto ? `${d.desde}-${d.hasta}` : "cerrado");
  const tramos: string[] = [];
  let i = 0;
  while (i < 7) {
    let j = i;
    while (j + 1 < 7 && clave(h[j + 1]) === clave(h[i])) j++;
    const dias = i === j ? DIA_CORTO[i] : `${DIA_CORTO[i]}–${DIA_CORTO[j]}`;
    tramos.push(h[i].abierto ? `${dias} ${hora(h[i].desde)}–${hora(h[i].hasta)}` : `${dias} cerrado`);
    i = j + 1;
  }
  return tramos.join(" · ");
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const horarioDeDiaSchema = z
  .object({
    abierto: z.boolean(),
    desde: z.string().regex(HHMM, "Hora no válida"),
    hasta: z.string().regex(HHMM, "Hora no válida"),
  })
  .refine((d) => !d.abierto || d.desde < d.hasta, {
    message: "La hora de cierre tiene que ser después de la de apertura",
  });
export const horarioSemanalSchema = z.array(horarioDeDiaSchema).length(7);

/**
 * Una ubicación del vivero (*Configuración → Ubicaciones*), como las
 * *Locations* de Shopify: el nombre, la dirección con su pin, el teléfono y el
 * horario, y si el cliente puede **retirar** ahí un pedido de la app.
 */
export interface Ubicacion {
  id: string;
  nombre: string;
  direccion: string | null;
  ciudad: string | null;
  referencia: string | null;
  lat: number | null;
  lng: number | null;
  telefono: string | null;
  /** De lunes a domingo; `null` sin cargar. */
  horarios: HorarioSemanal | null;
  /** El cliente puede elegirla para retirar. */
  retiro: boolean;
  /** Apagada no se ofrece en ningún lado. */
  activa: boolean;
  /** Cuántos pedidos la citan: con alguno no se borra, se desactiva. */
  pedidos: number;
}

/** Lo que ve el cliente al elegir dónde retirar. */
export type UbicacionDeRetiro = Pick<
  Ubicacion,
  "id" | "nombre" | "direccion" | "ciudad" | "referencia" | "lat" | "lng" | "telefono" | "horarios"
>;

const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));

export const ubicacionSchema = z.object({
  nombre: z.string({ error: "Ponle un nombre" }).trim().min(1, "Ponle un nombre").max(120),
  direccion: opcional(300),
  ciudad: opcional(120),
  referencia: opcional(300),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  telefono: opcional(40),
  horarios: horarioSemanalSchema.nullable().optional(),
  retiro: z.boolean().optional(),
  activa: z.boolean().optional(),
});
export type UbicacionBody = z.input<typeof ubicacionSchema>;

/** "Isla Mocolí, Villa 12, Samborondón": la dirección en una línea. */
export function direccionDeUbicacion(u: Pick<Ubicacion, "direccion" | "ciudad">): string | null {
  return [u.direccion, u.ciudad].filter(Boolean).join(", ") || null;
}
