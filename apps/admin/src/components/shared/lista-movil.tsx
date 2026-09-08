"use client";

import { EmptyState } from "@/components/shared/empty-state";
import { PieScrollInfinito } from "@/components/shared/scroll-infinito";

/**
 * El listado en móvil: filas de borde a borde, sin card.
 *
 * El `-mx-4` es para salirse del `p-4` de la página. Un card en una pantalla
 * de 400 px gasta dos bordes y dos márgenes —unos 34 px de ancho— en recuadrar
 * lo único que hay en pantalla, y un recuadro que contiene todo no separa nada
 * de nada. Las filas se separan entre sí con una línea, que es lo que hacía
 * falta. En escritorio no existe: ahí sigue la tabla adentro de su card.
 *
 * El padding lateral pasa a cada fila (`px-4`), así el texto sigue alineado
 * con el título y el buscador de arriba aunque el fondo llegue al borde.
 */
export function ListaMovil({
  vacia,
  mensajeVacio,
  hayMas,
  cargando,
  centinela,
  children,
}: {
  vacia: boolean;
  mensajeVacio: string;
  hayMas: boolean;
  cargando?: boolean;
  centinela: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) {
  return (
    // `-mb-4` además del `-mx-4`: la lista también llega hasta abajo. Con el
    // padding de la página quedaba una franja gris entre el blanco de la lista
    // y el nav, que parecía un corte y no el final de nada.
    <div className="-mx-4 -mb-4 flex min-h-0 flex-1 flex-col overflow-hidden border-t border-border bg-card md:hidden">
      {vacia ? (
        <EmptyState message={mensajeVacio} />
      ) : (
        // `overscroll-contain`: al llegar al fondo el gesto se queda en la
        // lista en vez de pasarle el scroll a la página y rebotar.
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
          <PieScrollInfinito
            hayMas={hayMas}
            cargando={cargando}
            centinela={centinela}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Una fila del listado. Las clases que comparten las cinco pantallas.
 *
 * La línea va **arriba** de cada fila y no abajo: el pie del scroll infinito
 * es el último hijo, así que con `border-b` la última fila no era `:last-child`
 * y se quedaba con su línea — y el pie, que es un espacio en blanco, pasaba a
 * leerse como una fila vacía. La de la primera la pone el borde del contenedor.
 */
export const FILA_MOVIL =
  "flex items-center gap-3 border-t border-border px-4 py-3 first:border-t-0";
