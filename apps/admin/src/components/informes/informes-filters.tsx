"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CustomSelect } from "@/components/ui/custom-select";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarraFiltros } from "@/components/shared/barra-filtros";
import { Search } from "lucide-react";

interface Props {
  q: string | null;
  from: string | null;
  to: string | null;
  estado: string | null;
}

const ESTADOS = [
  { value: "", label: "Todos" },
  { value: "emitido", label: "Emitidos" },
  { value: "borrador", label: "Borradores" },
];

export function InformesFilters({ q, from, to, estado }: Props) {
  const router = useRouter();
  // Igual que en visitas: el estado recuerda con qué valor de la URL se
  // tecleó, así el campo sigue a la URL cuando cambia por fuera sin un efecto
  // que lo reescriba.
  const enUrl = q ?? "";
  const [busqueda, setBusqueda] = useState({ valor: enUrl, deUrl: enUrl });
  const texto = busqueda.deUrl === enUrl ? busqueda.valor : enUrl;
  const setTexto = (v: string) => setBusqueda({ valor: v, deUrl: enUrl });

  function update(patch: Record<string, string | null>) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(patch)) {
      if (value && value.length > 0) params.set(key, value);
      else params.delete(key);
    }
    // Cualquier filtro que cambie vuelve a la primera página.
    params.delete("page");
    const qs = params.toString();
    // `replace` y no `push`: esta lista la arma el servidor, así que cada
    // tecleada dejaría una entrada en el historial y volver atrás sería
    // deshacer letra por letra en vez de salir del listado.
    router.replace(`/dashboard/informes${qs ? `?${qs}` : ""}`);
  }

  // El buscador con un respiro: la lista la trae el servidor, y pedirla en
  // cada tecla es una consulta por letra.
  useEffect(() => {
    if (texto === enUrl) return;
    const t = setTimeout(() => update({ q: texto || null }), 300);
    return () => clearTimeout(t);
    // `update` se rearma en cada render y no aporta nada como dependencia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto, enUrl]);

  const activos = [from, to, estado].filter(Boolean).length;

  return (
    /* Sin card: los filtros son controles de la lista, no una sección aparte. */
    <BarraFiltros
      escritorio="popover"
      activos={activos}
      onLimpiar={() => update({ from: null, to: null, estado: null })}
      busqueda={
        /* Reemplaza al desplegable de clientes: escribir el nombre es más
           corto que encontrarlo en una lista de doscientos, y de paso también
           busca por el título del informe. */
        <div className="relative min-w-0 flex-1 md:min-w-[220px] md:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente o título..."
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="pl-9"
          />
        </div>
      }
    >
      <div className="space-y-1">
        <Label className="text-xs">Estado</Label>
        <CustomSelect
          value={estado ?? ""}
          onChange={(v) => update({ estado: v || null })}
          options={ESTADOS}
          placeholder="Todos"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Generado desde</Label>
        <DatePicker
          value={from ?? ""}
          onChange={(v) => update({ from: v || null })}
          placeholder="Desde"
          maxDate={to ?? undefined}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Generado hasta</Label>
        <DatePicker
          value={to ?? ""}
          onChange={(v) => update({ to: v || null })}
          placeholder="Hasta"
          minDate={from ?? undefined}
        />
      </div>
    </BarraFiltros>
  );
}
