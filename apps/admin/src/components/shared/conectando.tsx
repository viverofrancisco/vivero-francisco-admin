"use client";

import { useSyncExternalStore } from "react";
import { Loader2 } from "lucide-react";

function suscribir(f: () => void) {
  window.addEventListener("online", f);
  window.addEventListener("offline", f);
  return () => {
    window.removeEventListener("online", f);
    window.removeEventListener("offline", f);
  };
}

/**
 * El "Conectando…" de WhatsApp: una línea arriba del contenido mientras el
 * navegador dice que no hay red, y nada cuando sí. Es la misma línea que la
 * app; aquí la decide `navigator.onLine`, que en el teléfono es lo que dice
 * el modo avión.
 */
export function Conectando() {
  const enLinea = useSyncExternalStore(
    suscribir,
    () => navigator.onLine,
    () => true
  );
  if (enLinea) return null;
  return (
    <div
      className="flex items-center justify-center gap-2 bg-muted py-1.5 text-xs font-semibold text-muted-foreground"
      aria-live="polite"
    >
      <Loader2 className="h-3 w-3 animate-spin" />
      Conectando…
    </div>
  );
}
