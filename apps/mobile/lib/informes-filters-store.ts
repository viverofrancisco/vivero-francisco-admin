import { create } from "zustand";

/**
 * Los filtros de la lista de informes, fuera de la pantalla.
 *
 * Viven en un store y no en el estado de la lista porque se eligen en **otra**
 * pantalla —el rango de fechas necesita un calendario, que no entra en una
 * hoja de pastillas— y al volver la lista tiene que encontrarlos puestos.
 *
 * Tenía además un filtro por cliente, con su propia pantalla de búsqueda.
 * Se fue cuando la lista ganó su buscador: escribir el nombre arriba hace lo
 * mismo en un gesto, y dos formas de filtrar por cliente son dos que se
 * contradicen —una puesta y la otra no— sin que se vea cuál manda.
 */
interface InformesFiltersState {
  from: string | null; // YYYY-MM-DD
  to: string | null;

  setFrom: (v: string | null) => void;
  setTo: (v: string | null) => void;
  clear: () => void;
  activeCount: () => number;
}

export const useInformesFilters = create<InformesFiltersState>((set, get) => ({
  from: null,
  to: null,

  setFrom: (v) => set({ from: v }),
  setTo: (v) => set({ to: v }),
  clear: () => set({ from: null, to: null }),
  activeCount: () => {
    const s = get();
    return [s.from, s.to].filter(Boolean).length;
  },
}));
