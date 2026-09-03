"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImagePlus, Loader2, Star, Trash2 } from "lucide-react";

export interface ImagenProducto {
  id: string;
  url: string;
  alt: string | null;
  posicion: number;
}

/**
 * La galería del producto.
 *
 * Las fotos son **del producto**, no de la variante: lo que una foto muestra
 * suele ser un eje solo —el color— así que colgarla de cada combinación
 * obligaría a subir la misma imagen una vez por talle. La variante elige cuál
 * de estas es la suya desde su propia fila.
 *
 * La primera es la que se usa cuando nadie eligió ninguna, y por eso se puede
 * mover: es la decisión que importa de todo el orden.
 */
export function ProductoImagenes({
  productoId,
  imagenes: iniciales,
  onCambio,
}: {
  productoId: string;
  imagenes: ImagenProducto[];
  /** Para que la tabla de variantes sepa qué fotos hay para elegir. */
  onCambio?: (imagenes: ImagenProducto[]) => void;
}) {
  const [imagenes, setImagenes] = useState(iniciales);
  const [subiendo, setSubiendo] = useState(false);
  const [borrando, setBorrando] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const aplicar = (nuevas: ImagenProducto[]) => {
    setImagenes(nuevas);
    onCambio?.(nuevas);
  };

  /**
   * Sube en dos pasos: se piden URLs firmadas, el navegador manda el archivo
   * directo a R2, y recién ahí se confirma. Un archivo grande nunca pasa por
   * nuestro servidor.
   */
  const subir = async (files: FileList) => {
    const elegidos = [...files].filter((f) => f.type.startsWith("image/"));
    if (elegidos.length === 0) return;
    setSubiendo(true);
    try {
      const res = await fetch(`/api/servicios/${productoId}/imagenes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: elegidos.map((f) => ({
            fileName: f.name,
            contentType: f.type,
          })),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error");

      const subidas: { key: string }[] = [];
      for (const [i, up] of body.uploads.entries()) {
        const r = await fetch(up.uploadUrl, {
          method: "PUT",
          body: elegidos[i],
          headers: { "Content-Type": elegidos[i].type },
        });
        // La que falla se saltea: perder una foto no tiene por qué tirar las
        // otras cuatro que ya llegaron bien.
        if (r.ok) subidas.push({ key: up.key });
      }
      if (subidas.length === 0) throw new Error("No pudimos subir las fotos");

      const conf = await fetch(`/api/servicios/${productoId}/imagenes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagenes: subidas }),
      });
      const guardadas = await conf.json();
      if (!conf.ok) throw new Error(guardadas.error ?? "Error");
      aplicar(guardadas.imagenes);
      toast.success(
        subidas.length === elegidos.length
          ? `${subidas.length} foto${subidas.length === 1 ? "" : "s"}`
          : `${subidas.length} de ${elegidos.length}: alguna no subió`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos subir");
    } finally {
      setSubiendo(false);
      if (input.current) input.current.value = "";
    }
  };

  const borrar = async (id: string) => {
    setBorrando(id);
    try {
      const res = await fetch(`/api/servicios/${productoId}/imagenes/${id}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error");
      aplicar(body.imagenes);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos borrarla");
    } finally {
      setBorrando(null);
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
    <Card>
      <CardHeader className="border-b py-3">
        <CardTitle className="text-base">Fotos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {imagenes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay fotos. La primera que subas es la que se muestra por
            defecto.
          </p>
        ) : (
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
                    aria-label="Borrar foto"
                    disabled={borrando !== null}
                    onClick={() => borrar(img.id)}
                  >
                    {borrando === img.id ? (
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

        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && subir(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={subiendo}
          onClick={() => input.current?.click()}
        >
          {subiendo ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ImagePlus className="mr-2 h-4 w-4" />
          )}
          Agregar fotos
        </Button>
      </CardContent>
    </Card>
  );
}
