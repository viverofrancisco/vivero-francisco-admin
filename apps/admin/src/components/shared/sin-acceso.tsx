"use client";

// `buttonVariants` vive en un módulo de cliente, y llamarlo desde el servidor
// revienta: por eso esto es de cliente aunque no tenga estado.

import Link from "next/link";
import { Lock } from "lucide-react";
import { SIN_ACCESO_A, type TipoDeReferencia } from "@vivero/shared";
import { buttonVariants } from "@/components/ui/button";

/**
 * La ficha que quien mira no puede abrir: una visita que no le tocó, un
 * cliente o un producto para un jardinero. Dice qué es y por qué, en vez de
 * la ficha entera —que es lo que salía— o del error genérico de Next en
 * inglés. Las palabras son las de `SIN_ACCESO_A`, las mismas de la app.
 *
 * Es una pantalla y no un `redirect`: quien llega acá tocó una tarjeta del
 * chat o pegó un enlace, y mandarlo en silencio al inicio le dice que el
 * botón no anda.
 */
export function SinAcceso({ tipo, backHref }: { tipo: TipoDeReferencia; backHref: string }) {
  const { titulo, detalle } = SIN_ACCESO_A[tipo];
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 px-6 py-16 text-center">
      <Lock className="mb-2 h-8 w-8 text-muted-foreground" />
      <p className="text-base font-semibold">{titulo}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{detalle}</p>
      <Link href={backHref} className={buttonVariants({ variant: "outline", className: "mt-4" })}>
        Volver
      </Link>
    </div>
  );
}
