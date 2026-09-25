"use client";

import { useSyncExternalStore } from "react";

const MOVIL = "(max-width: 767px)";

/**
 * Debajo de `md`, el mismo corte que decide tabla o lista.
 *
 * Es para lo que **no** se puede resolver con clases: un diálogo que en el
 * teléfono es una hoja desde abajo tiene que montar un componente u otro, y
 * `md:hidden` montaría los dos. Con `useSyncExternalStore` el servidor dice
 * "escritorio" y el navegador se corrige al hidratar, sin un `useEffect` que
 * pinte dos veces.
 */
export function useEsMovil() {
  return useMediaQuery(MOVIL);
}

/** Desde `xl`: donde el asistente de informes tiene sitio para el panel de al lado. */
export function useEsAncho() {
  return useMediaQuery("(min-width: 1280px)");
}

/** Si la ventana cumple la consulta. En el servidor, no. */
export function useMediaQuery(consulta: string) {
  return useSyncExternalStore(
    (avisar) => {
      const mq = window.matchMedia(consulta);
      mq.addEventListener("change", avisar);
      return () => mq.removeEventListener("change", avisar);
    },
    () => window.matchMedia(consulta).matches,
    () => false
  );
}
