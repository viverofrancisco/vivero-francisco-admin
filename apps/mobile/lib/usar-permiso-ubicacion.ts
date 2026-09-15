import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import {
  avisarFaltaUbicacion,
  pedirPermisoDeUbicacion,
  permisoDeUbicacion,
} from "@/lib/ubicacion";

/**
 * Pide la ubicación **al abrir la app**, no recién al marcar.
 *
 * Marcar la entrada es lo primero que se hace al llegar a un jardín, muchas
 * veces con el teléfono en una mano y la herramienta en la otra. Descubrir ahí
 * que falta el permiso —y que hay que salir a Ajustes y volver— es descubrirlo
 * en el peor momento. Preguntarlo al abrir mueve ese trámite a cuando todavía
 * no molesta.
 *
 * Tres cuidados para que preguntar seguido no se vuelva acoso:
 *
 * - **Concedido no pregunta nada.** Es el caso de todos los días.
 * - **Mientras el sistema acepte preguntar**, el que aparece es *su* diálogo, no
 *   el nuestro. iOS lo muestra una sola vez; después `canAskAgain` queda en
 *   falso y esto deja de intentarlo solo.
 * - **Nuestro cartel sale una vez por sesión.** Volver de Ajustes sin haberlo
 *   activado dispara otra revisión, y sin esto saldría el mismo cartel de
 *   nuevo, encima del que se acaba de cerrar.
 *
 * Se revisa al montar y cada vez que la app vuelve al frente, que es
 * exactamente cuando el permiso pudo haber cambiado: se cambia en Ajustes, o
 * sea afuera de la app.
 */
export function usarPermisoDeUbicacion(activo: boolean) {
  const yaAvisamos = useRef(false);

  const revisar = useCallback(async () => {
    if (!activo) return;

    const estado = await permisoDeUbicacion();
    if (estado.concedido) {
      // Si más adelante lo revocan, esto vuelve a avisar.
      yaAvisamos.current = false;
      return;
    }

    if (estado.puedePreguntar) {
      if (await pedirPermisoDeUbicacion()) {
        yaAvisamos.current = false;
        return;
      }
    }

    if (yaAvisamos.current) return;
    yaAvisamos.current = true;
    // General a propósito: acá todavía no se está haciendo nada. Detallar para
    // qué sirve, al abrir la app, es contestar una pregunta que nadie hizo; el
    // motivo concreto se dice en el momento de marcar, que es cuando importa.
    avisarFaltaUbicacion(
      "La app usa tu ubicación para algunas de sus funciones.",
      true
    );
  }, [activo]);

  useEffect(() => {
    revisar();
    const sub = AppState.addEventListener("change", (estado) => {
      if (estado === "active") revisar();
    });
    return () => sub.remove();
  }, [revisar]);
}
