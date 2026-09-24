"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonVariants } from "@/components/ui/button";

/**
 * Un error sin atrapar dentro del panel. Sin esto salía "Application error"
 * de Next, en inglés y sin decir qué hacer. El detalle queda en la consola,
 * que es donde sirve.
 */
export default function ErrorDelPanel({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 px-6 py-16 text-center">
      <p className="text-base font-semibold">Algo salió mal</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        No pudimos mostrar esta página. Prueba de nuevo y, si sigue igual, avísanos.
      </p>
      <div className="mt-4 flex gap-2">
        <Button variant="outline" onClick={reset}>
          Reintentar
        </Button>
        <Link href="/dashboard" className={buttonVariants({ variant: "ghost" })}>
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
