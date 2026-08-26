"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CustomSelect } from "@/components/ui/custom-select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MediaViewer, type MediaViewerSource } from "@/components/ui/media-viewer";
import { toast } from "sonner";
import {
  FolderInput,
  Loader2,
  MoreVertical,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import { MAX_ARCHIVOS_POR_SUBIDA } from "@vivero/shared";

export interface ArchivoDeVisita {
  id: string;
  url: string;
  tipo: string;
  /** De qué producto de la visita es. `null` = sin etiqueta. */
  productoId: string | null;
}

interface ProductoOpcion {
  productoId: string;
  nombre: string;
}

/** El grupo de los que no corresponden a ningún producto de la visita. */
const SIN_ETIQUETA = "__sin_etiqueta__";

/** Con qué viaja una foto que se arrastra de una sección a otra. */
const TIPO_ARRASTRE = "application/x-visita-media";

/**
 * Los archivos de una visita: subir, mover entre productos y borrar.
 *
 * Vive en la ficha de la visita y cada cambio sale solo. Las fotos se sacan
 * **mientras** se hace el trabajo: quien está en el jardín sube lo que lleva y
 * sigue, y no tendría por qué esperar a completar la visita ni a apretar
 * *Guardar cambios* en otra pantalla.
 *
 * **La etiqueta se dice con el lugar, no con un campo.** Hay una sección por
 * producto y se agrega dentro de la que corresponde; mover una foto es
 * mandarla a otra sección. Antes cada foto llevaba su propio desplegable con
 * el nombre del producto repetido debajo del encabezado que ya lo decía, más
 * un tercer selector arriba que fijaba con qué etiqueta entraban las nuevas:
 * tres controles para una sola idea.
 */
export function ArchivosVisita({
  visitaId,
  archivos,
  productos,
  catalogo,
  puedeEditar,
}: {
  visitaId: string;
  archivos: ArchivoDeVisita[];
  productos: ProductoOpcion[];
  /**
   * Todo el catálogo activo. Una foto puede ser de algo que no se agendó —un
   * problema de riego durante una poda— y esa etiqueta igual sirve al informe.
   */
  catalogo: ProductoOpcion[];
  /** `PERSONAL` mira pero no toca, igual que con el resto de la visita. */
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [subiendoEn, setSubiendoEn] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [arrastrandoEn, setArrastrandoEn] = useState<string | null>(null);
  const [viendo, setViendo] = useState<MediaViewerSource | null>(null);
  /** El archivo que se está por mover, mientras el diálogo está abierto. */
  const [moviendo, setMoviendo] = useState<ArchivoDeVisita | null>(null);
  /** El que se está arrastrando ahora, para atenuarlo. */
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /** A qué sección van los archivos que se están eligiendo. */
  const destinoRef = useRef<string | null>(null);

  const deLaVisita = new Set(productos.map((p) => p.productoId));
  const nombreDe = new Map(
    [...catalogo, ...productos].map((p) => [p.productoId, p.nombre])
  );
  const sueltos = archivos.filter((a) => !a.productoId);
  /** Etiquetados con algo que no se agendó: cada uno arma su propia sección. */
  const deOtros = [
    ...new Set(
      archivos
        .map((a) => a.productoId)
        .filter((id): id is string => !!id && !deLaVisita.has(id))
    ),
  ];

  /**
   * Una sección por producto de la visita —aunque no tenga fotos, porque es
   * donde se agregan—, después los de afuera que sí tengan, y siempre la de
   * sin etiquetar: es a donde se arrastra una foto para sacarle la etiqueta, y
   * una sección que no existe no puede recibir nada.
   */
  const grupos = [
    ...productos.map((p) => ({
      clave: p.productoId,
      titulo: p.nombre,
      archivos: archivos.filter((a) => a.productoId === p.productoId),
    })),
    ...deOtros.map((id) => ({
      clave: id,
      titulo: nombreDe.get(id) ?? "Otro producto",
      archivos: archivos.filter((a) => a.productoId === id),
    })),
    { clave: SIN_ETIQUETA, titulo: "Sin etiquetar", archivos: sueltos },
  ].filter((g) => puedeEditar || g.archivos.length > 0);

  /** Los destinos posibles, con lo de la visita primero. */
  const destinos = [
    ...productos.map((p) => ({
      value: p.productoId,
      label: p.nombre,
      hint: "De la visita",
    })),
    ...catalogo
      .filter((p) => !deLaVisita.has(p.productoId))
      .map((p) => ({
        value: p.productoId,
        label: p.nombre,
        hint: "Del catálogo",
      })),
    { value: SIN_ETIQUETA, label: "Sin etiquetar" },
  ];

  async function subir(destino: string, lista: FileList | File[]) {
    const todos = Array.from(lista);
    const validos = todos.filter(
      (f) => f.type.startsWith("image/") || f.type.startsWith("video/")
    );
    if (validos.length < todos.length) {
      const fuera = todos.length - validos.length;
      toast.error(
        validos.length === 0
          ? "Solo se pueden subir imágenes o videos"
          : `Se ${fuera === 1 ? "descartó 1 archivo" : `descartaron ${fuera} archivos`}: solo entran imágenes y videos`
      );
    }
    if (validos.length === 0) return;
    const entran = validos.slice(0, MAX_ARCHIVOS_POR_SUBIDA);
    if (entran.length < validos.length) {
      toast.error(`Se suben de a ${MAX_ARCHIVOS_POR_SUBIDA} archivos`);
    }

    setSubiendoEn(destino);
    try {
      const presign = await fetch(`/api/visitas/${visitaId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: entran.map((f) => ({
            fileName: f.name,
            contentType: f.type,
          })),
        }),
      });
      if (!presign.ok) throw new Error("No pudimos preparar la subida");
      const { uploads } = await presign.json();

      const subidas = await Promise.all(
        uploads.map((u: { uploadUrl: string; contentType: string }, i: number) =>
          fetch(u.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": u.contentType },
            body: entran[i],
          })
        )
      );
      if (subidas.some((r: Response) => !r.ok)) {
        throw new Error("No pudimos subir los archivos");
      }

      const confirmar = await fetch(`/api/visitas/${visitaId}/media`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: uploads.map((u: { key: string; tipo: string }) => ({
            key: u.key,
            tipo: u.tipo,
            productoId: destino === SIN_ETIQUETA ? null : destino,
          })),
        }),
      });
      if (!confirmar.ok) throw new Error("No pudimos guardar los archivos");

      toast.success(
        entran.length === 1
          ? "Archivo agregado"
          : `${entran.length} archivos agregados`
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al subir");
    } finally {
      setSubiendoEn(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function mover(mediaId: string, destino: string) {
    setOcupado(mediaId);
    try {
      const res = await fetch(`/api/visitas/${visitaId}/media/${mediaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productoId: destino === SIN_ETIQUETA ? null : destino,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos moverlo");
    } finally {
      setOcupado(null);
    }
  }

  async function borrar(mediaId: string) {
    setOcupado(mediaId);
    try {
      const res = await fetch(`/api/visitas/${visitaId}/media/${mediaId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      toast.success("Archivo eliminado");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos eliminarlo");
    } finally {
      setOcupado(null);
    }
  }

  function elegirArchivos(destino: string) {
    destinoRef.current = destino;
    inputRef.current?.click();
  }

  /**
   * Cada sección recibe dos cosas: archivos del escritorio, que se suben, y
   * fotos que ya están en otra sección, que se mueven. Es el mismo gesto para
   * los dos casos, así que es la misma zona.
   *
   * Para estrenar una sección que todavía no existe hay que usar *Mover a…*
   * una vez: sin fotos no hay sección, y sin sección no hay dónde soltar.
   */
  const zonaDe = (clave: string) =>
    puedeEditar
      ? {
          onDragOver: (e: React.DragEvent) => {
            e.preventDefault();
            setArrastrandoEn(clave);
          },
          onDragLeave: (e: React.DragEvent) => {
            if (e.currentTarget === e.target) setArrastrandoEn(null);
          },
          onDrop: (e: React.DragEvent) => {
            e.preventDefault();
            setArrastrandoEn(null);
            if (e.dataTransfer.files?.length) {
              void subir(clave, e.dataTransfer.files);
              return;
            }
            const mediaId = e.dataTransfer.getData(TIPO_ARRASTRE);
            // Soltarla donde ya estaba no es mover nada.
            if (mediaId && grupoDe(mediaId) !== clave) void mover(mediaId, clave);
          },
        }
      : {};

  /** En qué sección está hoy un archivo, para no moverlo a la misma. */
  function grupoDe(mediaId: string) {
    const a = archivos.find((x) => x.id === mediaId);
    return a?.productoId ?? SIN_ETIQUETA;
  }

  // Sin permiso y sin archivos no hay nada que mostrar.
  if (!puedeEditar && archivos.length === 0) return null;

  return (
    <Card className="overflow-visible">
      <CardHeader className="border-b py-3">
        <CardTitle className="text-base">Archivos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const destino = destinoRef.current;
            if (destino && e.target.files) void subir(destino, e.target.files);
            destinoRef.current = null;
          }}
        />

        {grupos.map((grupo) => (
          <div key={grupo.clave} className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">
              {grupo.titulo}
            </p>
            <div
              {...zonaDe(grupo.clave)}
              className={`grid grid-cols-2 gap-2 rounded-md border border-dashed p-2 transition-colors sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 ${
                arrastrandoEn === grupo.clave
                  ? "border-primary bg-primary/5"
                  : "border-transparent"
              }`}
            >
              {grupo.archivos.map((a) => (
                <div
                  key={a.id}
                  draggable={puedeEditar}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(TIPO_ARRASTRE, a.id);
                    e.dataTransfer.effectAllowed = "move";
                    setArrastrando(a.id);
                  }}
                  onDragEnd={() => {
                    setArrastrando(null);
                    setArrastrandoEn(null);
                  }}
                  className={`group relative aspect-square ${
                    puedeEditar ? "cursor-grab active:cursor-grabbing" : ""
                  } ${arrastrando === a.id ? "opacity-40" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => setViendo({ url: a.url, tipo: a.tipo })}
                    title="Ver en grande"
                    className="block h-full w-full overflow-hidden rounded bg-muted"
                  >
                    {a.tipo === "video" ? (
                      <>
                        <video
                          src={a.url}
                          muted
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <Play className="h-5 w-5 fill-white text-white" />
                        </span>
                      </>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </button>

                  {puedeEditar && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button
                            type="button"
                            aria-label="Opciones del archivo"
                            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 data-[popup-open]:opacity-100"
                          />
                        }
                      >
                        {ocupado === a.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <MoreVertical className="h-3.5 w-3.5" />
                        )}
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {/* Mover = cambiar la etiqueta. Va a un diálogo con
                            buscador y no a una lista acá: los destinos son
                            todo el catálogo, no los dos de la visita. */}
                        <DropdownMenuItem onClick={() => setMoviendo(a)}>
                          <FolderInput className="mr-2 h-4 w-4" />
                          Mover a…
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => borrar(a.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ))}

              {/* Agregar dentro de la sección: dónde se suelta *es* la
                  etiqueta, así que no hace falta elegirla en ningún lado. */}
              {puedeEditar && (
                <button
                  type="button"
                  onClick={() => elegirArchivos(grupo.clave)}
                  disabled={subiendoEn !== null}
                  className="flex aspect-square flex-col items-center justify-center gap-1 rounded border border-dashed text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
                >
                  {subiendoEn === grupo.clave ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Plus className="h-5 w-5" />
                  )}
                  <span className="px-1 text-center text-[10px] leading-tight">
                    {subiendoEn === grupo.clave ? "Subiendo…" : "Agregar"}
                  </span>
                </button>
              )}
            </div>
          </div>
        ))}

        {puedeEditar && productos.length === 0 && (
          <p className="text-sm text-muted-foreground">
            La visita no tiene productos, así que no hay dónde clasificar los
            archivos.
          </p>
        )}
      </CardContent>

      <Dialog
        open={moviendo !== null}
        onOpenChange={(v) => !v && setMoviendo(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mover archivo</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              A qué producto o servicio corresponde.
            </p>
            <CustomSelect
              value={moviendo?.productoId ?? SIN_ETIQUETA}
              onChange={(v) => {
                const archivo = moviendo;
                setMoviendo(null);
                if (archivo) void mover(archivo.id, v);
              }}
              options={destinos}
              placeholder="Buscar producto o servicio..."
              searchable
              searchPlaceholder="Buscar producto o servicio..."
            />
          </div>
        </DialogContent>
      </Dialog>

      <MediaViewer media={viendo} onClose={() => setViendo(null)} />
    </Card>
  );
}
