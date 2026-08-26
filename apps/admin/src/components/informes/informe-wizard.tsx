"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  GripVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { nombreCliente } from "@vivero/shared";
import {
  MediaViewer,
  type MediaViewerSource,
} from "@/components/ui/media-viewer";
import { CustomSelect } from "@/components/ui/custom-select";
import { DatePicker } from "@/components/ui/date-picker";
import { hoyISOEcuador } from "@/lib/fechas";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Cliente {
  id: string;
  nombre: string;
  apellido: string | null;
  empresa: string | null;
}

interface VisitaParaInforme {
  id: string;
  fechaProgramada: string;
  estado: string;
  servicioNombre: string;
  fotosCount: number;
}

interface MediaPoolItem {
  id: string;
  url: string;
  visitaId: string;
  visitaFecha: string;
  /// Servicio de la visita con el que se etiquetó la foto, si lo tiene.
  productoId: string | null;
}

/** Con qué viaja una foto que se arrastra para reordenarla. */
const TIPO_FOTO = "application/x-foto";

/** Valor del selector para la sección sin producto detrás. */
const PERSONALIZADA = "__personalizada__";

/** Un producto del catálogo, para armar una sección con cualquiera. */
interface ProductoCatalogo {
  id: string;
  nombre: string;
  descripcion: string | null;
}

/** Servicio cubierto por las visitas seleccionadas. Origen de cada sección. */
interface ServicioParaSeccion {
  productoId: string;
  nombre: string;
  descripcion: string | null;
  visitasCount: number;
  fotosCount: number;
}

/**
 * Foto de una sección. O viene de una visita (`visitaMediaId`) o se subió
 * directo al informe (`key`). `url` siempre sirve para previsualizar.
 */
interface SeccionFotoDraft {
  uid: string;
  visitaMediaId: string | null;
  key: string | null;
  url: string;
}

interface SeccionDraft {
  tempId: string;
  /// Servicio que origina la sección. Null = sección personalizada.
  productoId: string | null;
  titulo: string;
  descripcion: string;
  fotos: SeccionFotoDraft[];
}

function fotoDeVisita(m: MediaPoolItem): SeccionFotoDraft {
  return { uid: `visita-${m.id}`, visitaMediaId: m.id, key: null, url: m.url };
}

function fotoSubida(key: string, url: string): SeccionFotoDraft {
  return { uid: `upload-${key}`, visitaMediaId: null, key, url };
}

interface FirmanteDraft {
  tempId: string;
  nombre: string;
  cedula: string;
}

interface InitialData {
  informeId: string;
  clienteId: string;
  titulo: string;
  /** La que sale impresa, `YYYY-MM-DD`. */
  fecha: string;
  visitaIds: string[];
  firmantes: Array<{ nombre: string; cedula: string | null }>;
  secciones: Array<{
    productoId: string | null;
    titulo: string;
    descripcion: string | null;
    fotos: Array<{
      visitaMediaId: string | null;
      key: string;
      url: string;
    }>;
  }>;
  pdfUrl?: string;
}

type WizardStep = 1 | 2 | 3 | 4 | 5;

interface SavedFirmante {
  id: string;
  nombre: string;
  cedula: string | null;
  isDefault: boolean;
}

