"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Search, Upload } from "lucide-react";

/** "JPG", "PNG": lo que va debajo del nombre, sacado de su extensión. */
function tipoDeArchivo(nombre: string): string {
  const ext = nombre.split(".").pop();
  return ext && ext.length <= 5 && ext !== nombre ? ext.toUpperCase() : "Imagen";
}

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
  titulo,
  elegidasIniciales,
  permiteNinguna = false,
  nota,
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
  /** "Elegir foto" para la variante; sin esto, según `unaSola`. */
  titulo?: string;
  /**
   * Las que ya están elegidas al abrir: la foto actual de una variante, o
   * las del producto cuando se abre desde el + de la ficha en el teléfono.
   */
  elegidasIniciales?: string[];
  /**
   * Si *Listo* vale sin nada marcado: para la variante, desmarcar es
   * volver a mostrar la principal, y eso también es una elección.
   */
  permiteNinguna?: boolean;
  /** Un renglón chico al pie, para decir qué pasa con lo elegido. */
  nota?: string;
}) {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [pedida, setPedida] = useState<string | null>(null);
  const [elegidas, setElegidas] = useState<string[]>(() => elegidasIniciales ?? []);
  const [subiendo, setSubiendo] = useState(false);
  /** Cuántos `dragenter` sin su `dragleave`: los hijos disparan los suyos. */
  const [arrastrando, setArrastrando] = useState(0);

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

  const subir = async (files: File[]) => {
    const imagenes = files.filter((f) => f.type.startsWith("image/"));
    if (imagenes.length === 0) return;
    setSubiendo(true);
    try {
      const nuevas = await subirALaBiblioteca(imagenes);
      setItems((prev) => [...nuevas, ...(prev ?? [])]);
      // Lo recién subido queda elegido: es a lo que venía quien sube desde acá.
      setElegidas((prev) =>
        unaSola ? nuevas.slice(0, 1).map((m) => m.id) : [...prev, ...nuevas.map((m) => m.id)]
      );
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
      {/* La forma del *Select file* de Shopify —y del selector de fotos del
          informe—: alto fijo para que la grilla no haga saltar el modal, el
          buscador arriba, la zona de subir, las miniaturas con su casilla y
          el nombre debajo, y Cancelar / Listo al pie. El drop se escucha en
          todo el modal: apuntarle a un recuadro chico mientras se arrastra es
          más trabajo del que vale. */}
      <DialogContent
        pantallaCompletaEnMovil
        className="flex flex-col gap-0 p-0 sm:max-w-5xl md:h-[min(85vh,40rem)]"
        onDragEnter={(e) => {
          e.preventDefault();
          setArrastrando((n) => n + 1);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setArrastrando((n) => Math.max(0, n - 1))}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(0);
          void subir(Array.from(e.dataTransfer.files ?? []));
        }}
      >
        <div className="flex flex-none items-center gap-2 px-5 pt-4 pb-3">
          <DialogTitle className="flex-1 text-lg font-semibold">
            {titulo ?? `Elegir ${unaSola ? "archivo" : "archivos"}`}
          </DialogTitle>
        </div>

        <div className="flex-none px-5 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar archivos"
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-5">
          <div
            className={`mb-3 flex flex-none flex-col items-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors ${
              arrastrando > 0 ? "border-primary bg-primary/5" : "border-muted-foreground/25"
            }`}
          >
            {/* El input escondido se dispara desde el botón, y no envuelto en
                un `<label>`: ahí el botón tenía que dibujarse como `<span>`
                para no tragarse el clic, y un span no es un botón — se pierde
                el foco y el Enter, y Base UI avisa con razón. */}
            <input
              ref={archivo}
              type="file"
              accept="image/*"
              multiple={!unaSola}
              className="hidden"
              onChange={(e) => void subir(Array.from(e.target.files ?? []))}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={subiendo}
              onClick={() => archivo.current?.click()}
            >
              {subiendo ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-1.5 h-4 w-4" />
              )}
              {subiendo ? "Subiendo…" : "Subir"}
            </Button>
            <p className="text-xs text-muted-foreground">
              {arrastrando > 0
                ? "Suelta las imágenes aquí"
                : "O arrastra imágenes de tu computadora"}
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pb-3">
            {items === null ? (
              <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando…
              </p>
            ) : items.length === 0 ? (
              /* El vacío de Shopify: la lupa, qué pasa y subir como la acción
                 principal. Con una búsqueda, lo que no hay es coincidencias. */
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <Search className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.5} />
                <p className="mt-2 text-lg font-semibold">
                  {busqueda ? "Sin resultados" : "La biblioteca está vacía"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {busqueda
                    ? "Prueba con otro nombre, o sube una imagen nueva."
                    : "Sube la primera imagen."}
                </p>
                <Button
                  type="button"
                  className="mt-2"
                  disabled={subiendo}
                  onClick={() => archivo.current?.click()}
                >
                  {subiendo ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Subir imagen
                </Button>
              </div>
            ) : (
              // Columnas de ancho fijo, las que entren: las miniaturas miden
              // siempre lo mismo en vez de agrandarse para llenar el hueco.
              <div className="grid grid-cols-[repeat(auto-fill,9.25rem)] justify-start gap-3">
                {items.map((m) => {
                  const usada = yaUsadas.includes(m.id);
                  const elegida = elegidas.includes(m.id);
                  return (
                    /* La casilla y la foto son dos controles hermanos que
                       hacen lo mismo: marcar. Una que ya está en el producto
                       se ve atenuada y no se puede volver a elegir. */
                    <div
                      key={m.id}
                      className={`relative rounded-lg border p-2 transition-colors ${
                        elegida ? "border-primary bg-primary/5" : "border-border"
                      } ${usada ? "opacity-50" : ""}`}
                      title={usada ? "Ya está en este producto" : undefined}
                    >
                      <button
                        type="button"
                        disabled={usada}
                        onClick={() => alternar(m.id)}
                        className="relative block aspect-square w-full overflow-hidden rounded-md border bg-muted"
                        title={usada ? "Ya está en este producto" : elegida ? "Desmarcar" : "Marcar"}
                      >
                        <Image
                          src={m.url}
                          alt={m.alt ?? ""}
                          fill
                          sizes="150px"
                          className="object-cover"
                          unoptimized
                        />
                      </button>
                      <span className="absolute top-3.5 left-3.5">
                        <Checkbox
                          checked={elegida || usada}
                          disabled={usada}
                          onCheckedChange={() => alternar(m.id)}
                          className="bg-card"
                          aria-label={elegida ? "Desmarcar" : "Marcar"}
                        />
                      </span>
                      <p className="mt-1.5 truncate text-center text-xs font-medium" title={m.nombre}>
                        {m.nombre}
                      </p>
                      <p className="truncate text-center text-[11px] text-muted-foreground">
                        {tipoDeArchivo(m.nombre)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-none items-center justify-between gap-2 border-t px-5 py-3">
          <span className="text-xs text-muted-foreground">
            {nota ??
              (elegidas.length > 0 &&
                `${elegidas.length} ${elegidas.length === 1 ? "marcada" : "marcadas"}`)}
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
              disabled={elegidas.length === 0 && !permiteNinguna}
            >
              Listo
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
