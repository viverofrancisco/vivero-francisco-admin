"use client";

import { MediaLibrary, type MediaItem } from "./media-library";
import type { ImagenProducto } from "./producto-imagenes";

/**
 * Cuál es la foto de una variante: la biblioteca entera, de a una, como el
 * *Select image* de Shopify. Buscador, la zona de subir —lo subido queda
 * marcado— y la grilla con una casilla en la elegida; la foto actual entra
 * marcada, y desmarcarla es volver a mostrar la principal del producto.
 *
 * Las fotos de una variante son **del producto**, así que devuelve el
 * archivo y no una fila: quien abrió el diálogo decide si ese archivo ya es
 * una foto del producto (y usa su fila) o hay que sumarlo primero — en el
 * acto en la ficha de la variante, pendiente en la tabla de la ficha.
 */
export function SelectorFotoDeVariante({
  imagenes,
  imagenId,
  onListo,
  onCerrar,
}: {
  /** La galería del producto: para saber qué archivo tiene la elegida hoy. */
  imagenes: ImagenProducto[];
  /** La fila elegida hoy; `null` es ninguna. */
  imagenId: string | null;
  /** El archivo elegido, o `null` por "ninguna". */
  onListo: (media: MediaItem | null) => void;
  onCerrar: () => void;
}) {
  const actual = imagenes.find((i) => i.id === imagenId)?.mediaId ?? null;
  return (
    <MediaLibrary
      titulo="Elegir foto"
      unaSola
      yaUsadas={[]}
      elegidasIniciales={actual ? [actual] : []}
      permiteNinguna
      nota="Sin ninguna marcada, la variante muestra la primera foto del producto. Una foto que no esté en el producto se le suma."
      onElegirItems={(items) => onListo(items[0] ?? null)}
      onCerrar={onCerrar}
    />
  );
}
