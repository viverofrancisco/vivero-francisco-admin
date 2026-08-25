import { unidadDePeriodo } from "@/lib/periodos";

/** Etiquetas y formato compartidos por las pantallas de suscripciones. */
export const PERIODICIDAD_LABEL: Record<string, string> = {
  MENSUAL: "Mensual",
  TRIMESTRAL: "Trimestral",
  SEMESTRAL: "Semestral",
  ANUAL: "Anual",
};

/** Sufijo de precio y de visitas incluidas: "/trimestre". */
export const PERIODICIDAD_SUFIJO: Record<string, string> = Object.fromEntries(
  Object.keys(PERIODICIDAD_LABEL).map((p) => [p, `/${unidadDePeriodo(p)}`])
);

export const money = (n: number | string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(n)
  );

export const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

export const estadoVariant: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  ACTIVO: "default",
  PAUSADO: "secondary",
  CANCELADO: "outline",
};
