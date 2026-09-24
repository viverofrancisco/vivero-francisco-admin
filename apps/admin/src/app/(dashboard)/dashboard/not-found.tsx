"use client";

// De cliente por `buttonVariants`, que no se puede llamar desde el servidor.

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Lo que `notFound()` muestra dentro del panel: una visita borrada, un enlace
 * mal copiado. Sin esto salía la página de Next, en inglés y sin el menú.
 */
export default function NoEncontrada() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 px-6 py-16 text-center">
      <p className="text-base font-semibold">No encontramos esta página</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Puede que lo que buscas se haya borrado, o que el enlace esté mal.
      </p>
      <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline" }), "mt-4")}>
        Ir al inicio
      </Link>
    </div>
  );
}
