import { useState } from "react";
import { HelperText } from "react-native-paper";
import {
  SelectorDeFotos,
  fotoDeBiblioteca,
} from "@/components/informes/SelectorDeFotos";
import { apiRequest, mensajeDeError } from "@/lib/api";
import type { VarianteDeProducto } from "@/lib/types";

/**
 * Cuál es la foto de una variante: la biblioteca entera, de a una, como en
 * el portal y como el *Add media* de Shopify. Es el selector del informe en
 * modo biblioteca y de a una: el buscador, la cámara y el + para subir, y
 * la grilla con la casilla en la elegida; la foto actual entra marcada, y
 * desmarcarla es volver a mostrar la principal del producto.
 *
 * Las fotos de una variante son **del producto**, así que si el archivo
 * elegido no es foto del producto todavía, se le suma primero
 * (`POST …/imagenes`) y recién ahí la variante lo señala por su fila
 * (`PATCH …/variantes/[id]` con `imagenId`). Así también aparece entre las
 * fotos del producto, que es donde vive.
 */
export function SelectorDeFotoDeVariante({
  variante,
  productoId,
  imagenes,
  onCerrar,
  onGuardado,
}: {
  variante: VarianteDeProducto;
  productoId: string;
  imagenes: { id: string; mediaId: string; url: string }[];
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const actual = imagenes.find((i) => i.id === variante.imagenId) ?? null;

  async function elegir(mediaId: string | null) {
    setError(null);
    try {
      let imagenId: string | null = null;
      if (mediaId) {
        const enElProducto = imagenes.find((i) => i.mediaId === mediaId);
        if (enElProducto) imagenId = enElProducto.id;
        else {
          const { imagenes: nuevas } = await apiRequest<{
            imagenes: { id: string; mediaId: string }[];
          }>(`/api/mobile/servicios/${productoId}/imagenes`, {
            method: "POST",
            body: { mediaIds: [mediaId] },
          });
          imagenId = nuevas.find((i) => i.mediaId === mediaId)?.id ?? null;
        }
      }
      await apiRequest(`/api/mobile/variantes/${variante.id}`, {
        method: "PATCH",
        body: { imagenId },
      });
      onGuardado();
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos guardar la foto"));
    }
  }

  return (
    <>
      <SelectorDeFotos
        pool={[]}
        soloBiblioteca
        unaSola
        enLaSeccion={actual ? [fotoDeBiblioteca({ id: actual.mediaId, url: actual.url })] : []}
        onCerrar={onCerrar}
        onConfirmar={(fotos) => void elegir(fotos[0]?.mediaId ?? null)}
      />
      {error ? (
        <HelperText type="error" visible>
          {error}
        </HelperText>
      ) : null}
    </>
  );
}
