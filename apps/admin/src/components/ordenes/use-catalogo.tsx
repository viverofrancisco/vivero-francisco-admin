"use client";

import { useEffect, useState } from "react";

/** De a cuántos se pide. El mismo criterio que el resto: pocos viajes. */
const POR_TANDA = 20;

interface ProductoBase {
  id: string;
  nombre: string;
}

/**
 * El catálogo de una orden, pedido de a tandas.
 *
 * Antes la pantalla recibía el catálogo entero con todas las variantes de cada
 * producto. Con veinte no se nota; con quinientos se paga al abrir, aunque la
 * orden termine con dos líneas.
 *
 * **Lo visto no se descarta.** El editor resuelve el precio, el IVA y las
 * variantes de cada línea buscando su producto en esta lista, así que si al
 * buscar otra cosa se fueran los anteriores, una línea ya cargada se quedaría
 * sin los suyos. `conocidos` acumula todo lo que pasó por acá; `pagina` es solo
 * lo que el desplegable muestra ahora.
 */
export function useCatalogo<T extends ProductoBase>(
  iniciales: T[],
  hayMasInicial: boolean
) {
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
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [aplicada, setAplicada] = useState("");
  const [pedida, setPedida] = useState("");

  // La búsqueda espera a que la mano pare: un pedido por tecla es el
  // desperdicio que la paginación vino a evitar.
  useEffect(() => {
    const t = setTimeout(() => setAplicada(busqueda), 300);
    return () => clearTimeout(t);
  }, [busqueda]);

  // Al renderizar con una búsqueda nueva: se limpia lo que hay y se marca que
  // está cargando. Lo que pide es el efecto de abajo.
  if (pedida !== aplicada) {
    setPedida(aplicada);
    setCargando(true);
  }

  const sumarConocidos = (nuevos: T[]) =>
    setConocidos((prev) => {
      const ya = new Set(prev.map((p) => p.id));
      return [...prev, ...nuevos.filter((p) => !ya.has(p.id))];
    });

  const pedir = (q: string, offset: number) =>
    fetch(
      `/api/productos/vendibles?q=${encodeURIComponent(q)}&offset=${offset}&limit=${POR_TANDA}`
    ).then((r) => r.json() as Promise<{ productos?: T[]; hayMas?: boolean }>);

  useEffect(() => {
    // La primera tanda sin filtro ya vino del servidor con la página: pedirla
    // de nuevo al abrir sería un viaje para traer lo mismo.
    // Solo pasa al montar, y ahí `cargando` ya es false: el bloque de arriba
    // que lo prende corre únicamente cuando la búsqueda cambia.
    if (pedida === "" && pagina.q === "" && pagina.items === iniciales) return;
    let vivo = true;
    pedir(pedida, 0)
      .then((d) => {
        if (!vivo) return;
        const nuevos = d.productos ?? [];
        setPagina({ q: pedida, items: nuevos });
        sumarConocidos(nuevos);
        setHayMas(Boolean(d.hayMas));
      })
      .catch(() => {})
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
    // `iniciales` y `pagina` solo se leen para saltear el primer pedido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedida]);

  return {
    /** Lo que muestra el desplegable ahora. */
    pagina: pagina.items,
    /** Todo lo que se vio: de acá salen el precio y las variantes de una línea. */
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
          const nuevos = d.productos ?? [];
          // Solo si la búsqueda sigue siendo la misma: si cambió, estas filas
          // son de otra lista.
          setPagina((prev) =>
            prev.q === q ? { q, items: [...prev.items, ...nuevos] } : prev
          );
          sumarConocidos(nuevos);
          setHayMas(Boolean(d.hayMas));
        })
        .catch(() => {})
        .finally(() => setCargando(false));
    },
  };
}
