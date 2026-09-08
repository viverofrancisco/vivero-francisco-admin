"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useBusquedaEnUrl } from "@/lib/filtros-url";
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
  const [, startTransition] = useTransition();
  const enUrl = q ?? "";

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
    //
    // Y dentro de una transición: sin eso, cada tecleada desmonta la tabla y
    // pone el esqueleto de `loading.tsx`, que es el parpadeo que hacía parecer
    // que la pantalla se recargaba sola. Así la lista de antes se queda hasta
    // que llega la nueva.
    startTransition(() => {
      router.replace(`/dashboard/informes${qs ? `?${qs}` : ""}`);
    });
  }

  // Lo tecleado manda mientras se escribe; la URL solo cuando cambia por fuera.
  // Ver `useBusquedaEnUrl`: sincronizarse con cada eco se comía las letras
  // escritas mientras la consulta viajaba.
  const [texto, setTexto] = useBusquedaEnUrl(enUrl, (v) =>
    update({ q: v || null })
  );

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
            placeholder="Buscar..."
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
