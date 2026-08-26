"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CustomSelect } from "@/components/ui/custom-select";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface Props {
  clientes: Array<{ value: string; label: string }>;
  clienteId: string | null;
  from: string | null;
  to: string | null;
}

export function InformesFilters({ clientes, clienteId, from, to }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function update(patch: Record<string, string | null>) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(patch)) {
      if (value && value.length > 0) params.set(key, value);
      else params.delete(key);
    }
    // Any filter change resets pagination.
    params.delete("page");
    const qs = params.toString();
    startTransition(() => {
      router.push(`/dashboard/informes${qs ? `?${qs}` : ""}`);
    });
  }

  const hasFilters = !!(clienteId || from || to);

  return (
    /* Sin card: los filtros son controles de la lista, no una sección aparte.
       Con el card, la pantalla eran dos recuadros apilados y la tabla parecía
       lo secundario. */
    <div className="flex-none">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,180px)_minmax(0,180px)_auto] sm:items-end">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            Cliente
          </label>
          <CustomSelect
            value={clienteId ?? ""}
            onChange={(v) => update({ clienteId: v || null })}
            options={clientes}
            placeholder="Todos los clientes"
            searchable
            clearable
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            Generado desde
          </label>
          <DatePicker
            value={from ?? ""}
            onChange={(v) => update({ from: v || null })}
            placeholder="Desde"
            maxDate={to ?? undefined}
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            Generado hasta
          </label>
          <DatePicker
            value={to ?? ""}
            onChange={(v) => update({ to: v || null })}
            placeholder="Hasta"
            minDate={from ?? undefined}
          />
        </div>
        <div className="flex justify-end">
          {hasFilters ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                update({ clienteId: null, from: null, to: null })
              }
              disabled={isPending}
            >
              <X className="h-4 w-4 mr-1" /> Limpiar
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
