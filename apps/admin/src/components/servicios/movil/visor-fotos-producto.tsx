"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Crop, MoreHorizontal, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { EditorImagen } from "../editor-imagen";
import type { ImagenProducto } from "../producto-imagenes";
import { pedir } from "./piezas";

const CIRCULO =
  "flex h-11 w-11 items-center justify-center rounded-full bg-[#3c3c3c]/85 text-white active:opacity-70";

/**
 * Las fotos del producto a pantalla completa en el teléfono, el visor de
 * Shopify y el mismo que la app: fondo negro, la ✕ y el ⋯ en círculos
 * oscuros —se ven también sobre una foto blanca—, *N de M* en el medio, un
 * deslizamiento por foto, y abajo *Recortar*. El ⋯ tiene lo demás que se
 * hace con una foto: ponerla primera y quitarla del producto.
 *
 * Recortar es el editor del portal (`EditorImagen`): devuelve **otra**
 * imagen de la biblioteca, que pasa a ocupar el lugar de esta en el producto
 * (`PATCH …/imagenes/[id]`), sin moverla ni soltar la variante que la eligió.
 */
export function VisorDeFotosDeProducto({
  productoId,
  imagenes,
  inicial,
  canEdit,
  onCerrar,
  onPonerPrimera,
  onQuitar,
}: {
  productoId: string;
  imagenes: ImagenProducto[];
  inicial: number;
  canEdit: boolean;
  onCerrar: () => void;
  onPonerPrimera?: (id: string) => void;
  onQuitar?: (id: string) => void;
}) {
  const router = useRouter();
  const [indiceCrudo, setIndice] = useState(inicial);
  const [menu, setMenu] = useState(false);
  const [recortando, setRecortando] = useState(false);
  const carril = useRef<HTMLDivElement>(null);
  // Quitar la del final deja el índice pasado: se acota al leerlo, sin un
  // efecto que lo corrija después de pintar.
  const indice = Math.min(indiceCrudo, Math.max(0, imagenes.length - 1));
  const actual = imagenes[indice] ?? null;

  // Escape cierra y la página de atrás no scrollea, como el visor de siempre.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCerrar();
    }
    window.addEventListener("keydown", onKey);
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = antes;
    };
  }, [onCerrar]);

  // Arranca en la foto tocada, sin animar hasta ahí.
  useEffect(() => {
    const el = carril.current;
    if (el) el.scrollTo({ left: el.clientWidth * inicial });
  }, [inicial]);

  // Quitar la última cierra el visor.
  useEffect(() => {
    if (imagenes.length === 0) onCerrar();
  }, [imagenes.length, onCerrar]);

  const alScroll = () => {
    const el = carril.current;
    if (!el || el.clientWidth === 0) return;
    setIndice(Math.round(el.scrollLeft / el.clientWidth));
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div
        ref={carril}
        onScroll={alScroll}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden [scrollbar-width:none]"
      >
        {imagenes.map((img) => (
          <div
            key={img.id}
            className="flex h-full w-full flex-none snap-center items-center justify-center"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt={img.alt ?? ""} className="max-h-full max-w-full object-contain" />
          </div>
        ))}
      </div>

      {/* Arriba: la ✕, el contador y el ⋯, en círculos oscuros para que se
          lean sobre cualquier foto. */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-3 pt-[calc(env(safe-area-inset-top)+8px)]">
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className={CIRCULO}>
          <X className="h-5 w-5" />
        </button>
        <span className="text-[15px] font-semibold opacity-90">
          {imagenes.length > 0 ? `${indice + 1} de ${imagenes.length}` : ""}
        </span>
        {canEdit && (onPonerPrimera || onQuitar) ? (
          <button
            type="button"
            onClick={() => setMenu((v) => !v)}
            aria-label="Acciones"
            aria-expanded={menu}
            className={CIRCULO}
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        ) : (
          <span className="h-11 w-11" aria-hidden />
        )}
      </div>

      {menu ? (
        <>
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setMenu(false)}
            className="absolute inset-0 cursor-default"
          />
          <div className="absolute right-3 top-[calc(env(safe-area-inset-top)+62px)] min-w-60 rounded-xl bg-[#2c2c2e] py-1.5">
            {onPonerPrimera && indice > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setMenu(false);
                  if (actual) onPonerPrimera(actual.id);
                }}
                className="flex w-full items-center gap-3.5 px-4 py-3 text-left text-[16px] active:bg-white/10"
              >
                <Star className="h-5 w-5" />
                Poner como primera
              </button>
            ) : null}
            {onQuitar ? (
              <button
                type="button"
                onClick={() => {
                  setMenu(false);
                  if (actual) onQuitar(actual.id);
                }}
                className="flex w-full items-center gap-3.5 px-4 py-3 text-left text-[16px] text-[#ff6b6b] active:bg-white/10"
              >
                <Trash2 className="h-5 w-5" />
                Quitar del producto
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      {/* Abajo, las herramientas de Shopify: acá, recortar. */}
      {canEdit ? (
        <div className="absolute inset-x-0 bottom-0 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
          <button
            type="button"
            onClick={() => setRecortando(true)}
            disabled={!actual}
            className="flex min-w-[120px] flex-col items-center gap-1.5 rounded-xl bg-[#3c3c3c]/85 px-4 py-3 text-[15px] font-semibold active:opacity-70 disabled:opacity-60"
          >
            <Crop className="h-5 w-5" />
            Recortar
          </button>
        </div>
      ) : null}

      {recortando && actual ? (
        <EditorImagen
          key={actual.id}
          media={{ id: actual.mediaId, url: actual.url, alt: actual.alt }}
          onCerrar={() => setRecortando(false)}
          onGuardado={async (nueva) => {
            setRecortando(false);
            try {
              await pedir(`/api/servicios/${productoId}/imagenes/${actual.id}`, {
                method: "PATCH",
                body: { mediaId: nueva.id },
              });
              router.refresh();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "No pudimos recortar la foto");
            }
          }}
        />
      ) : null}
    </div>
  );
}
