"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";
import { MediaLibrary, subirALaBiblioteca, type MediaItem } from "./media-library";
import { EditorImagen } from "./editor-imagen";

export interface ImagenProducto {
  id: string;
  /** El archivo en la biblioteca. Lo mismo puede estar en otro producto. */
  mediaId: string;
  url: string;
  alt: string | null;
  nombre: string;
  posicion: number;
}

/**
 * La galería del producto.
 *
 * Las fotos son **del producto**, no de la variante: lo que una foto muestra
 * suele ser un eje solo —el color— así que colgarla de cada combinación
 * obligaría a subir la misma imagen una vez por talle. La variante elige cuál
 * de estas es la suya desde su propia ficha.
 *
 * Y el archivo es de la **biblioteca**: subir y elegir son dos caminos al mismo
 * lugar, así que la misma foto en dos productos es un archivo y no dos.
 *
 * **La primera es la principal**, y se cambia arrastrando. Antes había una
 * estrella para elegirla, que es un botón para hacer lo que el orden ya dice:
 * si la primera es la que se usa, moverla al frente *es* elegirla.
 *
 * **Sin `productoId` trabaja en el aire**: en el alta el producto todavía no
 * existe, así que agregar, sacar, reordenar y recortar solo tocan el estado y
 * se guardan con el resto. La biblioteca es independiente del producto, así
 * que subir y elegir funcionan igual en los dos casos.
 */
