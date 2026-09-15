"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, type EstadoVisitaUI } from "@/components/ui/status-badge";
import { TablePagination } from "@/components/shared/table-pagination";
import { CalendarOff } from "lucide-react";
import { useAca } from "@/lib/filtros-url";

export interface VisitaDelPersonal {
  id: string;
  numero: number;
  fechaProgramada: string;
  estado: string;
  cliente: string;
}

/**
 * Lo que esta persona hizo, de lo más reciente a lo más viejo.
 *
 * La página va en la URL (`?vpag=`) y no en un estado de React: abrir una
 * visita y volver con la flecha recrea la ficha desde cero, así que la página
 * elegida se perdería y habría que volver a buscarla.
 */
export function VisitasDelPersonal({
  visitas,
  total,
  page,
  porPagina,
}: {
  visitas: VisitaDelPersonal[];
  total: number;
  page: number;
  /**
   * Lo decide la página, que es la que consulta.
   *
   * Estaba acá como constante exportada, y este archivo es `"use client"`:
   * Next convierte cada export de un módulo cliente en una referencia, así que
   * el servidor recibía una función donde esperaba un número —`take:
   * [object Function]`, `skip: NaN`— y TypeScript no lo veía, porque el tipo
   * declarado seguía diciendo `number`.
   */
  porPagina: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const aqui = useAca();

  function irA(nueva: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (nueva <= 1) params.delete("vpag");
    else params.set("vpag", String(nueva));
    // `replace` y no `push`: pasar de la página 3 a la 1 no son tres pasos
    // atrás, y la flecha de volver tiene que salir de la ficha.
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Visitas</CardTitle>
      </CardHeader>
      {visitas.length === 0 ? (
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <CalendarOff className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm font-medium text-muted-foreground">
            Todavía no tiene visitas
          </p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Van a aparecer acá las visitas donde se lo asigne.
          </p>
        </CardContent>
      ) : (
        <>
          <CardContent className="p-0">
            {visitas.map((v) => (
              <Link
                key={v.id}
                href={`/dashboard/visitas/${v.id}?from=${aqui}`}
                className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0 hover:bg-muted/50 md:px-6"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{v.cliente}</p>
                  <p className="text-xs font-medium text-muted-foreground">
                    #{v.numero} · {formatearFecha(v.fechaProgramada)}
                  </p>
                </div>
                <StatusBadge
                  estado={v.estado as EstadoVisitaUI}
                  size="sm"
                  className="flex-none"
                />
              </Link>
            ))}
          </CardContent>
          <TablePagination
            page={page}
            total={total}
            onPageChange={irA}
            sustantivo="visita"
            porPagina={porPagina}
          />
        </>
      )}
    </Card>
  );
}

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
