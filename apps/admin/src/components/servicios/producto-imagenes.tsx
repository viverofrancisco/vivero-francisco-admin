"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GripVertical, Loader2, Trash2 } from "lucide-react";
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
 * **No guarda nada por su cuenta**: todo queda en el formulario y se guarda con
 * la barra del header, junto con el resto de la ficha. Lo único que sí sube al
 * momento es el archivo, porque es de la biblioteca y no del producto.
 *
 * Por eso sirve igual en el alta, donde el producto todavía no existe.
 */
export function ProductoImagenes({
  imagenes,
  onCambio,
}: {
  imagenes: ImagenProducto[];
  /**
   * Los cambios salen por acá y **no se guardan solos**: agregar, sacar,
   * reordenar y recortar quedan en el formulario hasta que alguien aprieta
   * *Guardar* en la barra de arriba. Antes cada acción iba sola al servidor,
   * así que no había forma de hacer tres cambios y arrepentirse.
   */
  onCambio: (imagenes: ImagenProducto[]) => void;
}) {

  const [subiendo, setSubiendo] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const [eligiendo, setEligiendo] = useState(false);
  /** Qué foto se está recortando: la fila de la galería y su archivo. */
  const [recortando, setRecortando] = useState<ImagenProducto | null>(null);
  /** Cuál se está arrastrando (su id) y en qué posición caería. */
  const [moviendo, setMoviendo] = useState<string | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);

  /**
   * La lista **como quedaría** si se soltara ahora.
   *
   * Se dibuja esto y no una barra entre dos fotos: la pregunta al arrastrar es
   * "¿cómo va a quedar?", y una línea obliga a imaginarlo. Acá las fotos se
   * corren solas y lo que se ve es el resultado.
   */
  const vista = (() => {
    if (!moviendo || sobre === null) return imagenes;
    const desde = imagenes.findIndex((i) => i.id === moviendo);
    if (desde === -1 || desde === sobre) return imagenes;
    const lista = [...imagenes];
    const [m] = lista.splice(desde, 1);
    lista.splice(sobre, 0, m);
    return lista;
  })();
  const input = useRef<HTMLInputElement>(null);

  // Una sola fuente: lo que el formulario tiene. Un estado propio acá se
  // desincronizaba al descartar.
  const aplicar = onCambio;

  /** Suma al producto imágenes que ya están en la biblioteca. */
  /**
   * Suma fotos de la biblioteca. **No guarda**: queda en el formulario.
   *
   * La fila nueva usa el id de la media como id propio, porque todavía no
   * existe en la base; al guardar, el servidor crea la fila de verdad.
   */
  const agregar = (items: MediaItem[]) => {
    const ya = new Set(imagenes.map((i) => i.mediaId));
    const nuevas = items.filter((m) => !ya.has(m.id));
    if (nuevas.length === 0) return;
    aplicar([
      ...imagenes,
      ...nuevas.map((m, i) => ({
        id: m.id,
        mediaId: m.id,
        url: m.url,
        alt: m.alt,
        nombre: m.nombre,
        posicion: imagenes.length + i,
      })),
    ]);
  };

  /** Sube archivos nuevos y los suma de una: es un solo gesto para quien lo hace. */
  const subir = async (files: File[]) => {
    if (files.length === 0) return;
    setSubiendo(true);
    try {
      // El archivo sí sube ya: es de la biblioteca, no del producto, y
      // guardarlo recién al final obligaría a tenerlo en memoria mientras
      // tanto. Lo que espera al guardado es que este producto lo use.
      agregar(await subirALaBiblioteca(files));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos subir");
    } finally {
      setSubiendo(false);
      if (input.current) input.current.value = "";
    }
  };

  /** La saca del producto. Sigue en la biblioteca, para otro. */
  /** La saca del producto. Sigue en la biblioteca, para otro. */
  const quitar = (id: string) => {
    aplicar(imagenes.filter((i) => i.id !== id));
  };

  /**
   * Deja la foto apuntando al recorte, **en su lugar**.
   *
   * El recorte es una imagen nueva de la biblioteca; la fila de la galería
   * cambia de archivo sin moverse, así que la variante que la había elegido
   * sigue apuntando a ella.
   */
  const usarRecorte = (imagenId: string, nueva: MediaItem) => {
    // La fila conserva su id: es lo que hace que no se mueva de lugar y que la
    // variante que la había elegido la siga apuntando después de guardar.
    aplicar(
      imagenes.map((i) =>
        i.id === imagenId
          ? { ...i, mediaId: nueva.id, url: nueva.url, nombre: nueva.nombre }
          : i
      )
    );
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
               La primera ocupa 2×2 de la grilla.

               Seis columnas y ancho tope: sin el tope, en una pantalla ancha
               una miniatura terminaba más grande que la foto de un producto en
               el catálogo, y la card se comía la pantalla. */
            <div className="grid max-w-xl grid-cols-6 gap-2">
              {vista.map((img, i) => (
                <div
                  key={img.id}
                  // Se arrastra desde cualquier parte de la miniatura: si hay
                  // que agarrarla de un punto chico, la mitad de los intentos
                  // terminan en un clic.
                  draggable
                  onDragStart={(e) => {
                    setMoviendo(img.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => {
                    setMoviendo(null);
                    setSobre(null);
                  }}
                  onDragOver={(e) => {
                    if (!moviendo) return;
                    e.preventDefault();
                    setSobre(i);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    // Lo que se ve es lo que queda: la lista de la vista previa
                    // ya está en el orden final.
                    aplicar(vista.map((x, posicion) => ({ ...x, posicion })));
                    setMoviendo(null);
                    setSobre(null);
                  }}
                  className={`group relative aspect-square overflow-hidden rounded-md border bg-muted ${
                    i === 0 ? "col-span-2 row-span-2" : ""
                  } ${moviendo === img.id ? "opacity-50 ring-2 ring-primary" : ""}`}
                >
                  {/* Clic para editar, arrastre para mover: son los dos gestos
                      que se hacen sobre una foto y cada uno tiene el suyo. El
                      navegador distingue solo — un clic no dispara `dragstart`. */}
                  <button
                    type="button"
                    onClick={() => setRecortando(img)}
                    className="block h-full w-full cursor-pointer"
                    aria-label={`Editar ${img.nombre}`}
                  >
                    <Image
                      src={img.url}
                      alt={img.alt ?? ""}
                      fill
                      sizes={i === 0 ? "300px" : "150px"}
                      className="object-cover"
                      unoptimized
                      draggable={false}
                    />
                  </button>
                  {i === 0 && (
                    <span className="pointer-events-none absolute left-1 top-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-medium">
                      Principal
                    </span>
                  )}
                  {/* El asa: no hace falta para arrastrar —se arrastra de
                      cualquier lado— pero es lo que dice que se puede. */}
                  <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-black/50 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100">
                    <GripVertical className="h-3.5 w-3.5" />
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1 h-6 w-6 bg-black/50 text-white opacity-0 transition-opacity hover:bg-black/70 hover:text-white group-hover:opacity-100"
                    aria-label="Sacar del producto"
                    onClick={() => quitar(img.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
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
          // Los elegidos enteros y no sus ids: hace falta la url para
          // dibujarlos antes de guardar.
          onElegirItems={(items) => {
            setEligiendo(false);
            agregar(items);
          }}
        />
      )}
    </>
  );
}
