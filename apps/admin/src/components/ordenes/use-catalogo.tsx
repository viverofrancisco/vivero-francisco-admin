"use client";

import {
  useListaPaginada,
  POR_TANDA,
} from "@/components/shared/use-lista-paginada";

interface ProductoBase {
  id: string;
  nombre: string;
}

/**
 * El catálogo vendible de una orden, de a tandas.
 *
 * La primera tanda llega con la página y el resto se pide al escribir o al
 * bajar la lista. Antes venía el catálogo entero con las variantes de cada
 * producto: con veinte no se nota, pero se paga al abrir aunque la orden
 * termine con dos líneas.
 */
export function useCatalogo<T extends ProductoBase>(
  iniciales: T[],
  hayMasInicial: boolean
) {
  return useListaPaginada<T>({
    iniciales,
    hayMasInicial,
    yaTraidaLaPrimera: true,
    pedir: async (q, offset) => {
      const r = await fetch(
        `/api/productos/vendibles?q=${encodeURIComponent(q)}&offset=${offset}&limit=${POR_TANDA}`
      );
      const d = (await r.json()) as { productos?: T[]; hayMas?: boolean };
      return { items: d.productos ?? [], hayMas: Boolean(d.hayMas) };
    },
  });
}
