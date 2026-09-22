interface EmptyStateProps {
  /** Qué falta. Una frase corta, no una explicación. */
  message?: string;
  /** Qué hacer al respecto, si hay algo que hacer. */
  detalle?: string;
}

/**
 * Una lista vacía: **un título y, si hace falta, una línea que dice qué hacer**.
 *
 * Tenía un ícono de bandeja de entrada de 48 px arriba de un renglón gris. El
 * ícono no distinguía nada —era el mismo en las quince listas— y el renglón
 * gris no decía si la lista está vacía porque no hay nada o porque el filtro no
 * encontró: eso lo dice el título, y el detalle dice qué se puede hacer. Es la
 * forma que ya usaba la app, y las dos son la misma pantalla.
 */
export function EmptyState({
  message = "No hay datos para mostrar",
  detalle,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 px-6 py-12 text-center">
      <p className="text-base font-semibold text-foreground">{message}</p>
      {detalle ? (
        <p className="max-w-sm text-sm text-muted-foreground">{detalle}</p>
      ) : null}
    </div>
  );
}
