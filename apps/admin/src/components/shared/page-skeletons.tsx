import { Skeleton } from "@/components/ui/skeleton";

/**
 * Esqueletos de carga de las pantallas del dashboard.
 *
 * Van en un `loading.tsx` por sección. Sin eso, el App Router espera a que el
 * server component termine sus consultas **antes** de cambiar de página, y el
 * click se siente colgado: la pantalla vieja se queda quieta unos segundos. Con
 * un `loading.tsx` la navegación es inmediata y los datos llegan después.
 *
 * No buscan calcar la pantalla: alcanza con que el bloque grande esté donde va,
 * para que el contenido real no salte al aparecer.
 */

function Encabezado() {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-9 w-32 rounded-xl" />
    </div>
  );
}

/** Listados con filtros y tabla. */
export function SkeletonLista() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <Encabezado />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-xl" />
        ))}
      </div>
      <div className="rounded-xl border">
        <Skeleton className="h-11 w-full rounded-none rounded-t-xl" />
        <div className="divide-y">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5">
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="hidden h-4 w-32 sm:block" />
              <Skeleton className="hidden h-4 w-24 md:block" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Fichas de detalle: cabecera y tarjetas a dos columnas. */
export function SkeletonDetalle() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <Encabezado />
      <div className="grid gap-6 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl border p-4">
            <Skeleton className="h-5 w-40" />
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="flex justify-between gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Altas y ediciones. */
export function SkeletonFormulario() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <Encabezado />
      <div className="space-y-5 rounded-xl border p-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Panel de inicio: tarjetas de números y dos bloques anchos. */
export function SkeletonPanel() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <Encabezado />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl border p-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl border p-4">
            <Skeleton className="h-5 w-40" />
            {Array.from({ length: 5 }).map((_, j) => (
              <Skeleton key={j} className="h-10 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
