"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  DialogFooter,
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
  X,
} from "lucide-react";
import { MAX_ARCHIVOS_POR_SUBIDA } from "@vivero/shared";

export interface ArchivoDeVisita {
  id: string;
  url: string;
  tipo: string;
  /** De qué tarea de la visita es. `null` = sin etiqueta. */
  tareaId: string | null;
}

interface TareaOpcion {
  tareaId: string;
  nombre: string;
}

/** El valor que representa "ninguna tarea" en los selects. */
const SIN_ETIQUETA = "__sin_etiqueta__";

/** Un archivo elegido que todavía no se subió. */
interface Pendiente {
  file: File;
  vista: string;
  tareaId: string | null;
}

/**
 * Los archivos de una visita: subir, cambiarles la tarea y borrar.
 *
 * Vive en la ficha de la visita y cada cambio sale solo. Las fotos se sacan
 * **mientras** se hace el trabajo: quien está en el jardín sube lo que lleva y
 * sigue, y no tendría por qué esperar a completar la visita ni a apretar
 * *Guardar cambios* en otra pantalla.
 *
 * **La etiqueta es una tarea**, no un producto: una foto de un jardín muestra
 * un trabajo, no algo que se vende. Y es lo que hace que el informe se arme
 * solo — sus secciones salen de las tareas hechas, y cada foto ya sabe a cuál
 * va.
 *
 * **Es un listado, no una grilla por secciones.** Había una sección por tarea,
 * con su propia zona para soltar, y la etiqueta se decía con el lugar: mover
 * una foto era arrastrarla a otra sección. Se veía bien con tres tareas y se
 * volvía una pared de recuadros punteados con diez, con el nombre largo de una
 * tarea recortado en el encabezado y media pantalla de zonas vacías esperando
 * que alguien suelte algo. Ahora cada foto es una fila —miniatura a la
 * izquierda, nombre de la tarea entero a la derecha— igual que en la app, que
 * es donde se suben de verdad.
 *
 * **La tarea se elige al subir, por archivo.** Una tanda trae la poda y el
 * riego mezclados, así que una etiqueta para todo sería mentira la mitad de las
 * veces; *Aplicar a todas* está igual, porque la otra mitad sí son de lo mismo.
 */
