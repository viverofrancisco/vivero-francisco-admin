"use client";

import { useEffect, useState } from "react";
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
 * El texto de un buscador cuya lista arma el **servidor**.
 *
 * El problema que resuelve: entre que se manda `?q=Jor` y vuelve la lista pasa
 * medio segundo, y en ese rato la persona sigue escribiendo. Si el campo se
 * resincroniza con la URL cada vez que la URL cambia, al llegar el eco de
 * `Jor` se pierde el `ge` que se tecleó mientras tanto —el cursor salta, la
 * palabra queda cortada, y no se puede escribir de corrido—.
 *
 * La regla es distinguir el **eco** del cambio de afuera: se recuerda lo
 * último que este buscador pidió, y la URL solo se adopta cuando trae otra
 * cosa (volver atrás, "Limpiar filtros", un enlace con el filtro puesto).
 * Mientras tanto manda lo tecleado.
 *
 * `enviar` corre con un respiro de `esperaMs`: la lista la trae el servidor y
 * pedirla en cada tecla es una consulta por letra. El temporizador **no** se
 * reinicia cuando vuelve el eco, solo cuando se sigue escribiendo.
 */
export function useBusquedaEnUrl(
  enUrl: string,
  enviar: (valor: string) => void,
  esperaMs = 300
): [string, (valor: string) => void] {
  /**
   * Los tres en un solo estado —y no un `useRef` para `pedido`— porque la
   * decisión se toma **durante el render**, y un ref leído ahí es justamente
   * lo que React desaconseja: un render descartado lo dejaría escrito.
   */
  const [estado, setEstado] = useState({
    /** Lo que se ve en el campo. */
    escrito: enUrl,
    /** Lo último que este buscador mandó a la URL. */
    pedido: enUrl,
    /** La última URL que vimos, para saber cuándo cambió. */
    url: enUrl,
  });

  // Ajuste durante el render, que es como React recomienda seguir a una prop:
  // un efecto pintaría primero el valor viejo y lo corregiría después.
  if (estado.url !== enUrl) {
    setEstado((e) =>
      e.pedido === enUrl
        ? // El eco de lo que pedimos: se anota y no se toca lo tecleado.
          { ...e, url: enUrl }
        : // Vino de afuera —volver atrás, limpiar filtros, un enlace—: manda
          // la URL.
          { escrito: enUrl, pedido: enUrl, url: enUrl }
    );
  }

  useEffect(() => {
    if (estado.escrito === estado.pedido) return;
    const t = setTimeout(() => {
      setEstado((e) => ({ ...e, pedido: e.escrito }));
      enviar(estado.escrito);
    }, esperaMs);
    return () => clearTimeout(t);
    // `enviar` se arma de nuevo en cada render y no aporta como dependencia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.escrito, estado.pedido, esperaMs]);

  return [
    estado.escrito,
    (valor: string) => setEstado((e) => ({ ...e, escrito: valor })),
  ];
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
