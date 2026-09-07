"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichText } from "@/components/ui/rich-text";
import { ArrowLeft, ImageOff, Plus, X } from "lucide-react";
import { useRegistrarCambios } from "@/components/shared/cambios-pendientes";
import { MediaLibrary, type MediaItem } from "./media-library";
import { SelectorProductos, type ProductoElegible } from "./selector-productos";
import { useAca } from "@/lib/filtros-url";

export interface CategoriaDetalle {
  id: string;
  nombre: string;
  orden: number;
  descripcion: string | null;
  imagen: { id: string; url: string; alt: string | null; nombre: string } | null;
  productos: ProductoElegible[];
}

const TIPO_LABEL: Record<string, string> = {
  SERVICIO: "Servicio",
  BIEN: "Bien",
};

/**
 * La ficha de una categoría.
 *
 * Existe porque agrupar el catálogo se hace **desde la categoría**, no producto
 * por producto: poner doce plantas en "Interior" abriendo doce fichas es el
 * camino largo del mismo trabajo. Acá se ven las que tiene y se suman las que
 * faltan.
 *
 * Los productos se agregan y se sacan **en el momento**, sin pasar por la barra
 * de guardar: es una relación, no un campo, y verla cambiar es lo que dice si
 * la categoría quedó como se quería. El nombre, la descripción y la foto sí van
 * por la barra, como en el resto del portal.
 */
export function CategoriaDetail({
  categoria: inicial,
  backHref,
}: {
  categoria: CategoriaDetalle;
  backHref: string;
}) {
  const router = useRouter();
  const from = useAca();
  const [guardando, setGuardando] = useState(false);
  const [eligiendoFoto, setEligiendoFoto] = useState(false);
  const [agregando, setAgregando] = useState(false);
  const [productos, setProductos] = useState(inicial.productos);
  const [imagen, setImagen] = useState(inicial.imagen);

  const guardado = {
    nombre: inicial.nombre,
    descripcion: inicial.descripcion ?? "",
    mediaId: inicial.imagen?.id ?? null,
  };
  const [form, setForm] = useState(guardado);

  // Lo que el servidor devolvió manda: sin esto la barra quedaba prendida
  // después de guardar, sobre una diferencia que ya no existía.
  const [ultimo, setUltimo] = useState(() => JSON.stringify(guardado));
  const actual = JSON.stringify(guardado);
  if (actual !== ultimo) {
    setUltimo(actual);
    setForm(guardado);
    setImagen(inicial.imagen);
  }

  const hayCambios =
    form.nombre !== guardado.nombre ||
    form.descripcion !== guardado.descripcion ||
    form.mediaId !== guardado.mediaId;

  const guardar = async () => {
    if (!form.nombre.trim()) {
      toast.error("La categoría necesita un nombre");
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch(`/api/categorias/${inicial.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          orden: inicial.orden,
          descripcion: form.descripcion,
          mediaId: form.mediaId,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error al guardar");
      toast.success("Categoría actualizada");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setGuardando(false);
    }
  };

  useRegistrarCambios(hayCambios, guardando, guardar, () => {
    setForm(guardado);
    setImagen(inicial.imagen);
  });

  const agregar = async (productoIds: string[]) => {
    setAgregando(false);
    if (productoIds.length === 0) return;
    try {
      const res = await fetch(`/api/categorias/${inicial.id}/productos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productoIds }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error");
      setProductos(body.productos);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos agregarlos");
    }
  };

  const quitar = async (productoId: string) => {
    const previos = productos;
    setProductos(productos.filter((p) => p.id !== productoId));
    try {
      const res = await fetch(
        `/api/categorias/${inicial.id}/productos/${productoId}`,
        { method: "DELETE" }
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error");
      setProductos(body.productos);
      router.refresh();
    } catch (e) {
      setProductos(previos);
      toast.error(e instanceof Error ? e.message : "No pudimos sacarlo");
    }
  };

  const elegirFoto = (elegidas: MediaItem[]) => {
    setEligiendoFoto(false);
    const foto = elegidas[0];
    if (!foto) return;
    setImagen({ id: foto.id, url: foto.url, alt: foto.alt, nombre: foto.nombre });
    setForm({ ...form, mediaId: foto.id });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={backHref}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="min-w-0 truncate text-2xl font-bold tracking-tight">
          {form.nombre || "Sin nombre"}
        </h1>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre *</Label>
                <Input
                  id="nombre"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Descripción</Label>
                <RichText
                  value={form.descripcion}
                  onChange={(html) => setForm({ ...form, descripcion: html })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Agregar va **en la misma card** que la lista: sumar un producto y
              ver que entró son el mismo gesto, y el botón en el encabezado de
              la página lo separaba de su resultado. */}
          <Card>
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">
                Productos
                <span className="ml-2 font-normal text-muted-foreground">
                  {productos.length}
                </span>
              </CardTitle>
              <CardAction>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAgregando(true)}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Agregar productos
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="p-0">
              {productos.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">
                  Todavía no hay ningún producto en esta categoría.
                </p>
              ) : (
                <ul className="divide-y">
                  {productos.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                      <Miniatura url={p.imagenUrl} />
                      <Link
                        href={`/dashboard/productos/${p.id}?from=${from}`}
                        className="min-w-0 flex-1"
                      >
                        <span className="block truncate text-sm font-medium hover:underline">
                          {p.nombre}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {TIPO_LABEL[p.tipo] ?? p.tipo}
                          {p.estado === "BORRADOR" && " · Borrador"}
                        </span>
                      </Link>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Sacar ${p.nombre} de la categoría`}
                        onClick={() => quitar(p.id)}
                      >
                        <X className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="border-b py-3">
            <CardTitle className="text-base">Foto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {imagen ? (
              <div className="relative aspect-square overflow-hidden rounded-md border bg-muted">
                <Image
                  src={imagen.url}
                  alt={imagen.alt ?? ""}
                  fill
                  sizes="300px"
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-md border border-dashed bg-muted/40 text-muted-foreground">
                <ImageOff className="h-6 w-6" />
              </div>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setEligiendoFoto(true)}
              >
                {imagen ? "Cambiar" : "Elegir de la biblioteca"}
              </Button>
              {imagen && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setImagen(null);
                    setForm({ ...form, mediaId: null });
                  }}
                >
                  Sacar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {eligiendoFoto && (
        <MediaLibrary
          yaUsadas={[]}
          unaSola
          onCerrar={() => setEligiendoFoto(false)}
          onElegirItems={elegirFoto}
        />
      )}

      {agregando && (
        <SelectorProductos
          categoriaId={inicial.id}
          onCerrar={() => setAgregando(false)}
          onElegir={agregar}
        />
      )}
    </div>
  );
}

function Miniatura({ url }: { url: string | null }) {
  return (
    <div className="relative h-9 w-9 flex-none overflow-hidden rounded border bg-muted">
      {url ? (
        <Image src={url} alt="" fill sizes="36px" className="object-cover" unoptimized />
      ) : (
        <span className="flex h-full items-center justify-center text-muted-foreground">
          <ImageOff className="h-3.5 w-3.5" />
        </span>
      )}
    </div>
  );
}
