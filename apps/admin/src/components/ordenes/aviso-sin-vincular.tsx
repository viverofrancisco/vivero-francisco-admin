"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { useAca } from "@/lib/filtros-url";

/**
 * Aviso de que la orden lleva productos que no están en Contífico.
 *
 * La orden los acepta a propósito: registra **lo que se vendió**, y lo que
 * tiene que existir allá es lo que sale impreso, que se decide al emitir. Pero
 * el armador del documento no deja emitir una línea sin vínculo, y eso se
 * descubría recién adentro, con la orden ya creada. Se dice antes, donde
 * todavía se puede arreglar.
 *
 * Siempre con la misma forma —título y lista—, con uno o con cinco: la versión
 * en prosa para un solo producto era otro bloque distinto para decir lo mismo,
 * y el aviso cambiaba de aspecto al agregar el segundo.
 *
 * Cada nombre linkea a su ficha, que es donde se vincula: el aviso dice qué
 * pasa y también lleva hasta dónde arreglarlo.
 */
export function AvisoSinVincular({
  productos,
  bloquea,
}: {
  productos: { id: string; nombre: string }[];
  /**
   * Cierto donde facturar directo no se ofrece —al crear la orden—, para que
   * el aviso explique el botón deshabilitado en vez de contradecirlo.
   */
  bloquea?: boolean;
}) {
  const from = useAca();
  if (productos.length === 0) return null;

  const uno = productos.length === 1;

  return (
    <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-snug text-amber-900">
      <TriangleAlert className="mt-0.5 h-4 w-4 flex-none" />
      <div className="space-y-1">
        <p>Productos sin vincular con Contífico:</p>
        <ul className="list-disc space-y-0.5 pl-4">
          {productos.map((p) => (
            <li key={p.id}>
              <Link
                href={`/dashboard/productos/${p.id}?from=${from}`}
                className="font-medium underline underline-offset-2"
              >
                {p.nombre}
              </Link>
            </li>
          ))}
        </ul>
        {bloquea && (
          <p>
            Hasta que {uno ? "esté vinculado" : "estén vinculados"} no se puede
            emitir la factura. Podés guardar la orden como borrador y terminarla
            después.
          </p>
        )}
      </div>
    </div>
  );
}
