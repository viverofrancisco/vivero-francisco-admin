"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, Loader2, Search, Upload } from "lucide-react";

export interface MediaItem {
  id: string;
  url: string;
  nombre: string;
  alt: string | null;
  usos: number;
}

/**
 * Sube archivos a la biblioteca en dos pasos.
 *
 * Se piden URLs firmadas, el navegador manda cada archivo **directo a R2**, y
 * recién ahí se confirma. Un archivo grande nunca pasa por nuestro servidor.
 * El que falla se saltea: perder una foto no tiene por qué tirar las otras
 * cuatro que ya llegaron bien.
 */
export async function subirALaBiblioteca(files: File[]): Promise<MediaItem[]> {
  const elegidos = files.filter((f) => f.type.startsWith("image/"));
  if (elegidos.length === 0) {
    throw new Error("Solo se pueden subir imágenes");
  }

  const res = await fetch("/api/media", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      files: elegidos.map((f) => ({ fileName: f.name, contentType: f.type })),
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Error");

  const llegados: { key: string; nombre: string; contentType: string }[] = [];
  for (const [i, up] of body.uploads.entries()) {
    const r = await fetch(up.uploadUrl, {
      method: "PUT",
      body: elegidos[i],
      headers: { "Content-Type": elegidos[i].type },
    });
    if (r.ok) {
      llegados.push({
        key: up.key,
        nombre: elegidos[i].name,
        contentType: elegidos[i].type,
      });
    }
  }
  if (llegados.length === 0) throw new Error("No pudimos subir las fotos");

  const conf = await fetch("/api/media", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ archivos: llegados }),
  });
  const guardadas = await conf.json();
  if (!conf.ok) throw new Error(guardadas.error ?? "Error");
  if (llegados.length < elegidos.length) {
    toast.warning(`${llegados.length} de ${elegidos.length}: alguna no subió`);
  }
  return guardadas.media;
}

/**
 * La biblioteca, para elegir imágenes que ya existen.
 *
 * Es lo que evita subir la misma foto dos veces: el abono en su ficha y en la
 * del combo que lo incluye es **un** archivo, no dos objetos en R2 que después
 * se desincronizan cuando alguien renombra uno.
 *
 * Se puede subir desde acá también: quien vino a elegir y no encuentra lo que
 * busca no tiene por qué cerrar y empezar de nuevo.
 */
export function MediaLibrary({
  yaUsadas,
  onElegir,
  onElegirItems,
  unaSola,
  onCerrar,
}: {
  /** Los `mediaId` que ya están en uso ahí: se marcan y no se pueden elegir. */
  yaUsadas: string[];
  onElegir?: (mediaIds: string[]) => void;
  /**
   * Los elegidos enteros, no solo sus ids. Lo usa quien necesita pintar la
   * imagen sin volver al servidor — la foto de una categoría, por ejemplo.
   */
  onElegirItems?: (items: MediaItem[]) => void;
  /** Una sola, para donde no hay galería sino una foto. */
  unaSola?: boolean;
  onCerrar: () => void;
}) {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [pedida, setPedida] = useState<string | null>(null);
  const [elegidas, setElegidas] = useState<string[]>([]);
  const [subiendo, setSubiendo] = useState(false);

  // Se dispara al renderizar con una búsqueda nueva en vez de con un efecto: no
  // hay dependencias que sincronizar ni un `setState` después de pintar.
  if (pedida !== busqueda) {
    setPedida(busqueda);
    fetch(`/api/media?q=${encodeURIComponent(busqueda)}`)
      .then((r) => r.json())
      .then((d) => setItems(d.media ?? []))
      .catch(() => setItems([]));
  }

  const archivo = useRef<HTMLInputElement>(null);

  const subir = async (files: FileList | null) => {
    if (!files?.length) return;
    setSubiendo(true);
    try {
      const nuevas = await subirALaBiblioteca([...files]);
      setItems((prev) => [...nuevas, ...(prev ?? [])]);
      // Lo recién subido queda elegido: es a lo que venía quien sube desde acá.
      setElegidas((prev) => [...prev, ...nuevas.map((m) => m.id)]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos subir");
    } finally {
      setSubiendo(false);
      // El input se limpia o elegir **el mismo archivo** otra vez no dispara
      // `change`: el valor no cambió, y para el navegador no pasó nada.
      if (archivo.current) archivo.current.value = "";
    }
  };

  const alternar = (id: string) =>
    setElegidas((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : unaSola
          ? [id]
          : [...prev, id]
    );

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Biblioteca</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre..."
                className="pl-9"
              />
            </div>
            {/* El input escondido se dispara desde el botón, y no envuelto en
                un `<label>`: ahí el botón tenía que dibujarse como `<span>`
                para no tragarse el clic, y un span no es un botón — se pierde
                el foco y el Enter, y Base UI avisa con razón. */}
            <input
              ref={archivo}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => subir(e.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              className="flex-none"
              disabled={subiendo}
              onClick={() => archivo.current?.click()}
            >
              {subiendo ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Subir
            </Button>
          </div>

          <div className="max-h-[50vh] overflow-y-auto">
            {items === null ? (
              <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando…
              </p>
            ) : items.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {busqueda
                  ? "Nada con ese nombre."
                  : "La biblioteca está vacía. Subí la primera foto."}
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {items.map((m) => {
                  const usada = yaUsadas.includes(m.id);
                  const elegida = elegidas.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={usada}
                      onClick={() => alternar(m.id)}
                      title={usada ? "Ya está en este producto" : m.nombre}
                      className={`group relative aspect-square overflow-hidden rounded-md border-2 bg-muted transition-colors ${
                        elegida
                          ? "border-primary"
                          : usada
                            ? "border-transparent opacity-40"
                            : "border-transparent hover:border-muted-foreground/40"
                      }`}
                    >
                      <Image
                        src={m.url}
                        alt={m.alt ?? ""}
                        fill
                        sizes="150px"
                        className="object-cover"
                        unoptimized
                      />
                      {(elegida || usada) && (
                        <span
                          className={`absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full ${
                            elegida
                              ? "bg-primary text-primary-foreground"
                              : "bg-background/90 text-muted-foreground"
                          }`}
                        >
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                      <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1 pt-4 text-left text-[10px] text-white">
                        {m.nombre}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t pt-4">
            <span className="text-xs text-muted-foreground">
              {elegidas.length > 0 &&
                `${elegidas.length} ${elegidas.length === 1 ? "elegida" : "elegidas"}`}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onCerrar}>
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  onElegir?.(elegidas);
                  onElegirItems?.(
                    elegidas
                      .map((id) => (items ?? []).find((m) => m.id === id))
                      .filter((m): m is MediaItem => Boolean(m))
                  );
                }}
                disabled={elegidas.length === 0}
              >
                {unaSola ? "Elegir" : "Agregar"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
