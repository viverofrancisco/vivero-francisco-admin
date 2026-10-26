import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * La última respuesta de cada pantalla, para pintarla **antes** de que
 * conteste el servidor: abrir Pedidos, un cliente o un informe mostraba un
 * spinner un segundo o dos aunque la lista fuera la misma de hace un rato.
 * Ahora se ve lo de la última vez al instante y el servidor lo reemplaza
 * cuando contesta. Es el criterio de la copia de los chats y de las visitas
 * (`cache-de-chats.ts`, `cache-de-visitas.ts`): un snapshot para no mirar un
 * spinner, nunca la verdad — lo que se toca siempre viene del servidor.
 *
 * Dos capas: un `Map` en memoria, que se lee **sincrónico** en el primer
 * render (volver a una pantalla ya vista no dibuja ni un cuadro vacío), y el
 * disco, que sobrevive a cerrar la app y se lee al abrir la pantalla.
 *
 * **No pesa**: es JSON —la primera página de una lista, una ficha—, nunca
 * fotos. Se guardan hasta `COPIAS_MAX` respuestas, las más recientes, y una
 * más grande que `TAMANO_MAX` no se guarda. Son de una cuenta: el prefijo está
 * en `datos-de-la-cuenta.ts`, que las borra al entrar con otra.
 */

const PREFIJO = "pantallas:cache:";
const CLAVE_INDICE = `${PREFIJO}indice`;
const COPIAS_MAX = 150;
/** En caracteres de JSON: ~400 KB. Una lista que pasa de eso no es "la primera página". */
const TAMANO_MAX = 400_000;

const enMemoria = new Map<string, unknown>();
/** Clave → cuándo se guardó, para podar las más viejas. */
let indice: Record<string, number> | null = null;

/** Al cambiar de cuenta: lo que hay en memoria es de la anterior. */
export function olvidarCopiasEnMemoria() {
  enMemoria.clear();
  indice = null;
}

async function leerIndice(): Promise<Record<string, number>> {
  if (indice) return indice;
  try {
    const crudo = await AsyncStorage.getItem(CLAVE_INDICE);
    indice = crudo ? (JSON.parse(crudo) as Record<string, number>) : {};
  } catch {
    indice = {};
  }
  return indice;
}

export async function leerCopia<T>(clave: string): Promise<T | null> {
  if (enMemoria.has(clave)) return enMemoria.get(clave) as T;
  try {
    const crudo = await AsyncStorage.getItem(PREFIJO + clave);
    if (!crudo) return null;
    const datos = JSON.parse(crudo) as T;
    enMemoria.set(clave, datos);
    return datos;
  } catch {
    return null;
  }
}

/** Escribir es fuego y olvido: si el disco falla, la próxima vez hay spinner, nada más. */
let escribiendo: Promise<void> = Promise.resolve();

export function guardarCopia<T>(clave: string, datos: T) {
  enMemoria.set(clave, datos);
  escribiendo = escribiendo.then(async () => {
    try {
      const json = JSON.stringify(datos);
      if (json.length > TAMANO_MAX) return;
      const i = await leerIndice();
      i[clave] = Date.now();
      const claves = Object.keys(i);
      const fuera =
        claves.length > COPIAS_MAX
          ? claves.sort((a, b) => i[a] - i[b]).slice(0, claves.length - COPIAS_MAX)
          : [];
      fuera.forEach((c) => {
        delete i[c];
        enMemoria.delete(c);
      });
      await AsyncStorage.setItem(PREFIJO + clave, json);
      if (fuera.length > 0) await AsyncStorage.multiRemove(fuera.map((c) => PREFIJO + c));
      await AsyncStorage.setItem(CLAVE_INDICE, JSON.stringify(i));
    } catch {
      // Sin copia no pasa nada.
    }
  });
}

/** Al borrar algo (un cliente, un pedido anulado y archivado): que no reaparezca de la copia. */
export function olvidarCopia(clave: string) {
  enMemoria.delete(clave);
  escribiendo = escribiendo.then(async () => {
    try {
      const i = await leerIndice();
      delete i[clave];
      await AsyncStorage.removeItem(PREFIJO + clave);
      await AsyncStorage.setItem(CLAVE_INDICE, JSON.stringify(i));
    } catch {
      // Igual.
    }
  });
}

/**
 * Lo que usa cada pantalla.
 *
 * - `inicial`: la copia en memoria, ya en el primer render, para los
 *   `useState(() => …)` de la pantalla (y `cargando` en `false` si hay).
 * - `alLeerDelDisco`: si no estaba en memoria, se lee del disco y se le pasa a
 *   esta función —una sola vez, y solo si el servidor no contestó antes—.
 * - `alResponder(datos, guardar)`: se llama con cada respuesta del servidor;
 *   `guardar` en `false` para lo que no es la vista por defecto (una búsqueda,
 *   un filtro, la página 2), que no se guarda pero sí cuenta como respuesta.
 *
 * `clave` en `null` no hace nada (un id que todavía no llegó).
 */
export function useCopiaDePantalla<T>(
  clave: string | null,
  alLeerDelDisco: (datos: T) => void
) {
  const [inicial] = useState(() =>
    clave && enMemoria.has(clave) ? (enMemoria.get(clave) as T) : undefined
  );
  const contesto = useRef(false);
  const aplicar = useRef(alLeerDelDisco);
  aplicar.current = alLeerDelDisco;

  useEffect(() => {
    if (!clave || inicial !== undefined) return;
    let vivo = true;
    void leerCopia<T>(clave).then((d) => {
      if (vivo && d != null && !contesto.current) aplicar.current(d);
    });
    return () => {
      vivo = false;
    };
  }, [clave, inicial]);

  const alResponder = useCallback(
    (datos: T, guardar = true) => {
      contesto.current = true;
      if (clave && guardar) guardarCopia(clave, datos);
    },
    [clave]
  );

  return { inicial, alResponder };
}

/**
 * Para lo que un formulario o un selector pide al abrirse —la lista de
 * clientes del asistente, el catálogo de tareas, los grupos—: aplica la copia
 * en cuanto la hay y después la respuesta del servidor, que se guarda para la
 * próxima vez. Una copia que llega después del servidor se descarta. Devuelve
 * la promesa del servidor, así quien ya encadenaba `.catch` / `.finally` sigue
 * igual. `aplicar` tiene que poder correr dos veces (copia y respuesta).
 */
export function conCopia<T>(
  clave: string,
  pedir: () => Promise<T>,
  aplicar: (datos: T) => void
): Promise<T> {
  let llego = false;
  void leerCopia<T>(clave).then((d) => {
    if (d != null && !llego) aplicar(d);
  });
  return pedir().then((d) => {
    llego = true;
    guardarCopia(clave, d);
    aplicar(d);
    return d;
  });
}
