"use client";

import Link from "next/link";
import { ChevronRight, MapPin } from "lucide-react";
import { direccionDeUbicacion, type Ubicacion } from "@vivero/shared";
import { PageHeader } from "@/components/shared/page-header";
import { useAca, useFiltroUrl } from "@/lib/filtros-url";
import { cn } from "@/lib/utils";

const FILTROS = [
  { valor: "todas", etiqueta: "Todas" },
  { valor: "activas", etiqueta: "Activas" },
  { valor: "inactivas", etiqueta: "Inactivas" },
] as const;

/**
 * Las ubicaciones del vivero, las *Locations* de Shopify: cada local con su
 * dirección en una línea, si está activa y si el cliente puede retirar ahí.
 * Son pocas, así que se filtran en el navegador; el filtro vive en la URL
 * como el de toda lista.
 */
export function UbicacionesLista({ ubicaciones }: { ubicaciones: Ubicacion[] }) {
  const [estado, setEstado] = useFiltroUrl("estado", "todas");
  const from = useAca();
  const filas = ubicaciones.filter((u) =>
    estado === "activas" ? u.activa : estado === "inactivas" ? !u.activa : true
  );
  const activas = ubicaciones.filter((u) => u.activa).length;

  return (
    <div className="flex h-full flex-col gap-4 p-3 md:p-6">
      <PageHeader
        title="Ubicaciones"
        actions={[
          {
            label: "Ubicación",
            href: "/dashboard/configuracion/ubicaciones/nueva",
            icon: "plus",
            primary: true,
          },
        ]}
      />
      <p className="-mt-2 max-w-2xl text-sm text-muted-foreground">
        Los locales del vivero. Los que tienen el retiro activado se ofrecen al
        cliente en la app para retirar su pedido.{" "}
        {activas === 1 ? "1 activa." : `${activas} activas.`}
      </p>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex gap-1.5 border-b border-border p-2">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              type="button"
              onClick={() => setEstado(f.valor)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                estado === f.valor
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {f.etiqueta}
            </button>
          ))}
        </div>

        {filas.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            {ubicaciones.length === 0
              ? "Todavía no hay ubicaciones. Crea la primera con + Ubicación."
              : "Ninguna ubicación en este filtro."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {filas.map((u) => (
              <li key={u.id}>
                <Link
                  href={`/dashboard/configuracion/ubicaciones/${u.id}?from=${from}`}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 md:py-3"
                >
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-secondary text-green-700">
                    <MapPin className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{u.nombre}</span>
                    <span className="block truncate text-[13px] text-muted-foreground">
                      {direccionDeUbicacion(u) ?? "Sin dirección"}
                    </span>
                  </span>
                  <span className="flex flex-none items-center gap-1.5">
                    {u.retiro && u.activa ? (
                      <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-800">
                        Retiro
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-semibold",
                        u.activa
                          ? "bg-green-50 text-green-800"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {u.activa ? "Activa" : "Inactiva"}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 flex-none text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
