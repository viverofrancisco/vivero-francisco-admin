"use client";

import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type Valor = string | number | boolean | null;

/**
 * `""` inferido de un valor inicial es el tipo `""`, no `string`, y entonces
 * el setter no acepta nada más. Se ensancha al tipo de base.
 */
type Ancho<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T;

/**
 * Un filtro de lista que vive en la query string.
 *
 * Es un reemplazo directo de `useState` para filtros, búsquedas y número de
 * página. El motivo es volver atrás: entrar a un registro y apretar back
 * recrea la página desde cero —el estado de React no sobrevive a la
 * navegación— así que un filtro que solo vive en memoria se pierde y hay que
 * volver a tipearlo. En la URL sí sobrevive, porque la URL *es* lo que el
 * navegador recuerda.
 *
 * Se escribe con `history.replaceState` y no con `router.replace`: el filtrado
 * pasa en el cliente, así que no hay nada que pedirle al servidor, y `replace`
 * evita una entrada de historial por cada tecla escrita en un buscador.
 *
 * El valor por omisión no se escribe: una lista sin filtrar queda con la URL
 * limpia, como estaba antes de todo esto.
 */
export function useFiltroUrl<T extends Valor>(
  clave: string,
  inicial: T
): [Ancho<T>, (valor: Ancho<T>) => void] {
  const params = useSearchParams();
  const [valor, setValor] = useState<Ancho<T>>(() => {
    const crudo = params.get(clave);
    if (crudo === null) return inicial as Ancho<T>;
    if (typeof inicial === "boolean") return (crudo === "1") as Ancho<T>;
    if (typeof inicial === "number") {
      const n = Number(crudo);
      return (Number.isFinite(n) ? n : inicial) as Ancho<T>;
    }
    return crudo as Ancho<T>;
  });

  const aplicar = (proximo: Ancho<T>) => {
    setValor(proximo);
    // `window.location.search` y no `params`: si dos filtros se cambian en el
    // mismo tick, cada uno tiene que ver lo que escribió el anterior.
    const qs = new URLSearchParams(window.location.search);
    // Se omite solo lo que ya es el valor por omisión. Un filtro *borrado* sí
    // se escribe —vacío— porque borrarlo puede ser distinto del arranque: la
    // lista de suscripciones abre en ACTIVO, y "todas" es una elección.
    const nulo = (v: Valor) => v === null || v === "";
    const igual =
      (proximo as Valor) === (inicial as Valor) ||
      (nulo(proximo as Valor) && nulo(inicial as Valor));
    if (igual) qs.delete(clave);
    else if (nulo(proximo as Valor)) qs.set(clave, "");
    else qs.set(clave, typeof proximo === "boolean" ? "1" : String(proximo));
    const texto = qs.toString();
    window.history.replaceState(
      null,
      "",
      texto ? `${window.location.pathname}?${texto}` : window.location.pathname
    );
  };

  return [valor, aplicar];
}

/**
 * La URL de esta pantalla, filtros incluidos, lista para viajar como `?from=`.
 *
 * Un `from` fijo —"/dashboard/suscripciones"— devuelve la lista sin filtrar,
 * que es justo lo que guardar el filtro en la URL viene a evitar. Va
 * codificada: si no, el `&` del segundo filtro sería otro parámetro del
 * destino en vez de parte del `from`.
 *
 * Solo desde el navegador: usala en un `onClick`, nunca al construir un `href`
 * durante el render.
 */
export function aca(): string {
  if (typeof window === "undefined") return "";
  return encodeURIComponent(window.location.pathname + window.location.search);
}

/**
 * Lo mismo que `aca()`, pero para un `href` que se arma durante el render.
 *
 * `window` no existe cuando el componente se renderiza en el servidor, y un
 * `href` distinto en cada lado es un error de hidratación. Estos hooks sí
 * corren en los dos: Next parchea `history.replaceState`, así que también
 * reflejan los filtros escritos a mano.
 */
export function useAca(): string {
  const pathname = usePathname();
  const params = useSearchParams().toString();
  return encodeURIComponent(pathname + (params ? `?${params}` : ""));
}
