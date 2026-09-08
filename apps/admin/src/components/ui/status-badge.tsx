import { cn } from "@/lib/utils";
import type { EstadoVisita } from "@/generated/prisma/client";

/**
 * Visit-status semantics for the botanical design system.
 * Keyed by the real `EstadoVisita` enum, plus an optional `EN_CURSO` the UI
 * may use for in-progress visits even though it is not (yet) a DB state.
 */
export type EstadoVisitaUI = EstadoVisita | "EN_CURSO";

interface StatusMeta {
  label: string;
  /** badge container classes (bg + text) */
  badge: string;
  /** status dot color class */
  dot: string;
}

export const statusMeta: Record<EstadoVisitaUI, StatusMeta> = {
  PROGRAMADA: {
    label: "Programada",
    badge: "bg-success/12 text-green-700",
    dot: "bg-primary",
  },
  EN_CURSO: {
    label: "En curso",
    badge: "bg-info/12 text-info-foreground",
    dot: "bg-info",
  },
  COMPLETADA: {
    label: "Completada",
    badge: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
  INCOMPLETA: {
    label: "Incompleta",
    badge: "bg-warning/15 text-warning-foreground",
    dot: "bg-warning",
  },
  CANCELADA: {
    label: "Cancelada",
    badge: "bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
};

export function StatusBadge({
  estado,
  size = "md",
  className,
}: {
  estado: EstadoVisitaUI;
  size?: "sm" | "md";
  className?: string;
}) {
  const meta = statusMeta[estado] ?? statusMeta.COMPLETADA;
  return (
    // Sin el punto de color que llevaba adelante: el fondo del badge ya es de
    // ese mismo color, así que decía dos veces lo mismo y le comía ancho a la
    // etiqueta justo donde menos sobra, en una fila de móvil. `meta.dot` sigue
    // existiendo porque la bandeja de mensajes lo usa suelto, sobre el avatar,
    // donde sí es lo único que da el estado.
    <span
      className={cn(
        "inline-flex items-center rounded-full font-bold whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-[11.5px]",
        meta.badge,
        className
      )}
    >
      {meta.label}
    </span>
  );
}
