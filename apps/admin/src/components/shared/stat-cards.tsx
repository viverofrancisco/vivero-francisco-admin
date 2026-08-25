interface StatCardsProps {
  /** Pares [etiqueta, valor]. */
  stats: ReadonlyArray<ReadonlyArray<string | number>>;
}

/**
 * Tira de tarjetas de resumen (etiqueta + número) que aparece arriba de varias
 * listas. Compacta en móvil para no ocupar tanto espacio; tamaño completo
 * desde `sm`.
 */
export function StatCards({ stats }: StatCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3.5">
      {stats.map((row) => (
        <div
          key={String(row[0])}
          className="rounded-xl border border-border bg-card px-3 py-2 sm:rounded-2xl sm:px-[18px] sm:py-[15px]"
        >
          <div className="truncate text-[11px] font-semibold text-muted-foreground sm:text-[13px]">
            {row[0]}
          </div>
          <div className="mt-0.5 text-xl font-extrabold tracking-tight text-foreground sm:mt-1 sm:text-[26px]">
            {row[1]}
          </div>
        </div>
      ))}
    </div>
  );
}
