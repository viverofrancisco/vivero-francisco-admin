import { create } from "zustand";

export interface InformesFilterCliente {
  id: string;
  nombre: string;
}

interface InformesFiltersState {
  cliente: InformesFilterCliente | null;
  from: string | null; // YYYY-MM-DD
  to: string | null;

  setCliente: (c: InformesFilterCliente | null) => void;
  setFrom: (v: string | null) => void;
  setTo: (v: string | null) => void;
  clear: () => void;
  activeCount: () => number;
}

export const useInformesFilters = create<InformesFiltersState>((set, get) => ({
  cliente: null,
  from: null,
  to: null,

  setCliente: (c) => set({ cliente: c }),
  setFrom: (v) => set({ from: v }),
  setTo: (v) => set({ to: v }),
  clear: () => set({ cliente: null, from: null, to: null }),
  activeCount: () => {
    const s = get();
    return [s.cliente, s.from, s.to].filter(Boolean).length;
  },
}));