export function ProductoImagenes({
  productoId,
  imagenes: iniciales,
  onCambio,
}: {
  /** Nulo mientras el producto no existe: los cambios quedan en el estado. */
  productoId: string | null;
  imagenes: ImagenProducto[];
  /** Para que la variante sepa qué fotos hay para elegir. */
  onCambio?: (imagenes: ImagenProducto[]) => void;
}) {
  const [imagenes, setImagenes] = useState(iniciales);
  // Con el producto sin crear, la lista la manda el formulario: si él la
  // cambia (descartar, por ejemplo), acá se refleja.
  const [ultimas, setUltimas] = useState(iniciales);
  if (!productoId && ultimas !== iniciales) {
    setUltimas(iniciales);
    setImagenes(iniciales);
  }
  const [subiendo, setSubiendo] = useState(false);
  const [quitando, setQuitando] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [eligiendo, setEligiendo] = useState(false);
  /** Qué foto se está recortando: la fila de la galería y su archivo. */
  const [recortando, setRecortando] = useState<ImagenProducto | null>(null);
  /** Cuál se está arrastrando y sobre cuál está: el orden decide la principal. */
  const [moviendo, setMoviendo] = useState<number | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const aplicar = (nuevas: ImagenProducto[]) => {
    setImagenes(nuevas);
    onCambio?.(nuevas);
  };

  /** Suma al producto imágenes que ya están en la biblioteca. */
  const agregar = async (mediaIds: string[], items?: MediaItem[]) => {
    if (mediaIds.length === 0) return;
    if (!productoId) {
      // Sin producto, la fila de galería es la media misma: `agregarImagenes`
      // se llama al guardar con estos mismos ids.
      const ya = new Set(imagenes.map((i) => i.mediaId));
      aplicar([
        ...imagenes,
        ...(items ?? [])
          .filter((m) => !ya.has(m.id))
          .map((m, i) => ({
            id: m.id,
            mediaId: m.id,
            url: m.url,
            alt: m.alt,
            nombre: m.nombre,
            posicion: imagenes.length + i,
          })),
      ]);
      return;
    }
    try {
      const res = await fetch(`/api/servicios/${productoId}/imagenes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaIds }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error");
      aplicar(body.imagenes);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos agregarlas");
    }
  };

  /** Sube archivos nuevos y los suma de una: es un solo gesto para quien lo hace. */
  const subir = async (files: File[]) => {
    if (files.length === 0) return;
    setSubiendo(true);
    try {
      const nuevas = await subirALaBiblioteca(files);
      await agregar(nuevas.map((m) => m.id), nuevas);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos subir");
    } finally {
      setSubiendo(false);
      if (input.current) input.current.value = "";
    }
  };

  /** La saca del producto. Sigue en la biblioteca, para otro. */
  const quitar = async (id: string) => {
    if (!productoId) {
      aplicar(imagenes.filter((i) => i.id !== id));
      return;
    }
    setQuitando(id);
    try {
      const res = await fetch(`/api/servicios/${productoId}/imagenes/${id}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error");
      aplicar(body.imagenes);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos sacarla");
    } finally {
      setQuitando(null);
    }
  };

  /**
   * Deja la foto apuntando al recorte, **en su lugar**.
   *
   * El recorte es una imagen nueva de la biblioteca; la fila de la galería
   * cambia de archivo sin moverse, así que la variante que la había elegido
   * sigue apuntando a ella.
   */
  const usarRecorte = async (imagenId: string, nueva: MediaItem) => {
    if (!productoId) {
      aplicar(
        imagenes.map((i) =>
          i.id === imagenId
            ? { ...i, id: nueva.id, mediaId: nueva.id, url: nueva.url, nombre: nueva.nombre }
            : i
        )
      );
      return;
    }
    try {
      const res = await fetch(
        `/api/servicios/${productoId}/imagenes/${imagenId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mediaId: nueva.id }),
        }
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error");
      aplicar(body.imagenes);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos aplicarlo");
    }
  };

  /**
   * Mueve una foto a otra posición. La del frente es la principal.
   *
   * Se aplica en pantalla enseguida y se manda después: arrastrar y esperar a
   * que el servidor conteste para ver el resultado hace que se arrastre dos
   * veces. Si falla, vuelve a como estaba y lo dice.
   */
  const reordenar = async (desde: number, hasta: number) => {
    if (desde === hasta) return;
    const lista = [...imagenes];
    const [movida] = lista.splice(desde, 1);
    lista.splice(hasta, 0, movida);
    const previas = imagenes;
    aplicar(lista.map((x, posicion) => ({ ...x, posicion })));
    if (!productoId) return;
    const orden = lista.map((x) => x.id);
    try {
      const res = await fetch(`/api/servicios/${productoId}/imagenes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: orden }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error");
      aplicar(body.imagenes);
    } catch (e) {
      aplicar(previas);
      toast.error(e instanceof Error ? e.message : "No pudimos reordenar");
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="border-b py-3">
          <CardTitle className="text-base">Fotos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {imagenes.length > 0 && (
            /* La principal grande y el resto chicas, como en Shopify: el orden
               ya dice cuál manda, y hacerlo visible ahorra tener que decirlo.
               La primera ocupa 2×2 de la grilla. */
            <div className="grid grid-cols-4 gap-2">
              {imagenes.map((img, i) => (
                <div
                  key={img.id}
                  draggable
                  onDragStart={(e) => {
                    setMoviendo(i);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => {
                    setMoviendo(null);
                    setSobre(null);
                  }}
                  onDragOver={(e) => {
                    // Sin esto el navegador no acepta el soltar.
                    if (moviendo === null) return;
                    e.preventDefault();
                    setSobre(i);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (moviendo !== null) void reordenar(moviendo, i);
                    setMoviendo(null);
                    setSobre(null);
                  }}
                  className={`group relative aspect-square cursor-grab overflow-hidden rounded-md border bg-muted active:cursor-grabbing ${
                    i === 0 ? "col-span-2 row-span-2" : ""
                  } ${moviendo === i ? "opacity-30" : ""} ${
                    sobre === i && moviendo !== i ? "ring-2 ring-primary" : ""
                  }`}
                >
                  {/* Tocar la foto la abre para editarla: es lo que se quiere
                      hacer con una foto que se está mirando, y un botón de
                      recortar entre otros dos era un blanco chico para la
                      acción más frecuente. */}
                  <button
                    type="button"
                    onClick={() => setRecortando(img)}
                    className="block h-full w-full"
                    aria-label={`Editar ${img.nombre}`}
                  >
                    <Image
                      src={img.url}
                      alt={img.alt ?? ""}
                      fill
                      sizes={i === 0 ? "400px" : "200px"}
                      className="object-cover"
                      unoptimized
                    />
                  </button>
                  {i === 0 && (
                    <span className="pointer-events-none absolute left-1 top-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-medium">
                      Principal
                    </span>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1 h-6 w-6 bg-black/50 text-white opacity-0 transition-opacity hover:bg-black/70 hover:text-white group-hover:opacity-100"
                    aria-label="Sacar del producto"
                    disabled={quitando !== null}
                    onClick={() => quitar(img.id)}
                  >
                    {quitando === img.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {imagenes.length > 1 && (
            <p className="text-xs text-muted-foreground">
              Arrastra para reordenar. La primera es la principal.
            </p>
          )}

          {/* Soltar el archivo encima es el gesto más corto que hay, y hasta
              ahora había que buscar el botón y después el archivo. Los dos
              caminos siguen: *Subir* abre el explorador, *Elegir existente*
              abre la biblioteca. */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setArrastrando(true);
            }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={(e) => {
              e.preventDefault();
              setArrastrando(false);
              subir([...e.dataTransfer.files]);
            }}
            className={`flex flex-col items-center gap-2 rounded-md border-2 border-dashed p-6 text-center transition-colors ${
              arrastrando ? "border-primary bg-primary/5" : "border-muted"
            }`}
          >
            <input
              ref={input}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && subir([...e.target.files])}
            />
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={subiendo}
                onClick={() => input.current?.click()}
              >
                {subiendo && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Subir
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-primary hover:bg-transparent hover:underline"
                onClick={() => setEligiendo(true)}
              >
                Elegir existente
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              O arrastra las imágenes aquí.
            </p>
          </div>
        </CardContent>
      </Card>

      {recortando && (
        <EditorImagen
          media={{
            id: recortando.mediaId,
            url: recortando.url,
            alt: recortando.alt,
          }}
          onCerrar={() => setRecortando(null)}
          onGuardado={async (nueva) => {
            const fila = recortando;
            setRecortando(null);
            await usarRecorte(fila.id, nueva);
          }}
        />
      )}

      {eligiendo && (
        <MediaLibrary
          yaUsadas={imagenes.map((i) => i.mediaId)}
          onCerrar={() => setEligiendo(false)}
          onElegir={async (ids) => {
            setEligiendo(false);
            await agregar(ids);
          }}
        />
      )}
    </>
  );
}