export function ArchivosVisita({
  visitaId,
  archivos,
  catalogo,
  hechas = [],
  puedeEditar,
}: {
  visitaId: string;
  archivos: ArchivoDeVisita[];
  /**
   * El catálogo de tareas. Las que **se hicieron en esta visita** van primero:
   * son las de las que va a haber fotos. El resto sigue disponible, porque en
   * el campo se fotografía lo que aparece —un problema de riego durante una
   * poda— y esa foto igual merece su sección en el informe.
   */
  catalogo: TareaOpcion[];
  /** Las que alguien cargó como hechas, para ponerlas arriba. */
  hechas?: string[];
  /** `PERSONAL` mira pero no toca, igual que con el resto de la visita. */
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [subiendo, setSubiendo] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [viendo, setViendo] = useState<MediaViewerSource | null>(null);
  /** El archivo que se está por mover, mientras el diálogo está abierto. */
  const [moviendo, setMoviendo] = useState<ArchivoDeVisita | null>(null);
  /** La tanda elegida, mientras se le pone tarea a cada una. */
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const nombreDe = useMemo(
    () => new Map(catalogo.map((t) => [t.tareaId, t.nombre])),
    [catalogo]
  );
  const seHizo = new Set(hechas);

  /** Las de la visita primero: son de las que va a haber fotos. */
  const destinos = [
    ...catalogo
      .filter((t) => seHizo.has(t.tareaId))
      .map((t) => ({ value: t.tareaId, label: t.nombre, hint: "De la visita" })),
    ...catalogo
      .filter((t) => !seHizo.has(t.tareaId))
      .map((t) => ({ value: t.tareaId, label: t.nombre })),
    { value: SIN_ETIQUETA, label: "Sin etiquetar" },
  ];

  /**
   * En el orden del catálogo, con las que no tienen tarea al final: es donde se
   * las busca para arreglarlas. Agrupar con encabezados sería repetir el mismo
   * nombre que ya lleva cada fila.
   */
  const enFila = useMemo(() => {
    const posicion = new Map(catalogo.map((t, i) => [t.tareaId, i]));
    const lugar = (a: ArchivoDeVisita) =>
      a.tareaId ? (posicion.get(a.tareaId) ?? 9e3) : 9e6;
    return [...archivos].sort((a, b) => lugar(a) - lugar(b));
  }, [archivos, catalogo]);

  const faltanTareas = pendientes.filter((p) => p.tareaId === null).length;

  // Las miniaturas de la tanda son URLs de objeto: si no se revocan, el
  // navegador se queda con el archivo entero en memoria.
  useEffect(() => {
    return () => {
      for (const p of pendientes) URL.revokeObjectURL(p.vista);
    };
    // Solo al desmontar: revocar en cada cambio rompería las que siguen vivas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function elegir(lista: FileList | File[]) {
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
    setPendientes(
      entran.map((file) => ({
        file,
        vista: URL.createObjectURL(file),
        tareaId: null,
      }))
    );
  }

  function cerrarTanda() {
    for (const p of pendientes) URL.revokeObjectURL(p.vista);
    setPendientes([]);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function subir() {
    if (pendientes.length === 0 || faltanTareas > 0) return;
    setSubiendo(true);
    try {
      const presign = await fetch(`/api/visitas/${visitaId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: pendientes.map((p) => ({
            fileName: p.file.name,
            contentType: p.file.type,
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
            body: pendientes[i].file,
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
          files: uploads.map((u: { key: string; tipo: string }, i: number) => ({
            key: u.key,
            tipo: u.tipo,
            tareaId:
              pendientes[i].tareaId === SIN_ETIQUETA
                ? null
                : pendientes[i].tareaId,
          })),
        }),
      });
      if (!confirmar.ok) throw new Error("No pudimos guardar los archivos");

      toast.success(
        pendientes.length === 1
          ? "Archivo agregado"
          : `${pendientes.length} archivos agregados`
      );
      cerrarTanda();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al subir");
    } finally {
      setSubiendo(false);
    }
  }

  async function mover(mediaId: string, destino: string) {
    setOcupado(mediaId);
    try {
      const res = await fetch(`/api/visitas/${visitaId}/media/${mediaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tareaId: destino === SIN_ETIQUETA ? null : destino,
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

  // Sin permiso y sin archivos no hay nada que mostrar.
  if (!puedeEditar && archivos.length === 0) return null;

  /** Soltar archivos sobre la tarjeta abre la misma tanda que el botón. */
  const zona = puedeEditar
    ? {
        onDragOver: (e: React.DragEvent) => {
          e.preventDefault();
          setArrastrando(true);
        },
        onDragLeave: (e: React.DragEvent) => {
          if (e.currentTarget === e.target) setArrastrando(false);
        },
        onDrop: (e: React.DragEvent) => {
          e.preventDefault();
          setArrastrando(false);
          if (e.dataTransfer.files?.length) elegir(e.dataTransfer.files);
        },
      }
    : {};

  return (
    <Card className="overflow-visible">
      <CardHeader className="border-b py-3">
        <CardTitle className="text-base">Archivos</CardTitle>
        {puedeEditar && (
          <CardAction>
            <Button
              size="sm"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={subiendo}
            >
              <Plus className="mr-2 h-3.5 w-3.5" />
              Agregar
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && elegir(e.target.files)}
        />

        <div
          {...zona}
          className={`rounded-md transition-colors ${
            arrastrando ? "bg-primary/5 ring-1 ring-primary" : ""
          }`}
        >
          {enFila.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {puedeEditar
                ? "Sin archivos. Arrastra fotos aquí o usa Agregar."
                : "Sin archivos"}
            </p>
          ) : (
            <ul className="divide-y">
              {enFila.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2">
                  <button
                    type="button"
                    onClick={() => setViendo({ url: a.url, tipo: a.tipo })}
                    title="Ver en grande"
                    className="relative h-12 w-12 flex-none overflow-hidden rounded bg-muted"
                  >
                    {a.tipo === "video" ? (
                      <>
                        <video
                          src={a.url}
                          muted
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <Play className="h-4 w-4 fill-white text-white" />
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

                  {/* Entero: el nombre de la tarea es lo único que dice de qué
                      es la foto, y recortado no distingue una de otra. */}
                  <span
                    className={`min-w-0 flex-1 text-sm ${
                      a.tareaId ? "" : "text-muted-foreground"
                    }`}
                  >
                    {a.tareaId
                      ? (nombreDe.get(a.tareaId) ?? "Otra tarea")
                      : "Sin etiquetar"}
                  </span>

                  {puedeEditar && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button
                            type="button"
                            aria-label="Opciones del archivo"
                            className="flex h-8 w-8 flex-none items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
                          />
                        }
                      >
                        {ocupado === a.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <MoreVertical className="h-4 w-4" />
                        )}
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {/* Mover = cambiar la etiqueta. Va a un diálogo con
                            buscador: los destinos son todo el catálogo. */}
                        <DropdownMenuItem onClick={() => setMoviendo(a)}>
                          <FolderInput className="mr-2 h-4 w-4" />
                          Cambiar tarea…
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
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>

      {/* La tanda recién elegida: cada archivo con su tarea antes de subir. */}
      <Dialog
        open={pendientes.length > 0}
        onOpenChange={(v) => !v && !subiendo && cerrarTanda()}
      >
        <DialogContent className="sm:max-w-lg" pantallaCompletaEnMovil>
          <DialogHeader>
            <DialogTitle>
              {pendientes.length === 1
                ? "¿De qué es esta foto?"
                : `¿De qué son estas ${pendientes.length} fotos?`}
            </DialogTitle>
          </DialogHeader>

          {pendientes.length > 1 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Aplicar a todas</p>
              <CustomSelect
                value=""
                onChange={(v) =>
                  setPendientes((antes) =>
                    antes.map((p) => ({ ...p, tareaId: v }))
                  )
                }
                options={destinos}
                placeholder="Elegir una tarea para todas..."
                searchable
                searchPlaceholder="Buscar tarea..."
              />
            </div>
          )}

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            {pendientes.map((p, i) => (
              <div key={p.vista} className="flex items-center gap-3">
                {p.file.type.startsWith("video/") ? (
                  <span className="flex h-12 w-12 flex-none items-center justify-center rounded bg-muted">
                    <Play className="h-4 w-4" />
                  </span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.vista}
                    alt=""
                    className="h-12 w-12 flex-none rounded object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <CustomSelect
                    value={p.tareaId ?? ""}
                    onChange={(v) =>
                      setPendientes((antes) =>
                        antes.map((x, j) => (j === i ? { ...x, tareaId: v } : x))
                      )
                    }
                    options={destinos}
                    placeholder="Elegir tarea..."
                    searchable
                    searchPlaceholder="Buscar tarea..."
                  />
                </div>
                <button
                  type="button"
                  aria-label="Sacar de la tanda"
                  onClick={() => {
                    URL.revokeObjectURL(p.vista);
                    setPendientes((antes) => antes.filter((_, j) => j !== i));
                  }}
                  className="flex h-8 w-8 flex-none items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={cerrarTanda} disabled={subiendo}>
              Cancelar
            </Button>
            <Button onClick={subir} disabled={subiendo || faltanTareas > 0}>
              {subiendo ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Subiendo…
                </>
              ) : faltanTareas > 0 ? (
                faltanTareas === 1 ? (
                  "Falta 1 tarea"
                ) : (
                  `Faltan ${faltanTareas} tareas`
                )
              ) : pendientes.length === 1 ? (
                "Subir foto"
              ) : (
                `Subir ${pendientes.length} fotos`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={moviendo !== null}
        onOpenChange={(v) => !v && setMoviendo(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cambiar tarea</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              De qué tarea es esta foto. Es lo que decide en qué sección del
              informe aparece.
            </p>
            <CustomSelect
              value={moviendo?.tareaId ?? SIN_ETIQUETA}
              onChange={(v) => {
                const archivo = moviendo;
                setMoviendo(null);
                if (archivo) void mover(archivo.id, v);
              }}
              options={destinos}
              placeholder="Buscar tarea..."
              searchable
              searchPlaceholder="Buscar tarea..."
            />
          </div>
        </DialogContent>
      </Dialog>

      <MediaViewer media={viendo} onClose={() => setViendo(null)} />
    </Card>
  );
}