export function InformeWizard({
  initial,
  defaultFirmantes,
  catalogo = [],
}: {
  initial?: InitialData;
  defaultFirmantes?: Array<{ nombre: string; cedula: string | null }>;
  /** Todo el catálogo activo, para secciones de algo que no se visitó. */
  catalogo?: ProductoCatalogo[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>(initial ? 3 : 1);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [serviciosDisponibles, setServiciosDisponibles] = useState<
    ServicioParaSeccion[]
  >([]);
  const [firmantesCatalog, setFirmantesCatalog] = useState<SavedFirmante[]>([]);
  const [clienteId, setClienteId] = useState<string | null>(
    initial?.clienteId ?? null
  );

  const [dateRange, setDateRange] = useState<{
    label: string;
    from: string | null;
    to: string | null;
  }>(() => quickRange("este-mes"));

  const [availableVisitas, setAvailableVisitas] = useState<VisitaParaInforme[]>([]);
  const [selectedVisitaIds, setSelectedVisitaIds] = useState<Set<string>>(
    new Set(initial?.visitaIds ?? [])
  );
  const [loadingVisitas, setLoadingVisitas] = useState(false);

  const [pool, setPool] = useState<MediaPoolItem[]>([]);
  const [titulo, setTitulo] = useState(initial?.titulo ?? "");
  const [secciones, setSecciones] = useState<SeccionDraft[]>(
    initial
      ? initial.secciones.map((s, i) => ({
          tempId: `existing-${i}`,
          productoId: s.productoId,
          titulo: s.titulo,
          descripcion: s.descripcion ?? "",
          fotos: s.fotos.map((f, j) => ({
            uid: f.visitaMediaId
              ? `visita-${f.visitaMediaId}`
              : `upload-${f.key || j}`,
            visitaMediaId: f.visitaMediaId,
            key: f.visitaMediaId ? null : f.key,
            url: f.url,
          })),
        }))
      : []
  );

  /**
   * La fecha que sale impresa. Arranca en hoy, que es lo más común, pero un
   * informe de agosto se puede estar armando en septiembre.
   */
  const [fecha, setFecha] = useState(initial?.fecha ?? hoyISOEcuador());

  const [firmantes, setFirmantes] = useState<FirmanteDraft[]>(() => {
    const initialFirmantes = initial?.firmantes ?? [];
    if (initialFirmantes.length > 0) {
      return initialFirmantes.map((f, i) => ({
        tempId: `existing-${i}`,
        nombre: f.nombre,
        cedula: f.cedula ?? "",
      }));
    }
    if (defaultFirmantes && defaultFirmantes.length > 0) {
      return defaultFirmantes.slice(0, 3).map((f, i) => ({
        tempId: `default-${i}`,
        nombre: f.nombre,
        cedula: f.cedula ?? "",
      }));
    }
    return [{ tempId: "1", nombre: "", cedula: "" }];
  });

  const [generating, setGenerating] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(initial?.pdfUrl ?? null);
  const [savedInformeId, setSavedInformeId] = useState<string | null>(
    initial?.informeId ?? null
  );

  const [addPhotosFor, setAddPhotosFor] = useState<string | null>(null);
  const [activeMedia, setActiveMedia] = useState<MediaViewerSource | null>(
    null
  );

  // Load clientes + tipos + firmantes catalog up front.
  useEffect(() => {
    void (async () => {
      try {
        const [cRes, fRes] = await Promise.all([
          fetch("/api/clientes", { cache: "no-store" }),
          fetch("/api/admin/firmantes", { cache: "no-store" }),
        ]);
        if (cRes.ok) setClientes(await cRes.json());
        if (fRes.ok) {
          const data: { items: SavedFirmante[] } = await fRes.json();
          setFirmantesCatalog(data.items);
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  // Step 1 → fetch visitas whenever cliente or date range changes.
  useEffect(() => {
    if (step !== 2 || !clienteId) return;
    setLoadingVisitas(true);
    const params = new URLSearchParams({ clienteId });
    if (dateRange.from) params.set("from", dateRange.from);
    if (dateRange.to) params.set("to", dateRange.to);
    fetch(`/api/admin/informes/visitas?${params.toString()}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data: { items: VisitaParaInforme[] }) => {
        setAvailableVisitas(data.items ?? []);
      })
      .catch(() => {})
      .finally(() => setLoadingVisitas(false));
  }, [step, clienteId, dateRange]);

  // Auto-suggest title when both cliente + date range known.
  useEffect(() => {
    if (titulo) return;
    const cliente = clientes.find((c) => c.id === clienteId);
    if (cliente && dateRange.from && dateRange.to) {
      const fecha = new Date(dateRange.from);
      const mes = fecha.toLocaleDateString("es-EC", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
      setTitulo(
        `Informe de Áreas Verdes — ${capitalize(mes)} — ${nombreCliente(cliente)}`.trim()
      );
    }
  }, [clientes, clienteId, dateRange, titulo]);

  // Load pool when entering step 2.
  useEffect(() => {
    if (step !== 2) return;
    const ids = Array.from(selectedVisitaIds);
    if (ids.length === 0) {
      setPool([]);
      return;
    }
    fetch("/api/admin/informes/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitaIds: ids }),
    })
      .then((r) => r.json())
      .then((data: { items: MediaPoolItem[] }) => {
        setPool(data.items ?? []);
      })
      .catch(() => {});
  }, [step, selectedVisitaIds]);

  /**
   * Ya se armaron las secciones solas. Volver al paso 2 y adelante no las
   * vuelve a armar: lo que hay en pantalla es lo que alguien dejó.
   */
  const autogeneradas = useRef(initial != null);

  // Los servicios que cubren las visitas seleccionadas son el catálogo de
  // secciones: título = nombre del servicio, descripción = la del servicio.
  useEffect(() => {
    if (step !== 3) return;
    const ids = Array.from(selectedVisitaIds);
    if (ids.length === 0) {
      setServiciosDisponibles([]);
      return;
    }
    /**
     * Las fotos se piden acá de nuevo, junto con los servicios.
     *
     * El paso 2 ya las trae, pero pasar rápido de un paso al otro dejaba las
     * secciones armadas y vacías: se generaban con el pool todavía en camino.
     * Pedirlas de nuevo cuesta una llamada y saca la carrera del medio.
     */
    Promise.all([
      fetch("/api/admin/informes/servicios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitaIds: ids }),
      }).then((r) => r.json()),
      fetch("/api/admin/informes/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitaIds: ids }),
      }).then((r) => r.json()),
    ])
      .then(([servicios, media]: [
        { items: ServicioParaSeccion[] },
        { items: MediaPoolItem[] },
      ]) => {
        const items = servicios.items ?? [];
        const fotosDelPool = media.items ?? [];
        setPool(fotosDelPool);
        setServiciosDisponibles(items);

        /**
         * Una sección por producto de las visitas elegidas, tengan fotos o no.
         *
         * Es lo que se hacía a mano, uno por uno, en el 100% de los informes:
         * el producto da el título y la descripción, y sus fotos etiquetadas
         * ya saben a qué sección van. Las que quedan vacías se llenan o se
         * borran de a una, que es menos trabajo que agregarlas de a una.
         *
         * Solo la primera vez: si ya hay secciones, son de alguien que las
         * tocó (o de un informe que se está editando) y no se pisan.
         */
        if (autogeneradas.current) return;
        autogeneradas.current = true;
        setSecciones((prev) => {
          if (prev.length > 0) return prev;
          const usadas = new Set<string>();
          return items.map((sv) => {
              const fotos = fotosDelPool.filter(
                (m) => m.productoId === sv.productoId && !usadas.has(m.id)
              );
              fotos.forEach((m) => usadas.add(m.id));
            return {
              tempId: `auto-${sv.productoId}`,
              productoId: sv.productoId,
              titulo: sv.nombre,
              descripcion: sv.descripcion ?? "",
              fotos: fotos.map(fotoDeVisita),
            };
          });
        });
      })
      .catch(() => {});
  }, [step, selectedVisitaIds]);

  const assignedIds = useMemo(() => {
    const set = new Set<string>();
    for (const s of secciones) {
      for (const f of s.fotos) {
        if (f.visitaMediaId) set.add(f.visitaMediaId);
      }
    }
    return set;
  }, [secciones]);

  const unassignedPool = useMemo(
    () => pool.filter((m) => !assignedIds.has(m.id)),
    [pool, assignedIds]
  );

  function nextFromStep1() {
    if (!clienteId) return toast.error("Selecciona un cliente");
    setStep(2);
  }

  function nextFromStep2() {
    if (selectedVisitaIds.size === 0)
      return toast.error("Selecciona al menos una visita");
    setStep(3);
  }

  function nextFromStep3() {
    if (!titulo.trim()) return toast.error("El título es obligatorio");
    if (secciones.length === 0)
      return toast.error("Agrega al menos una sección");
    setStep(4);
  }

  async function generate() {
    if (!clienteId) return;
    const validFirmantes = firmantes
      .map((f) => ({ nombre: f.nombre.trim(), cedula: f.cedula.trim() || null }))
      .filter((f) => f.nombre.length > 0);
    if (validFirmantes.length === 0) {
      return toast.error("Agrega al menos un firmante con nombre");
    }
    setGenerating(true);
    setPdfUrl(null);
    try {
      const url = savedInformeId
        ? `/api/admin/informes/${savedInformeId}`
        : "/api/admin/informes";
      const method = savedInformeId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId,
          titulo: titulo.trim(),
          visitaIds: Array.from(selectedVisitaIds),
          fecha,
      firmantes: validFirmantes,
          secciones: secciones.map((s) => ({
            productoId: s.productoId,
            titulo: s.titulo,
            descripcion: s.descripcion || null,
            fotos: s.fotos.map((f) =>
              f.visitaMediaId
                ? { visitaMediaId: f.visitaMediaId }
                : { key: f.key }
            ),
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Error generando informe");
      }
      const data: { id: string; pdfUrl: string } = await res.json();
      setSavedInformeId(data.id);
      setPdfUrl(data.pdfUrl);
      setStep(5);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error generando informe");
    } finally {
      setGenerating(false);
    }
  }

  // ──────────────── Render ────────────────

  const stepHeadings: Record<WizardStep, { title: string; description: string }> = {
    1: {
      title: "Cliente",
      description: "Escoge el cliente para el cual generar el informe.",
    },
    2: {
      title: "Visitas",
      description: "Selecciona las visitas a incluir.",
    },
    3: {
      title: "Componer secciones",
      description:
        "Arma las secciones del informe asignándole fotos del pool a cada una.",
    },
    4: {
      title: "Firma y fecha",
      description: "Con qué fecha sale el informe y quién lo firma.",
    },
    5: {
      title: "Vista previa",
      description: "Tu informe está listo. Descárgalo o compártelo.",
    },
  };

  const heading = stepHeadings[step];

  return (
    /* `h-full` y no un `calc` con la altura del header: el header no mide
       4rem —tiene la barra de búsqueda— así que el wizard sobresalía y la
       barra de Atrás/Continuar quedaba cortada abajo. */
    <div className="flex h-full flex-col bg-background">
      {/* Sticky top: step heading */}
      <div className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Paso {step} de 5
            </p>
            <h2 className="text-lg font-semibold truncate">{heading.title}</h2>
            <p className="text-sm text-muted-foreground truncate">
              {heading.description}
            </p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Vertical stepper */}
        <aside className="hidden md:block w-64 flex-none border-r bg-muted/20 px-4 py-6 overflow-y-auto">
          <VerticalStepper
            step={step}
            initial={!!initial}
            onJump={(s) => {
              if (initial || s <= step) setStep(s);
            }}
          />
        </aside>

        {/* Content + nav (right column) */}
        <main className="flex flex-1 min-w-0 flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
            {step === 1 ? (
              <Step1Cliente
                clientes={clientes}
                clienteId={clienteId}
                onClienteChange={(id) => {
                  setClienteId(id);
                  setSelectedVisitaIds(new Set());
                  setTitulo("");
                }}
              />
            ) : null}

            {step === 2 ? (
              <Step2Visitas
                cliente={clientes.find((c) => c.id === clienteId) ?? null}
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                visitas={availableVisitas}
                selectedIds={selectedVisitaIds}
                onToggle={(id) => {
                  setSelectedVisitaIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  });
                }}
                onSelectAll={(all) => {
                  if (all) {
                    setSelectedVisitaIds(
                      new Set(availableVisitas.map((v) => v.id))
                    );
                  } else {
                    setSelectedVisitaIds(new Set());
                  }
                }}
                loading={loadingVisitas}
              />
            ) : null}

            {step === 3 ? (
              <Step3Secciones
                titulo={titulo}
                onTituloChange={setTitulo}
                pool={unassignedPool}
                secciones={secciones}
                onSeccionesChange={setSecciones}
                productos={serviciosDisponibles}
                catalogo={catalogo}
                clienteId={clienteId}
                allPool={pool}
                addPhotosFor={addPhotosFor}
                setAddPhotosFor={setAddPhotosFor}
                onViewMedia={(url) =>
                  setActiveMedia({ url, tipo: "imagen" })
                }
              />
            ) : null}

            {step === 4 ? (
              <Step4Firmantes
                firmantes={firmantes}
                onChange={setFirmantes}
                catalog={firmantesCatalog}
                fecha={fecha}
                onFechaChange={setFecha}
              />
            ) : null}

            {step === 5 && pdfUrl ? (
              <Step5Preview pdfUrl={pdfUrl} titulo={titulo} />
            ) : null}
          </div>

          {/* Nav footer — only spans the right column. */}
          <div className="border-t bg-card px-6 py-3">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                disabled={step === 1 || generating}
                onClick={() =>
                  setStep((s) => (s > 1 ? ((s - 1) as WizardStep) : s))
                }
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Atrás
              </Button>
              {step === 1 ? (
                <Button onClick={nextFromStep1} disabled={!clienteId}>
                  Continuar <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : null}
              {step === 2 ? (
                <Button
                  onClick={nextFromStep2}
                  disabled={selectedVisitaIds.size === 0}
                >
                  Continuar <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : null}
              {step === 3 ? (
                <Button onClick={nextFromStep3}>
                  Continuar <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : null}
              {step === 4 ? (
                <Button onClick={generate} disabled={generating}>
                  {generating ? "Generando…" : "Generar PDF"}{" "}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : null}
              {step === 5 ? (
                <Button onClick={() => router.push("/dashboard/informes")}>
                  Volver al listado
                </Button>
              ) : null}
            </div>
          </div>
        </main>
      </div>

      <MediaViewer
        media={activeMedia}
        onClose={() => setActiveMedia(null)}
      />
    </div>
  );
}

function Step4Firmantes({
  firmantes,
  onChange,
  catalog,
  fecha,
  onFechaChange,
}: {
  firmantes: FirmanteDraft[];
  onChange: (next: FirmanteDraft[]) => void;
  catalog: SavedFirmante[];
  fecha: string;
  onFechaChange: (v: string) => void;
}) {
  function update(tempId: string, patch: Partial<FirmanteDraft>) {
    onChange(
      firmantes.map((f) => (f.tempId === tempId ? { ...f, ...patch } : f))
    );
  }
  function remove(tempId: string) {
    if (firmantes.length === 1) return;
    onChange(firmantes.filter((f) => f.tempId !== tempId));
  }
  function addFromCatalog(s: SavedFirmante) {
    if (firmantes.length >= 3) return;
    onChange([
      ...firmantes,
      {
        tempId: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nombre: s.nombre,
        cedula: s.cedula ?? "",
      },
    ]);
  }
  function add() {
    if (firmantes.length >= 3) return;
    onChange([
      ...firmantes,
      {
        tempId: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nombre: "",
        cedula: "",
      },
    ]);
  }
  function reorder(fromTempId: string, toTempId: string) {
    if (fromTempId === toTempId) return;
    const fromIdx = firmantes.findIndex((f) => f.tempId === fromTempId);
    const toIdx = firmantes.findIndex((f) => f.tempId === toTempId);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = [...firmantes];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    onChange(next);
  }

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragArmedId, setDragArmedId] = useState<string | null>(null);

  return (
    <div className="max-w-3xl space-y-5">
      {/* La fecha del documento, no la de cuándo se generó: esa se guarda
          igual y no se toca. */}
      <div className="space-y-1.5">
        <h3 className="text-base font-semibold">Fecha del informe</h3>
        <p className="text-sm text-muted-foreground">
          Es la que sale impresa. Regenerar el informe no la cambia.
        </p>
        <div className="w-56 pt-1">
          <DatePicker value={fecha} onChange={(v) => onFechaChange(v || fecha)} />
        </div>
      </div>

      <div>
        <h3 className="text-base font-semibold">Firmantes del informe</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Agrega entre 1 y 3 personas que firman este informe. La cédula es
          opcional y aparecerá debajo del nombre en el PDF.
        </p>
      </div>

      <div className="space-y-3">
        {firmantes.map((f) => {
          const isDragOver = dragOverId === f.tempId && draggingId !== f.tempId;
          const isDragging = draggingId === f.tempId;
          return (
            <div
              key={f.tempId}
              draggable={dragArmedId === f.tempId}
              onDragStart={(e) => {
                e.dataTransfer.setData("application/x-firmante", f.tempId);
                e.dataTransfer.effectAllowed = "move";
                setDraggingId(f.tempId);
              }}
              onDragEnd={() => {
                setDraggingId(null);
                setDragArmedId(null);
                setDragOverId(null);
              }}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes("application/x-firmante"))
                  return;
                e.preventDefault();
                setDragOverId(f.tempId);
              }}
              onDragLeave={(e) => {
                if (e.currentTarget === e.target) setDragOverId(null);
              }}
              onDrop={(e) => {
                const sourceId = e.dataTransfer.getData(
                  "application/x-firmante"
                );
                if (!sourceId) return;
                e.preventDefault();
                reorder(sourceId, f.tempId);
                setDragOverId(null);
              }}
              className={`relative rounded-xl transition-opacity ${
                isDragging ? "opacity-40" : ""
              }`}
            >
              {isDragOver ? (
                <div className="pointer-events-none absolute inset-x-2 -top-1 h-1 rounded-full bg-primary" />
              ) : null}
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onMouseDown={() => setDragArmedId(f.tempId)}
                      onMouseUp={() => setDragArmedId(null)}
                      onMouseLeave={() => setDragArmedId(null)}
                      className="mt-2 flex h-8 w-5 flex-none cursor-grab items-center justify-center text-muted-foreground hover:text-foreground active:cursor-grabbing"
                      title="Arrastra para reordenar"
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>
                    <div className="grid flex-1 gap-3 sm:grid-cols-[1fr_minmax(0,220px)]">
                      <div>
                        <label className="block text-xs text-muted-foreground">
                          Nombre
                        </label>
                        <Input
                          value={f.nombre}
                          onChange={(e) =>
                            update(f.tempId, { nombre: e.target.value })
                          }
                          placeholder="Nombre completo"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground">
                          Cédula{" "}
                          <span className="text-muted-foreground/60">
                            (opcional)
                          </span>
                        </label>
                        <Input
                          value={f.cedula}
                          onChange={(e) =>
                            update(f.tempId, { cedula: e.target.value })
                          }
                          placeholder="Ej. 0918637877"
                        />
                      </div>
                    </div>
                    {firmantes.length > 1 ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(f.tempId)}
                        title="Quitar firmante"
                        className="mt-5 flex-none text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>

      {firmantes.length < 3 ? (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" />}>
            <Plus className="h-4 w-4 mr-1" /> Agregar firmante{" "}
            <ChevronDown className="h-4 w-4 ml-1" />
          </DropdownMenuTrigger>
          {/* Ancho fijo: los nombres y la cédula debajo entran justos en el
              ancho del botón, y una lista de personas se lee mejor holgada. */}
          <DropdownMenuContent className="w-72">
            <DropdownMenuItem onClick={add}>
              Firmante nuevo
            </DropdownMenuItem>
            {catalog.length > 0 ? (
              <>
                <div className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Guardados
                </div>
                {catalog.map((s) => {
                  const alreadyAdded = firmantes.some(
                    (f) => f.nombre === s.nombre
                  );
                  return (
                    <DropdownMenuItem
                      key={s.id}
                      disabled={alreadyAdded}
                      onClick={() => addFromCatalog(s)}
                    >
                      <span className="flex flex-col items-start">
                        <span>{s.nombre}</span>
                        {s.cedula ? (
                          <span className="text-xs text-muted-foreground">
                            C.I. {s.cedula}
                          </span>
                        ) : null}
                      </span>
                    </DropdownMenuItem>
                  );
                })}
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

function VerticalStepper({
  step,
  onJump,
  initial,
}: {
  step: WizardStep;
  onJump: (s: WizardStep) => void;
  initial: boolean;
}) {
  const items: Array<{ n: WizardStep; label: string; description: string }> = [
    { n: 1, label: "Cliente", description: "Selecciona el cliente" },
    { n: 2, label: "Visitas", description: "Visitas a incluir" },
    { n: 3, label: "Componer secciones", description: "Asigna fotos a cada sección" },
    { n: 4, label: "Firma y fecha", description: "Fecha del informe y quién firma" },
    { n: 5, label: "Vista previa", description: "Descarga y comparte" },
  ];
  return (
    <ol className="space-y-1">
      {items.map((it, i) => {
        const completed = it.n < step;
        const current = it.n === step;
        const clickable = initial || it.n <= step;
        const isLast = i === items.length - 1;
        return (
          <li key={it.n} className="relative">
            {/* Connector line to next item */}
            {!isLast ? (
              <span
                className={`absolute left-4 top-9 bottom-[-4px] w-0.5 ${
                  it.n < step ? "bg-primary" : "bg-muted"
                }`}
                aria-hidden
              />
            ) : null}
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onJump(it.n)}
              className={`relative flex w-full items-start gap-3 rounded-md px-2 py-2 text-left transition-colors disabled:cursor-not-allowed ${
                current ? "bg-primary/5" : clickable ? "hover:bg-muted/40" : ""
              }`}
            >
              <span
                className={`flex h-8 w-8 flex-none items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors ${
                  completed
                    ? "border-primary bg-primary text-primary-foreground"
                    : current
                      ? "border-primary bg-card text-primary"
                      : "border-muted bg-card text-muted-foreground"
                }`}
              >
                {completed ? "✓" : it.n}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm leading-tight ${
                    current
                      ? "font-semibold text-foreground"
                      : completed
                        ? "font-medium text-foreground"
                        : "text-muted-foreground"
                  }`}
                >
                  {it.label}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground leading-tight">
                  {it.description}
                </p>
              </div>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

// ───────────── Step 1 ─────────────

function Step1Cliente({
  clientes,
  clienteId,
  onClienteChange,
}: {
  clientes: Cliente[];
  clienteId: string | null;
  onClienteChange: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clientes;
    const words = q.split(/\s+/).filter(Boolean);
    return clientes.filter((c) => {
      const full = nombreCliente(c).toLowerCase();
      return words.every((w) => full.includes(w));
    });
  }, [clientes, search]);

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cliente por nombre o apellido"
          className="pl-9"
          autoFocus
        />
      </div>

      {clientes.length === 0 ? (
        <EmptyState text="Cargando clientes…" />
      ) : filtered.length === 0 ? (
        <EmptyState text="Sin coincidencias." />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {filtered.map((c) => {
            const selected = clienteId === c.id;
            const initials = nombreCliente(c).slice(0, 2).toUpperCase();
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onClienteChange(c.id)}
                className={`flex items-center gap-3 rounded-md border px-3 py-3 text-left transition-colors ${
                  selected
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:bg-muted/30"
                }`}
              >
                <span
                  className={`flex h-9 w-9 flex-none items-center justify-center rounded-full text-sm font-semibold ${
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {initials || "?"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {nombreCliente(c)}
                  </p>
                </div>
                {selected ? (
                  <span className="text-xs font-medium text-primary">
                    Seleccionado
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Step2Visitas({
  cliente,
  dateRange,
  onDateRangeChange,
  visitas,
  selectedIds,
  onToggle,
  onSelectAll,
  loading,
}: {
  cliente: Cliente | null;
  dateRange: { label: string; from: string | null; to: string | null };
  onDateRangeChange: (r: {
    label: string;
    from: string | null;
    to: string | null;
  }) => void;
  visitas: VisitaParaInforme[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: (all: boolean) => void;
  loading: boolean;
}) {
  const [servicioFilter, setServicioFilter] = useState<string>("");
  const [estadoFilter, setEstadoFilter] = useState<string>("");
  const [fechaFilter, setFechaFilter] = useState<string>("");

  const servicioOptions = useMemo(() => {
    const set = new Set<string>();
    for (const v of visitas) {
      if (v.servicioNombre) set.add(v.servicioNombre);
    }
    return Array.from(set)
      .sort()
      .map((s) => ({ value: s, label: s }));
  }, [visitas]);

  const filtered = useMemo(() => {
    return visitas.filter((v) => {
      if (servicioFilter && v.servicioNombre !== servicioFilter) return false;
      if (estadoFilter && v.estado !== estadoFilter) return false;
      if (fechaFilter && v.fechaProgramada.slice(0, 10) !== fechaFilter)
        return false;
      return true;
    });
  }, [visitas, servicioFilter, estadoFilter, fechaFilter]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((v) => selectedIds.has(v.id));
  const isCustom = dateRange.label === "Personalizado";
  const hasInListFilters = !!(servicioFilter || estadoFilter || fechaFilter);

  return (
    <div className="space-y-5 max-w-4xl">
      {cliente ? (
        <div className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Cliente:</span>
          <span className="font-medium">
            {nombreCliente(cliente)}
          </span>
        </div>
      ) : null}

      <Card>
        <CardContent className="py-5">
          <label className="text-sm font-medium block mb-1.5">
            Rango de fechas
          </label>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["este-mes", "Este mes"],
                ["mes-pasado", "Mes pasado"],
                ["ultimos-30", "Últimos 30 días"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => onDateRangeChange(quickRange(key))}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  dateRange.label === label
                    ? "bg-primary text-primary-foreground"
                    : "border bg-card text-foreground hover:bg-muted/40"
                }`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() =>
                onDateRangeChange({
                  label: "Personalizado",
                  from: dateRange.from,
                  to: dateRange.to,
                })
              }
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                isCustom
                  ? "bg-primary text-primary-foreground"
                  : "border bg-card text-foreground hover:bg-muted/40"
              }`}
            >
              Personalizado
            </button>
          </div>
          {isCustom ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 max-w-md">
              <div>
                <label className="text-xs text-muted-foreground">Desde</label>
                <Input
                  type="date"
                  value={dateRange.from ?? ""}
                  onChange={(e) =>
                    onDateRangeChange({
                      label: "Personalizado",
                      from: e.target.value || null,
                      to: dateRange.to,
                    })
                  }
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Hasta</label>
                <Input
                  type="date"
                  value={dateRange.to ?? ""}
                  onChange={(e) =>
                    onDateRangeChange({
                      label: "Personalizado",
                      from: dateRange.from,
                      to: e.target.value || null,
                    })
                  }
                />
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="overflow-visible">
        <CardContent className="py-5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-semibold">Visitas disponibles</h3>
              {!loading ? (
                <p className="text-xs text-muted-foreground">
                  {visitas.length} total · {filtered.length} en vista ·{" "}
                  <span className="font-medium text-foreground">
                    {selectedIds.size} seleccionada
                    {selectedIds.size === 1 ? "" : "s"}
                  </span>
                </p>
              ) : null}
            </div>
            {!loading && filtered.length > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSelectAll(!allFilteredSelected)}
              >
                {allFilteredSelected
                  ? "Deseleccionar todas"
                  : "Seleccionar todas"}
              </Button>
            ) : null}
          </div>

          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,180px)_minmax(0,180px)_auto] sm:items-end">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Servicio
              </label>
              <CustomSelect
                value={servicioFilter}
                onChange={setServicioFilter}
                options={servicioOptions}
                placeholder="Todos"
                searchable
                clearable
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Fecha
              </label>
              <DatePicker
                value={fechaFilter}
                onChange={setFechaFilter}
                placeholder="Cualquiera"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Estado
              </label>
              <CustomSelect
                value={estadoFilter}
                onChange={setEstadoFilter}
                options={[
                  { value: "COMPLETADA", label: "Completada" },
                  { value: "INCOMPLETA", label: "Incompleta" },
                ]}
                placeholder="Todos"
                clearable
              />
            </div>
            <div className="flex items-end">
              {hasInListFilters ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setServicioFilter("");
                    setEstadoFilter("");
                    setFechaFilter("");
                  }}
                >
                  <X className="h-4 w-4 mr-1" /> Limpiar
                </Button>
              ) : null}
            </div>
          </div>

          {loading ? (
            <EmptyState text="Cargando visitas…" />
          ) : visitas.length === 0 ? (
            <EmptyState text="No hay visitas con fotos para este cliente en el rango seleccionado." />
          ) : filtered.length === 0 ? (
            <EmptyState text="Sin coincidencias para estos filtros." />
          ) : (
            <div className="space-y-2">
              {filtered.map((v) => {
                const selected = selectedIds.has(v.id);
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => onToggle(v.id)}
                    className={`flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left transition-colors ${
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:bg-muted/30"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 flex-none items-center justify-center rounded border-2 ${
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/30"
                      }`}
                    >
                      {selected ? "✓" : null}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {formatDate(v.fechaProgramada)}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {v.servicioNombre}
                      </p>
                    </div>
                    <span
                      className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        v.estado === "COMPLETADA"
                          ? "bg-green-100 text-green-800"
                          : "bg-orange-100 text-orange-800"
                      }`}
                    >
                      {v.estado.toLowerCase()}
                    </span>
                    <span className="flex-none text-xs text-muted-foreground tabular-nums w-16 text-right">
                      {v.fotosCount} foto{v.fotosCount === 1 ? "" : "s"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ───────────── Step 2 ─────────────

function Step3Secciones({
  titulo,
  onTituloChange,
  pool,
  secciones,
  onSeccionesChange,
  productos,
  catalogo,
  clienteId,
  allPool,
  addPhotosFor,
  setAddPhotosFor,
  onViewMedia,
}: {
  titulo: string;
  onTituloChange: (v: string) => void;
  pool: MediaPoolItem[];
  secciones: SeccionDraft[];
  onSeccionesChange: (s: SeccionDraft[]) => void;
  productos: ServicioParaSeccion[];
  catalogo: ProductoCatalogo[];
  clienteId: string | null;
  allPool: MediaPoolItem[];
  addPhotosFor: string | null;
  setAddPhotosFor: (id: string | null) => void;
  onViewMedia: (url: string) => void;
}) {
  // Fotos de visita ya usadas en alguna sección: no se vuelven a autoasignar.
  const assignedIds = useMemo(() => {
    const set = new Set<string>();
    for (const sec of secciones) {
      for (const f of sec.fotos) {
        if (f.visitaMediaId) set.add(f.visitaMediaId);
      }
    }
    return set;
  }, [secciones]);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [photoDragOverId, setPhotoDragOverId] = useState<string | null>(null);
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(
    null
  );
  const [sectionDragOverId, setSectionDragOverId] = useState<string | null>(
    null
  );
  const [dragArmedId, setDragArmedId] = useState<string | null>(null);
  /** Reordenar fotos dentro de una sección. */
  const [fotoArrastrada, setFotoArrastrada] = useState<string | null>(null);
  /** Dónde caería la foto: sobre cuál y de qué lado. */
  const [fotoSobre, setFotoSobre] = useState<{
    uid: string;
    antes: boolean;
  } | null>(null);
  const [editandoTitulo, setEditandoTitulo] = useState(false);

  function toggleCollapsed(tempId: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(tempId)) next.delete(tempId);
      else next.add(tempId);
      return next;
    });
  }

  /**
   * Crea una sección. Con un servicio, el título y la descripción salen del
   * servicio y la sección arranca con las fotos que se etiquetaron con él.
   * Sin servicio, queda una sección personalizada vacía.
   */
  function addSeccion(servicio: ServicioParaSeccion | null) {
    const fotosDelServicio = servicio
      ? allPool
          .filter(
            (m) =>
              m.productoId === servicio.productoId &&
              !assignedIds.has(m.id)
          )
          .map(fotoDeVisita)
      : [];
    const draft: SeccionDraft = {
      tempId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      productoId: servicio?.productoId ?? null,
      titulo: servicio?.nombre ?? "",
      descripcion: servicio?.descripcion ?? "",
      fotos: fotosDelServicio,
    };
    onSeccionesChange([...secciones, draft]);
  }

  /**
   * Qué se puede convertir en sección: lo de las visitas primero, después el
   * resto del catálogo, y la personalizada al final.
   *
   * Lo que ya tiene sección queda en gris: dos secciones del mismo producto
   * salen iguales en el PDF y no hay forma de distinguirlas después.
   */
  const opcionesDeSeccion = useMemo(() => {
    const deVisitas = new Set(productos.map((p) => p.productoId));
    const usado = (productoId: string) =>
      secciones.some((sec) => sec.productoId === productoId);
    const delCatalogo = catalogo.filter((p) => !deVisitas.has(p.id));
    return [
      ...(productos.length > 0
        ? [
            { encabezado: "De estas visitas" },
            ...productos.map((sv) => ({
              value: sv.productoId,
              label: sv.nombre,
              disabled: usado(sv.productoId),
              hint: usado(sv.productoId)
                ? "Ya tiene sección"
                : sv.fotosCount > 0
                  ? `${sv.fotosCount} foto${sv.fotosCount === 1 ? "" : "s"}`
                  : "Sin fotos",
            })),
          ]
        : []),
      ...(delCatalogo.length > 0
        ? [
            { encabezado: "Resto del catálogo" },
            ...delCatalogo.map((p) => ({
              value: p.id,
              label: p.nombre,
              disabled: usado(p.id),
              hint: usado(p.id) ? "Ya tiene sección" : undefined,
            })),
          ]
        : []),
      { encabezado: "Otra" },
      { value: PERSONALIZADA, label: "Sección personalizada (vacía)" },
    ];
  }, [productos, catalogo, secciones]);

  /** Alta desde el selector: puede ser de las visitas, del catálogo o vacía. */
  function agregarDesdeCatalogo(value: string) {
    if (!value) return;
    if (value === PERSONALIZADA) return addSeccion(null);
    const deVisita = productos.find((p) => p.productoId === value);
    if (deVisita) return addSeccion(deVisita);
    const delCatalogo = catalogo.find((p) => p.id === value);
    if (!delCatalogo) return;
    addSeccion({
      productoId: delCatalogo.id,
      nombre: delCatalogo.nombre,
      descripcion: delCatalogo.descripcion,
      visitasCount: 0,
      fotosCount: 0,
    });
  }

  function updateSeccion(tempId: string, patch: Partial<SeccionDraft>) {
    onSeccionesChange(
      secciones.map((s) => (s.tempId === tempId ? { ...s, ...patch } : s))
    );
  }

  function removeSeccion(tempId: string) {
    onSeccionesChange(secciones.filter((s) => s.tempId !== tempId));
  }

  function reorderSecciones(fromTempId: string, toTempId: string) {
    if (fromTempId === toTempId) return;
    const fromIdx = secciones.findIndex((s) => s.tempId === fromTempId);
    const toIdx = secciones.findIndex((s) => s.tempId === toTempId);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = [...secciones];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    onSeccionesChange(next);
  }

  /**
   * Meter una foto antes o después de otra, dentro de la misma sección.
   *
   * El lugar se calcula **después** de sacarla de donde estaba: si no, mover
   * hacia la derecha cae siempre un casillero antes de lo que se ve.
   */
  function reordenarFotos(
    tempId: string,
    fromUid: string,
    toUid: string,
    antes: boolean
  ) {
    if (fromUid === toUid) return;
    const seccion = secciones.find((x) => x.tempId === tempId);
    if (!seccion) return;
    const desde = seccion.fotos.findIndex((f) => f.uid === fromUid);
    // Arrastrada desde otra sección: acá solo se reordena dentro de la misma.
    if (desde < 0 || !seccion.fotos.some((f) => f.uid === toUid)) return;
    const fotos = [...seccion.fotos];
    const [movida] = fotos.splice(desde, 1);
    const ref = fotos.findIndex((f) => f.uid === toUid);
    fotos.splice(antes ? ref : ref + 1, 0, movida);
    updateSeccion(tempId, { fotos });
  }

  function removeFotoFromSeccion(tempId: string, uid: string) {
    const seccion = secciones.find((s) => s.tempId === tempId);
    if (!seccion) return;
    updateSeccion(tempId, {
      fotos: seccion.fotos.filter((f) => f.uid !== uid),
    });
  }

  function addFotosToSeccion(tempId: string, nuevas: SeccionFotoDraft[]) {
    const seccion = secciones.find((s) => s.tempId === tempId);
    if (!seccion) return;
    const existing = new Set(seccion.fotos.map((f) => f.uid));
    const additions = nuevas.filter((f) => !existing.has(f.uid));
    if (additions.length === 0) return;
    updateSeccion(tempId, { fotos: [...seccion.fotos, ...additions] });
  }

  /** Ids del pool → fotos de sección. */
  function fotosDesdePool(ids: string[]): SeccionFotoDraft[] {
    const byId = new Map(allPool.map((m) => [m.id, m]));
    return ids
      .map((id) => byId.get(id))
      .filter((m): m is MediaPoolItem => Boolean(m))
      .map(fotoDeVisita);
  }

  /**
   * Sube imágenes propias del informe a R2 con URLs prefirmadas y las agrega
   * a la sección. Es lo que usan tanto el drop de archivos como el botón.
   */
  async function subirArchivos(tempId: string, files: File[]) {
    const imagenes = files.filter((f) => f.type.startsWith("image/"));
    if (imagenes.length === 0) {
      toast.error("Solo se pueden agregar imágenes.");
      return;
    }
    if (!clienteId) {
      toast.error("Selecciona un cliente antes de subir imágenes.");
      return;
    }
    setUploadingFor(tempId);
    try {
      const res = await fetch("/api/admin/informes/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId,
          files: imagenes.map((f) => ({
            fileName: f.name,
            contentType: f.type,
          })),
        }),
      });
      if (!res.ok) throw new Error("No pudimos preparar la subida.");
      const { uploads } = (await res.json()) as {
        uploads: Array<{ key: string; uploadUrl: string; url: string }>;
      };

      const subidas: SeccionFotoDraft[] = [];
      await Promise.all(
        uploads.map(async (u, i) => {
          const file = imagenes[i];
          const put = await fetch(u.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": file.type },
            body: file,
          });
          if (!put.ok) throw new Error(`No se pudo subir ${file.name}.`);
          subidas.push(fotoSubida(u.key, u.url));
        })
      );

      addFotosToSeccion(tempId, subidas);
      toast.success(
        subidas.length === 1
          ? "Imagen agregada"
          : `${subidas.length} imágenes agregadas`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al subir imágenes");
    } finally {
      setUploadingFor(null);
    }
  }

  function handleDragOver(e: React.DragEvent, sectionTempId: string) {
    e.preventDefault();
    const types = e.dataTransfer.types;
    if (types.includes("Files")) {
      setPhotoDragOverId(sectionTempId);
      setSectionDragOverId(null);
    } else if (types.includes("application/x-section")) {
      setSectionDragOverId(sectionTempId);
      setPhotoDragOverId(null);
    } else {
      setPhotoDragOverId(sectionTempId);
      setSectionDragOverId(null);
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    if (e.currentTarget === e.target) {
      setPhotoDragOverId(null);
      setSectionDragOverId(null);
    }
  }

  function handleDrop(e: React.DragEvent, sectionTempId: string) {
    e.preventDefault();
    setPhotoDragOverId(null);
    setSectionDragOverId(null);
    function expandir() {
      setCollapsed((prev) => {
        if (!prev.has(sectionTempId)) return prev;
        const next = new Set(prev);
        next.delete(sectionTempId);
        return next;
      });
    }

    // Archivos arrastrados desde el escritorio → subida propia del informe.
    const archivos = Array.from(e.dataTransfer.files ?? []);
    if (archivos.length > 0) {
      expandir();
      void subirArchivos(sectionTempId, archivos);
      return;
    }

    const sectionId = e.dataTransfer.getData("application/x-section");
    if (sectionId) {
      reorderSecciones(sectionId, sectionTempId);
      return;
    }
    const photoId = e.dataTransfer.getData("text/plain");
    if (photoId) {
      addFotosToSeccion(sectionTempId, fotosDesdePool([photoId]));
      expandir();
    }
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Fija arriba: el título y el botón de agregar son de todo el paso, no
          de una sección, así que no viajan con el scroll. */}
      <div className="flex flex-none items-center gap-3 rounded-lg border bg-card px-4 py-3">
        {editandoTitulo ? (
          <Input
            autoFocus
            value={titulo}
            onChange={(e) => onTituloChange(e.target.value)}
            onBlur={() => setEditandoTitulo(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") {
                e.preventDefault();
                setEditandoTitulo(false);
              }
            }}
            placeholder="Ej. Informe de Áreas Verdes — Enero 2026 — Pacífica"
            className="flex-1"
          />
        ) : (
          <>
            {/* Texto y no un campo: se escribe una vez y después estorba. */}
            <span
              className={`min-w-0 flex-1 truncate text-base font-semibold ${
                titulo ? "" : "text-muted-foreground"
              }`}
              title={titulo || undefined}
            >
              {titulo || "Sin título"}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setEditandoTitulo(true)}
              aria-label="Editar el título"
              className="flex-none"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </>
        )}
        <div className="w-56 flex-none">
          <CustomSelect
            value=""
            onChange={agregarDesdeCatalogo}
            options={opcionesDeSeccion}
            placeholder="+ Agregar sección"
            searchable
            searchPlaceholder="Buscar producto o servicio..."
            anchoMinimo={380}
          />
        </div>
      </div>

      {/* Lo único que scrollea. Ancho completo: el pool vivía al costado y ya
          no existe; las fotos se eligen desde la sección. */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {secciones.length === 0 ? (
            <Card>
              <CardContent className="py-16">
                <div className="text-center space-y-3">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Plus className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Aún no hay secciones</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Empieza agregando una desde el catálogo o crea una custom.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {secciones.map((s, idx) => {
            const isPhotoDragOver = photoDragOverId === s.tempId;
            const isSectionDragOver =
              sectionDragOverId === s.tempId &&
              draggingSectionId !== s.tempId;
            const isDragging = draggingSectionId === s.tempId;
            const isCollapsed = collapsed.has(s.tempId);
            const hasPhotos = s.fotos.length > 0;
            const isUploading = uploadingFor === s.tempId;
            return (
              <div
                key={s.tempId}
                draggable={dragArmedId === s.tempId}
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/x-section", s.tempId);
                  e.dataTransfer.effectAllowed = "move";
                  setDraggingSectionId(s.tempId);
                }}
                onDragEnd={() => {
                  setDraggingSectionId(null);
                  setDragArmedId(null);
                  setSectionDragOverId(null);
                  setPhotoDragOverId(null);
                }}
                onDragOver={(e) => handleDragOver(e, s.tempId)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, s.tempId)}
                className={`relative rounded-xl border-2 bg-card transition-colors ${
                  isPhotoDragOver
                    ? "border-primary bg-primary/5"
                    : hasPhotos || isCollapsed
                      ? "border-border"
                      : "border-dashed border-muted-foreground/30"
                } ${isDragging ? "opacity-40" : ""}`}
              >
                {isSectionDragOver ? (
                  <div className="pointer-events-none absolute inset-x-2 -top-1 h-1 rounded-full bg-primary" />
                ) : null}

                {/* Section header */}
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <button
                    type="button"
                    onMouseDown={() => setDragArmedId(s.tempId)}
                    onMouseUp={() => setDragArmedId(null)}
                    onMouseLeave={() => setDragArmedId(null)}
                    className="flex h-8 w-5 flex-none cursor-grab items-center justify-center text-muted-foreground hover:text-foreground active:cursor-grabbing"
                    title="Arrastra para reordenar"
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {idx + 1}
                  </span>
                  <Input
                    value={s.titulo}
                    onChange={(e) =>
                      updateSeccion(s.tempId, { titulo: e.target.value })
                    }
                    placeholder="Título de la sección"
                    className="flex-1 border-0 bg-transparent px-0 text-base font-semibold shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  {isCollapsed && hasPhotos ? (
                    <span className="flex-none text-xs text-muted-foreground">
                      {s.fotos.length} foto
                      {s.fotos.length === 1 ? "" : "s"}
                    </span>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleCollapsed(s.tempId)}
                    title={isCollapsed ? "Expandir" : "Colapsar"}
                    className="flex-none"
                  >
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        isCollapsed ? "-rotate-90" : ""
                      }`}
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSeccion(s.tempId)}
                    title="Eliminar sección"
                    className="flex-none text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {!isCollapsed ? (
                  <>
                    <div className="border-t" />
                    {/* Description */}
                    <div className="px-4 pt-3">
                      <textarea
                        value={s.descripcion}
                        onChange={(e) =>
                          updateSeccion(s.tempId, {
                            descripcion: e.target.value,
                          })
                        }
                        rows={2}
                        className="block w-full max-h-32 resize-none overflow-y-auto rounded-md border-0 bg-transparent px-0 py-1 text-sm leading-relaxed text-muted-foreground focus:text-foreground focus:outline-none"
                        placeholder="Descripción de la sección (opcional)"
                      />
                    </div>

                    {/* Photos area */}
                    <div className="px-4 pb-4 pt-2">
                      {hasPhotos ? (
                        <>
                          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                            {s.fotos.map((f) => (
                              /* Arrastrable para reordenar: en el PDF salen en
                                 este orden, y "la del antes primero" es una
                                 decisión que se toma acá. */
                              <div
                                key={f.uid}
                                draggable
                                onDragStart={(e) => {
                                  e.stopPropagation();
                                  e.dataTransfer.setData(TIPO_FOTO, f.uid);
                                  e.dataTransfer.effectAllowed = "move";
                                  // La miniatura pegada al cursor, centrada:
                                  // por omisión el navegador arrastra una
                                  // copia del recuadro entero, botones y todo.
                                  const caja =
                                    e.currentTarget.getBoundingClientRect();
                                  e.dataTransfer.setDragImage(
                                    e.currentTarget,
                                    caja.width / 2,
                                    caja.height / 2
                                  );
                                  setFotoArrastrada(f.uid);
                                }}
                                onDragEnd={() => {
                                  setFotoArrastrada(null);
                                  setFotoSobre(null);
                                }}
                                onDragOver={(e) => {
                                  if (!e.dataTransfer.types.includes(TIPO_FOTO))
                                    return;
                                  e.preventDefault();
                                  e.stopPropagation();
                                  // De qué mitad: es lo que decide si cae
                                  // antes o después, y lo que dibuja la barra.
                                  const caja =
                                    e.currentTarget.getBoundingClientRect();
                                  setFotoSobre({
                                    uid: f.uid,
                                    antes: e.clientX < caja.left + caja.width / 2,
                                  });
                                }}
                                onDrop={(e) => {
                                  const uid = e.dataTransfer.getData(TIPO_FOTO);
                                  if (!uid) return;
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const caja =
                                    e.currentTarget.getBoundingClientRect();
                                  const antes =
                                    e.clientX < caja.left + caja.width / 2;
                                  setFotoSobre(null);
                                  setFotoArrastrada(null);
                                  reordenarFotos(s.tempId, uid, f.uid, antes);
                                }}
                                className={`group relative aspect-square cursor-grab rounded-md border bg-muted active:cursor-grabbing ${
                                  fotoArrastrada === f.uid ? "opacity-30" : ""
                                }`}
                              >
                                {/* La barra dice dónde va a caer. Un anillo
                                    sobre la de destino decía "cambiala por
                                    esta", que es otra cosa. */}
                                {fotoSobre?.uid === f.uid &&
                                fotoArrastrada !== f.uid ? (
                                  <span
                                    className={`pointer-events-none absolute inset-y-0 z-10 w-1 rounded-full bg-primary ${
                                      fotoSobre.antes ? "-left-1.5" : "-right-1.5"
                                    }`}
                                  />
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => onViewMedia(f.url)}
                                  // `overflow-hidden` acá y no en el recuadro:
                                  // ahí recortaría la barra que asoma al lado.
                                  className="block h-full w-full overflow-hidden rounded-md"
                                  title="Ver en grande"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={f.url}
                                    alt=""
                                    className="h-full w-full object-cover transition-transform hover:scale-105"
                                  />
                                </button>
                                {!f.visitaMediaId ? (
                                  <span
                                    className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white"
                                    title="Imagen subida al informe, no viene de una visita"
                                  >
                                    Subida
                                  </span>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeFotoFromSeccion(s.tempId, f.uid)
                                  }
                                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                                  title="Quitar de esta sección"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs text-muted-foreground">
                              {s.fotos.length} foto
                              {s.fotos.length === 1 ? "" : "s"}
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setAddPhotosFor(s.tempId)}
                              disabled={isUploading}
                            >
                              <Plus className="mr-1 h-4 w-4" />
                              {isUploading ? "Subiendo…" : "Agregar fotos"}
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="rounded-md border-2 border-dashed border-muted-foreground/20 px-4 py-8 text-center">
                          <p className="text-sm text-muted-foreground">
                            {isUploading
                              ? "Subiendo imágenes…"
                              : "Arrastrá imágenes acá, o elegilas de las visitas."}
                          </p>
                          <div className="mt-2 flex justify-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setAddPhotosFor(s.tempId)}
                              disabled={isUploading}
                            >
                              <Plus className="mr-1 h-4 w-4" /> Agregar fotos
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            );
          })}

          {/* Buscable y con todo el catálogo: una sección puede ser de algo
              que estas visitas no cubrieron. Lo de las visitas va primero
              porque es lo que se elige el 90% de las veces. */}
      </div>

      {addPhotosFor !== null ? (
        <PhotoPickerModal
          pool={pool}
          clienteId={clienteId}
          onClose={() => setAddPhotosFor(null)}
          onConfirm={(fotos) => {
            addFotosToSeccion(addPhotosFor, fotos);
            setAddPhotosFor(null);
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * De dónde salen las fotos de una sección, todo en un lugar.
 *
 * Antes eran dos botones —"De las visitas" y "Subir"— y un pool al costado
 * para arrastrar. Son tres formas de contestar la misma pregunta, así que van
 * juntas: se elige de lo que trajeron las visitas, se sueltan archivos encima
 * o se buscan en la computadora.
 */
function PhotoPickerModal({
  pool,
  clienteId,
  onClose,
  onConfirm,
}: {
  pool: MediaPoolItem[];
  clienteId: string | null;
  onClose: () => void;
  onConfirm: (fotos: SeccionFotoDraft[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /** Ya subidas a R2 en este modal. Entran elegidas: por algo se subieron. */
  const [subidas, setSubidas] = useState<SeccionFotoDraft[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [arrastrando, setArrastrando] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  async function subir(files: File[]) {
    const imagenes = files.filter((f) => f.type.startsWith("image/"));
    if (imagenes.length < files.length) {
      toast.error(
        imagenes.length === 0
          ? "Solo se pueden agregar imágenes"
          : "Se descartaron los archivos que no son imágenes"
      );
    }
    if (imagenes.length === 0) return;
    if (!clienteId) return toast.error("Selecciona un cliente primero");

    setSubiendo(true);
    try {
      const res = await fetch("/api/admin/informes/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId,
          files: imagenes.map((f) => ({
            fileName: f.name,
            contentType: f.type,
          })),
        }),
      });
      if (!res.ok) throw new Error("No pudimos preparar la subida.");
      const { uploads } = (await res.json()) as {
        uploads: Array<{ key: string; uploadUrl: string; url: string }>;
      };
      const nuevas: SeccionFotoDraft[] = [];
      await Promise.all(
        uploads.map(async (u, i) => {
          const file = imagenes[i];
          const put = await fetch(u.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": file.type },
            body: file,
          });
          if (!put.ok) throw new Error(`No se pudo subir ${file.name}.`);
          nuevas.push(fotoSubida(u.key, u.url));
        })
      );
      setSubidas((prev) => [...prev, ...nuevas]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al subir imágenes");
    } finally {
      setSubiendo(false);
    }
  }

  const total = selected.size + subidas.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-lg bg-card p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        // El drop se escucha en todo el modal: apuntarle a un recuadro chico
        // mientras se arrastra es más trabajo del que vale.
        onDragEnter={(e) => {
          e.preventDefault();
          setArrastrando((n) => n + 1);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setArrastrando((n) => Math.max(0, n - 1))}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(0);
          const files = Array.from(e.dataTransfer.files ?? []);
          if (files.length > 0) void subir(files);
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Agregar fotos {total > 0 ? `(${total})` : ""}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div
          className={`mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border-2 border-dashed px-3 py-2.5 transition-colors ${
            arrastrando > 0
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25"
          }`}
        >
          <p className="text-sm text-muted-foreground">
            {subiendo
              ? "Subiendo imágenes…"
              : arrastrando > 0
                ? "Soltá las imágenes acá"
                : "Arrastrá imágenes de tu computadora, o"}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={subiendo}
          >
            <Upload className="mr-1 h-4 w-4" /> Buscar en mi computadora
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              if (files.length > 0) void subir(files);
            }}
          />
        </div>

        {/* `p-1`: el anillo de "seleccionada" se dibuja *afuera* de la
            miniatura, y pegado al borde del área con scroll quedaba cortado. */}
        <div className="flex-1 overflow-y-auto p-1">
          {pool.length === 0 && subidas.length === 0 ? (
            <EmptyState text="No quedan fotos de las visitas sin asignar. Podés subir las tuyas." />
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {subidas.map((f) => (
                <div
                  key={f.uid}
                  className="relative aspect-square overflow-hidden rounded border ring-2 ring-primary"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    Subida
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setSubidas((prev) => prev.filter((x) => x.uid !== f.uid))
                    }
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
                    title="Quitar"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {pool.map((m) => {
                const isSel = selected.has(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (next.has(m.id)) next.delete(m.id);
                        else next.add(m.id);
                        return next;
                      });
                    }}
                    className={`relative aspect-square overflow-hidden rounded border ${
                      isSel ? "ring-2 ring-primary" : ""
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    {isSel ? (
                      <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                        ✓
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={total === 0 || subiendo}
            onClick={() =>
              onConfirm([
                ...Array.from(selected)
                  .map((id) => pool.find((m) => m.id === id))
                  .filter((m): m is MediaPoolItem => Boolean(m))
                  .map(fotoDeVisita),
                ...subidas,
              ])
            }
          >
            Agregar {total > 0 ? `(${total})` : ""}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ───────────── Step 3 ─────────────

function Step5Preview({
  pdfUrl,
  titulo,
}: {
  pdfUrl: string;
  titulo: string;
}) {
  const filename = `${titulo || "informe"}.pdf`.replace(/[\\/:*?"<>|]+/g, "_");
  // Hide the browser's native PDF toolbar — Chrome/Edge respect these params.
  const cleanUrl = `${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`;

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-none flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-green-100 text-green-700">
            <Check className="h-3.5 w-3.5" />
          </span>
          <p className="truncate text-sm font-medium" title={titulo}>
            {titulo}
          </p>
        </div>
        <div className="flex flex-none items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(pdfUrl, "_blank", "noopener,noreferrer")}
          >
            <ExternalLink className="h-4 w-4 mr-1.5" /> Abrir en pestaña
          </Button>
          <Button
            size="sm"
            render={<a href={pdfUrl} download={filename} />}
          >
            <Download className="h-4 w-4 mr-1.5" /> Descargar
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-neutral-200">
        <iframe
          src={cleanUrl}
          className="block h-full w-full border-0"
          title="Vista previa del informe"
        />
      </div>
    </div>
  );
}

// ───────────── helpers ─────────────

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function quickRange(
  key: "este-mes" | "mes-pasado" | "ultimos-30"
): { label: string; from: string; to: string } {
  const now = new Date();
  if (key === "este-mes") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { label: "Este mes", from: toIsoDate(from), to: toIsoDate(to) };
  }
  if (key === "mes-pasado") {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 0);
    return { label: "Mes pasado", from: toIsoDate(from), to: toIsoDate(to) };
  }
  // ultimos-30
  const to = now;
  const from = new Date(now);
  from.setDate(from.getDate() - 30);
  return {
    label: "Últimos 30 días",
    from: toIsoDate(from),
    to: toIsoDate(to),
  };
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-EC", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
