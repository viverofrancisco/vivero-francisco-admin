"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crop, Loader2, Star, Trash2 } from "lucide-react";
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
 * La primera es la que se usa cuando ninguna variante eligió otra, y por eso se
 * puede mover: es la decisión que importa de todo el orden.
 */
export function ProductoImagenes({
  productoId,
  imagenes: iniciales,
  onCambio,
}: {
  productoId: string;
  imagenes: ImagenProducto[];
  /** Para que la variante sepa qué fotos hay para elegir. */
  onCambio?: (imagenes: ImagenProducto[]) => void;
}) {
  const [imagenes, setImagenes] = useState(iniciales);
  const [subiendo, setSubiendo] = useState(false);
  const [quitando, setQuitando] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [eligiendo, setEligiendo] = useState(false);
  /** Qué foto se está recortando: la fila de la galería y su archivo. */
  const [recortando, setRecortando] = useState<ImagenProducto | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const aplicar = (nuevas: ImagenProducto[]) => {
    setImagenes(nuevas);
    onCambio?.(nuevas);
  };

  /** Suma al producto imágenes que ya están en la biblioteca. */
  const agregar = async (mediaIds: string[]) => {
    if (mediaIds.length === 0) return;
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
      await agregar(nuevas.map((m) => m.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos subir");
    } finally {
      setSubiendo(false);
      if (input.current) input.current.value = "";
    }
  };

  /** La saca del producto. Sigue en la biblioteca, para otro. */
  const quitar = async (id: string) => {
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

  /** La manda al frente: es la que se muestra cuando nadie eligió otra. */
  const hacerPrincipal = async (id: string) => {
    const orden = [id, ...imagenes.filter((i) => i.id !== id).map((i) => i.id)];
    const previas = imagenes;
    aplicar(
      orden.map((x, posicion) => ({ ...imagenes.find((i) => i.id === x)!, posicion }))
    );
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
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {imagenes.map((img, i) => (
                <div
                  key={img.id}
                  className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
                >
                  <Image
                    src={img.url}
                    alt={img.alt ?? ""}
                    fill
                    sizes="200px"
                    className="object-cover"
                    unoptimized
                  />
                  {i === 0 && (
                    <span className="absolute left-1 top-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-medium">
                      Principal
                    </span>
                  )}
                  {/* Las acciones aparecen al pasar por encima: con seis fotos,
                      doce botones siempre visibles tapan las fotos. */}
                  <div className="absolute inset-x-0 bottom-0 flex justify-end gap-0.5 bg-gradient-to-t from-black/60 to-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {i !== 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-white hover:bg-white/20 hover:text-white"
                        aria-label="Hacer principal"
                        onClick={() => hacerPrincipal(img.id)}
                      >
                        <Star className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-white hover:bg-white/20 hover:text-white"
                      aria-label="Recortar"
                      onClick={() => setRecortando(img)}
                    >
                      <Crop className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-white hover:bg-white/20 hover:text-white"
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
                </div>
              ))}
            </div>
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
              O arrastrá las imágenes acá.
            </p>
          </div>
        </CardContent>
      </Card>

      {recortando && (
        <EditorImagen
          media={{
            id: recortando.mediaId,
            url: recortando.url,
            nombre: recortando.nombre,
            alt: recortando.alt,
            usos: 0,
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
