"use client";

import { Button } from "@/components/ui/button";

/**
 * Cuántas filas por página en los listados del dashboard.
 *
 * Un solo número para todas las tablas: antes había 10, 12 y 25 según la
 * pantalla, y el salto se notaba al moverse entre secciones.
 */
export const FILAS_POR_PAGINA = 25;

/**
 * Barra de paginación de los listados.
 *
 * Se renderiza **siempre**, incluso con una sola página. Esconderla hacía que
 * la tabla cambiara de alto al filtrar y que no hubiera dónde leer cuántos
 * resultados hay; con la barra fija, el bloque de filas es lo único que se
 * mueve.
 *
 * Va **dentro** del card de la tabla, como su pie: el encabezado, las filas y
 * el pie son una sola pieza. `suelta` es para las pantallas de tarjetas, donde
 * no hay card que cerrar y la barra es solo una línea al final.
 */
export function TablePagination({
  page,
  total,
  onPageChange,
  /** Cómo nombrar lo que se lista: "producto", "cliente"… */
  sustantivo,
  plural,
  porPagina = FILAS_POR_PAGINA,
  suelta = false,
}: {
  page: number;
  total: number;
  onPageChange: (page: number) => void;
  sustantivo: string;
  plural?: string;
  porPagina?: number;
  /** Sin fondo ni padding lateral, para las grillas de tarjetas. */
  suelta?: boolean;
}) {
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const actual = Math.min(page, totalPaginas);
  const desde = total === 0 ? 0 : (actual - 1) * porPagina + 1;
  const hasta = Math.min(actual * porPagina, total);
  const nombre = total === 1 ? sustantivo : (plural ?? `${sustantivo}s`);

  return (
    <div
      className={
        suelta
          ? "flex flex-none flex-wrap items-center justify-between gap-3 border-t pt-3"
          : "flex flex-none flex-wrap items-center justify-between gap-3 border-t bg-muted/30 px-4 py-2.5"
      }
    >
      <p className="text-sm text-muted-foreground">
        {total === 0
          ? `Sin ${plural ?? `${sustantivo}s`}`
          : `${desde}–${hasta} de ${total} ${nombre}`}
      </p>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">
          Página {actual} de {totalPaginas}
        </span>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={actual <= 1}
            onClick={() => onPageChange(actual - 1)}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={actual >= totalPaginas}
            onClick={() => onPageChange(actual + 1)}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}
