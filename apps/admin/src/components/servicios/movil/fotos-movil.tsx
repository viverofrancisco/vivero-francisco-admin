"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Expand, Loader2, Plus, Star, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { MediaViewer } from "@/components/ui/media-viewer";
import { MediaLibrary } from "../media-library";
import type { ImagenProducto } from "../producto-imagenes";
import { pedir } from "./piezas";

/**
 * Las fotos del producto en el teléfono, la sección *Media* de Shopify y la
 * misma que la app: las miniaturas grandes en fila y un **+** al final que
 * abre la biblioteca —las del producto ya marcadas, y *Subir* para traer
 * nuevas—. Tocar una foto abre, en una hoja desde abajo, verla, ponerla
 * primera o quitarla del producto.
 *
 * Cada gesto se guarda en el acto, como en la app: la ficha en el teléfono
 * no tiene la barra de guardar del escritorio. *Listo* en la biblioteca
 * devuelve la lista final: lo desmarcado se quita y lo nuevo se suma; las
 * que siguen no se tocan, así conservan su fila.
 */
export function FotosDeProductoMovil({
  productoId,
  imagenes,
}: {
  productoId: string;
  imagenes: ImagenProducto[];
}) {
  const router = useRouter();
  const [foto, setFoto] = useState<ImagenProducto | null>(null);
  const [viendo, setViendo] = useState<string | null>(null);
  const [eligiendo, setEligiendo] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const correr = async (fn: () => Promise<void>, fallo: string) => {
    setOcupado(true);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : fallo);
    } finally {
      setOcupado(false);
    }
  };

  const aplicar = (mediaIds: string[]) =>
    correr(async () => {
      const finales = new Set(mediaIds);
      const tenia = new Set(imagenes.map((i) => i.mediaId));
      for (const q of imagenes.filter((i) => !finales.has(i.mediaId))) {
        await pedir(`/api/servicios/${productoId}/imagenes/${q.id}`, { method: "DELETE" });
      }
      const nuevas = mediaIds.filter((id) => !tenia.has(id));
      if (nuevas.length > 0) {
        await pedir(`/api/servicios/${productoId}/imagenes`, {
          method: "POST",
          body: { mediaIds: nuevas },
        });
      }
    }, "No pudimos guardar las fotos");

  const ponerPrimera = (id: string) =>
    correr(
      () =>
        pedir(`/api/servicios/${productoId}/imagenes`, {
          method: "PATCH",
          body: { ids: [id, ...imagenes.map((i) => i.id).filter((x) => x !== id)] },
        }).then(() => undefined),
      "No pudimos reordenar las fotos"
    );

  const quitar = (id: string) =>
    correr(
      () => pedir(`/api/servicios/${productoId}/imagenes/${id}`, { method: "DELETE" }).then(() => undefined),
      "No pudimos quitar la foto"
    );

  return (
    <section className="mt-5">
      <p className="mb-1.5 pl-1 text-[11px] tracking-[0.8px] text-muted-foreground uppercase">
        Fotos{imagenes.length > 0 ? ` (${imagenes.length})` : ""}
      </p>
      <div className="-mx-3 flex gap-2.5 overflow-x-auto px-3 pb-1">
        {imagenes.map((img, i) => (
          <button
            key={img.id}
            type="button"
            onClick={() => setFoto(img)}
            aria-label={i === 0 ? "Foto principal" : `Foto ${i + 1}`}
            className="relative h-[120px] w-[120px] flex-none overflow-hidden rounded-xl bg-muted active:opacity-70"
          >
            <Image src={img.url} alt="" fill sizes="120px" className="object-cover" unoptimized />
          </button>
        ))}
        <button
          type="button"
          onClick={() => setEligiendo(true)}
          disabled={ocupado}
          aria-label="Agregar fotos"
          className="flex h-[120px] w-[120px] flex-none items-center justify-center rounded-xl border bg-card active:opacity-70 disabled:opacity-60"
        >
          {ocupado ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : <Plus className="h-7 w-7" />}
        </button>
      </div>

      {/* Qué se hace con una foto: verla, ponerla primera, quitarla. */}
      <Sheet open={foto !== null} onOpenChange={(o) => !o && setFoto(null)}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="gap-0 rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom)]"
        >
          <SheetTitle className="sr-only">Foto</SheetTitle>
          {foto ? (
            <div className="relative mx-4 mt-4 h-[72px] w-[72px] overflow-hidden rounded-[10px] bg-muted">
              <Image src={foto.url} alt="" fill sizes="72px" className="object-cover" unoptimized />
            </div>
          ) : null}
          <div className="py-2">
            <button
              type="button"
              onClick={() => {
                const url = foto?.url ?? null;
                setFoto(null);
                setTimeout(() => setViendo(url), 250);
              }}
              className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left text-[16px] active:bg-muted"
            >
              <Expand className="h-5 w-5" />
              Ver foto
            </button>
            {foto && imagenes[0]?.id !== foto.id ? (
              <button
                type="button"
                onClick={() => {
                  const id = foto.id;
                  setFoto(null);
                  void ponerPrimera(id);
                }}
                className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left text-[16px] active:bg-muted"
              >
                <Star className="h-5 w-5" />
                Poner como primera
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                const id = foto?.id;
                setFoto(null);
                if (id) void quitar(id);
              }}
              className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left text-[16px] text-destructive active:bg-muted"
            >
              <Trash2 className="h-5 w-5" />
              Quitar del producto
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {eligiendo ? (
        <MediaLibrary
          titulo="Elegir fotos"
          yaUsadas={[]}
          elegidasIniciales={imagenes.map((i) => i.mediaId)}
          permiteNinguna
          onElegir={(ids) => {
            setEligiendo(false);
            void aplicar(ids);
          }}
          onCerrar={() => setEligiendo(false)}
        />
      ) : null}

      <MediaViewer media={viendo ? { url: viendo, tipo: "imagen" } : null} onClose={() => setViendo(null)} />
    </section>
  );
}
