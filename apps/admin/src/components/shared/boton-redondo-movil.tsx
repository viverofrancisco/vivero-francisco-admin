"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * El botón redondo de las cabeceras en el teléfono: la flecha de volver y el
 * ⋯ de una ficha, el ⋯ de una lista. Es el de Shopify y el de la app
 * (`BotonRedondoDeHoja`): 36 px, gris, sin borde, el ícono en 18. La flecha
 * era un chevron suelto y el ⋯ un cuadrado con borde, y no se leían como
 * pareja ni quedaban centrados con el nombre.
 */
export const BOTON_REDONDO_MOVIL =
  "flex h-9 w-9 flex-none items-center justify-center rounded-full bg-secondary text-foreground active:bg-muted disabled:opacity-60";

export const ICONO_BOTON_REDONDO = "h-[18px] w-[18px]";

/** La flecha de volver como enlace, con el `?from=` que la lista le dejó. */
export function VolverRedondo({
  href,
  className,
}: {
  href: string;
  className?: string;
}) {
  return (
    <Link href={href} aria-label="Volver" className={cn(BOTON_REDONDO_MOVIL, className)}>
      <ChevronLeft className={ICONO_BOTON_REDONDO} />
    </Link>
  );
}

/** La misma flecha cuando volver es cerrar algo, no navegar. */
export function VolverRedondoBoton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label="Volver"
      onClick={onClick}
      className={cn(BOTON_REDONDO_MOVIL, className)}
    >
      <ChevronLeft className={ICONO_BOTON_REDONDO} />
    </button>
  );
}
