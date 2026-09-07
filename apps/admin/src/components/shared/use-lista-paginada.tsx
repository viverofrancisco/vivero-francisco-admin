"use client";

import { useEffect, useState } from "react";

/** De a cuántos se pide. Pocos viajes: uno cuesta lo mismo por 10 que por 100. */
export const POR_TANDA = 20;

interface ConId {
  id: string;
}

/**
 * Una lista que se busca y se pagina **en el servidor**.
 *
 * Es para los selectores cuyo catálogo no entra entero en el navegador: llega
 * la primera tanda y el resto se pide al escribir o al bajar la lista.
 *
 * **Lo visto no se descarta.** Quien la usa suele resolver datos de una fila ya
 * elegida buscándola en la lista —su precio, su IVA, sus variantes— así que si
 * al buscar otra cosa se fueran las anteriores, esa fila se quedaría sin los
 * suyos. `conocidos` acumula todo lo que pasó por acá; `pagina` es solo lo que
 * el desplegable muestra ahora.
 */
export function useListaPaginada<T extends ConId>({
  iniciales,
  hayMasInicial,
  pedir,
  yaTraidaLaPrimera = false,
}: {
  iniciales: T[];
  hayMasInicial: boolean;
  pedir: (q: string, offset: number) => Promise<{ items: T[]; hayMas: boolean }>;
  /**
   * La primera tanda ya vino con la página (renderizada en el servidor), así
   * que al montar no hay que pedirla de nuevo.
   */
  yaTraidaLaPrimera?: boolean;
}) {
  /**
   * La página **con la búsqueda que la trajo**.
   *
   * Van juntas porque una respuesta puede llegar tarde: si mientras volaba se
   * buscó otra cosa, sus filas se descartan en vez de mezclarse con las de la
   * búsqueda nueva.
   */
  const [pagina, setPagina] = useState<{ q: string; items: T[] }>({
    q: "",
    items: iniciales,
  });
  const [conocidos, setConocidos] = useState<T[]>(iniciales);
  const [hayMas, setHayMas] = useState(hayMasInicial);
  const [cargando, setCargando] = useState(!yaTraidaLaPrimera);
  const [busqueda, setBusqueda] = useState("");
  const [aplicada, setAplicada] = useState("");
  const [pedida, setPedida] = useState("");

  // La búsqueda espera a que la mano pare: un pedido por tecla es el
  // desperdicio que la paginación vino a evitar.
  useEffect(() => {
    const t = setTimeout(() => setAplicada(busqueda), 300);
    return () => clearTimeout(t);
  }, [busqueda]);

  // Al renderizar con una búsqueda nueva: se marca que está cargando. Lo que
  // pide es el efecto de abajo.
  if (pedida !== aplicada) {
    setPedida(aplicada);
    setCargando(true);
  }

  const sumarConocidos = (nuevos: T[]) =>
    setConocidos((prev) => {
      const ya = new Set(prev.map((p) => p.id));
      return [...prev, ...nuevos.filter((p) => !ya.has(p.id))];
    });

  useEffect(() => {
    // Al montar, si la página ya la trajo el servidor, no se pide de nuevo.
    // Se reconoce porque lo que se está mostrando **es** la lista inicial: en
    // cuanto alguien busca algo, `pagina.items` pasa a ser otro arreglo. Y en
    // ese caso `cargando` ya es false, así que no hay nada que apagar.
    if (yaTraidaLaPrimera && pedida === "" && pagina.items === iniciales) return;
    let vivo = true;
    pedir(pedida, 0)
      .then((d) => {
        if (!vivo) return;
        setPagina({ q: pedida, items: d.items });
        sumarConocidos(d.items);
        setHayMas(d.hayMas);
      })
      .catch(() => {})
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
    // `pedir` se rearma en cada render de quien la usa; lo que dispara un
    // pedido nuevo es la búsqueda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedida]);

  return {
    /** Lo que muestra el desplegable ahora. */
    pagina: pagina.items,
    /** Todo lo que se vio: de acá salen los datos de una fila ya elegida. */
    conocidos,
    hayMas,
    cargando,
    busqueda,
    onBuscar: setBusqueda,
    onMas: () => {
      if (!hayMas || cargando) return;
      const q = pagina.q;
      setCargando(true);
      pedir(q, pagina.items.length)
        .then((d) => {
          // Solo si la búsqueda sigue siendo la misma: si cambió, estas filas
          // son de otra lista.
          setPagina((prev) =>
            prev.q === q ? { q, items: [...prev.items, ...d.items] } : prev
          );
          sumarConocidos(d.items);
          setHayMas(d.hayMas);
        })
        .catch(() => {})
        .finally(() => setCargando(false));
    },
  };
}
