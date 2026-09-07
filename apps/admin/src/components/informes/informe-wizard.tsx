"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  GripVertical,
  Loader2,
  Maximize2,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { nombreCliente } from "@vivero/shared";
import { CustomSelect } from "@/components/ui/custom-select";
import { DatePicker } from "@/components/ui/date-picker";
import { hoyISOEcuador } from "@/lib/fechas";
import { toast } from "sonner";
import {
  MediaLibrary,
  subirALaBiblioteca,
} from "@/components/servicios/media-library";
import { EditorImagen } from "@/components/servicios/editor-imagen";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
 * de la biblioteca (`mediaId`). `url` siempre sirve para previsualizar.
 */
interface SeccionFotoDraft {
  uid: string;
  visitaMediaId: string | null;
  mediaId: string | null;
  url: string;
}

interface SeccionDraft {
  tempId: string;
  /// Servicio que origina la sección. Null = sección personalizada.
  productoId: string | null;
  titulo: string;
  descripcion: string;
  fotos: SeccionFotoDraft[];
  /**
   * Cómo se imprime. Los valores por defecto son exactamente lo que se venía
   * imprimiendo, así que un informe donde nadie toca nada sale igual que antes.
   */
  saltoDePagina: boolean;
  fotosPorFila: 2 | 3 | 4;
}

/** Lo que trae una sección recién creada. */
const LAYOUT_POR_DEFECTO = {
  saltoDePagina: false,
  fotosPorFila: 3 as const,
};

function fotoDeVisita(m: MediaPoolItem): SeccionFotoDraft {
  return {
    uid: `visita-${m.id}`,
    visitaMediaId: m.id,
    mediaId: null,
    url: m.url,
  };
}

/**
 * Una de la biblioteca. Es por donde entran todas las que no salen de una
 * visita: subir un archivo acá lo deja en la biblioteca y después lo referencia,
 * en vez de dejarlo colgando de este informe y de nadie más.
 */
function fotoDeBiblioteca(m: { id: string; url: string }): SeccionFotoDraft {
  return {
    uid: `media-${m.id}`,
    visitaMediaId: null,
    mediaId: m.id,
    url: m.url,
  };
}

interface FirmanteDraft {
  tempId: string;
  nombre: string;
  cedula: string;
}

/**
 * La vista previa que se rehace sola mientras se editan las secciones.
 *
 * Se arma en el servidor —el mismo camino que el informe definitivo— y no en el
 * navegador con una maqueta HTML: una maqueta que no coincide con el PDF es
 * peor que no tener nada, que es justo el problema que se estaba resolviendo.
 *
 * Lo que la hace viable es el modo borrador: las fotos van achicadas al tamaño
 * impreso y quedan cacheadas en el servidor, así que después de la primera cada
 * refresco son unos 500 ms en vez de 3 segundos. El corte de páginas es el
 * mismo, porque depende del alto en puntos y no de los píxeles del archivo.
 *
 * Espera a que la mano pare: rearmar por cada tecla tirada sería una cola de
 * pedidos que llegan tarde y desordenados. El pedido en curso se cancela cuando
 * llega un cambio nuevo.
 */
function useVistaPreviaEnVivo(cuerpo: object | null, activo: boolean) {
  const [url, setUrl] = useState<string | null>(null);
  const [armando, setArmando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // La clave del efecto es el contenido, no la identidad: `cuerpo` se rearma en
  // cada render y con él en las dependencias esto no pararía nunca.
  const clave = cuerpo ? JSON.stringify(cuerpo) : null;
  const ultimaUrl = useRef<string | null>(null);
  /**
   * Con qué contenido se armó lo que se está viendo.
   *
   * Estado y no `ref` porque se lee al dibujar: un ref no dispara render, así
   * que el aviso podría quedarse prendido después de que la previa ya llegó.
   */
  const [claveMostrada, setClaveMostrada] = useState<string | null>(null);

  useEffect(() => {
    if (!activo || !clave) return;
    const control = new AbortController();
    const temporizador = setTimeout(() => {
      setArmando(true);
      fetch("/api/admin/informes/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...JSON.parse(clave), borrador: true }),
        signal: control.signal,
      })
        .then(async (res) => {
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error ?? "No pudimos armar la vista previa");
          }
          const nueva = URL.createObjectURL(await res.blob());
          // La anterior se suelta recién ahora: soltarla antes deja el visor en
          // blanco mientras se arma la nueva.
          if (ultimaUrl.current) URL.revokeObjectURL(ultimaUrl.current);
          ultimaUrl.current = nueva;
          setClaveMostrada(clave);
          setUrl(nueva);
          setError(null);
        })
        .catch((e: unknown) => {
          // Un pedido cancelado no es un error: es que llegó un cambio nuevo.
          if (e instanceof DOMException && e.name === "AbortError") return;
          setError(e instanceof Error ? e.message : "No pudimos armarla");
        })
        .finally(() => setArmando(false));
    }, 700);

    return () => {
      clearTimeout(temporizador);
      control.abort();
    };
  }, [clave, activo]);

  useEffect(() => {
    return () => {
      if (ultimaUrl.current) URL.revokeObjectURL(ultimaUrl.current);
    };
  }, []);

  /**
   * Lo que se ve **ya no corresponde** a lo que hay en pantalla.
   *
   * No es lo mismo que `armando`: eso arranca recién cuando sale el pedido, o
   * sea 700 ms después del último cambio, y en ese rato el visor mostraba con
   * total normalidad un PDF viejo. Comparando contra el contenido con el que se
   * armó lo que se está viendo, el aviso aparece **en la tecla**.
   */
  const desactualizada = clave !== null && clave !== claveMostrada;

  return { url, actualizando: armando || desactualizada, error };
}

/**
 * Con qué puede arrancar el asistente: un borrador guardado o un informe que se
 * está editando.
 *
 * Es la misma forma en los dos casos porque es lo mismo — el estado del
 * asistente— y tenerla una sola vez evita que retomar un borrador y editar un
 * informe se comporten distinto.
 *
 * Las fotos viajan con su `url` para poder dibujarlas sin ir a buscarlas: la
 * del borrador se guardó tal cual, y la del informe sale de la fila, que ya la
 * tiene.
 */
export interface EstadoInicialInforme {
  paso?: number;
  clienteId: string | null;
  /**
   * Qué rango mirar en el paso de visitas.
   *
   * Sin esto, editar un informe de agosto abría la lista en "este mes" y sus
   * propias visitas no aparecían — seleccionadas pero fuera del rango, o sea
   * invisibles. Viene del período que el informe ya abarca.
   */
  rango?: { label: string; from: string | null; to: string | null };
  titulo: string;
  fecha: string;
  visitaIds: string[];
  firmantes: Array<{ nombre: string; cedula: string | null }>;
  secciones: Array<{
    productoId: string | null;
    titulo: string;
    descripcion: string;
    saltoDePagina: boolean;
    fotosPorFila: 2 | 3 | 4;
    fotos: Array<{
      visitaMediaId: string | null;
      mediaId: string | null;
      url: string;
    }>;
  }>;
}

/** Las secciones del estado inicial, con los ids que necesita el asistente. */
function seccionesDesde(estado: EstadoInicialInforme): SeccionDraft[] {
  return estado.secciones.map((sec, i) => ({
    tempId: `inicial-${i}`,
    productoId: sec.productoId,
    titulo: sec.titulo,
    descripcion: sec.descripcion,
    saltoDePagina: sec.saltoDePagina,
    fotosPorFila: sec.fotosPorFila,
    fotos: sec.fotos.map((f) =>
      f.visitaMediaId
        ? { uid: `visita-${f.visitaMediaId}`, visitaMediaId: f.visitaMediaId, mediaId: null, url: f.url }
        : { uid: `media-${f.mediaId}`, visitaMediaId: null, mediaId: f.mediaId, url: f.url }
    ),
  }));
}

type WizardStep = 1 | 2 | 3 | 4 | 5;

interface SavedFirmante {
  id: string;
  nombre: string;
  cedula: string | null;
  isDefault: boolean;
}

export function InformeWizard({
  defaultFirmantes,
  catalogo = [],
  inicial,
  borradorId,
  numeroDeBorrador,
  editando,
}: {
  defaultFirmantes?: Array<{ nombre: string; cedula: string | null }>;
  /** Todo el catálogo activo, para secciones de algo que no se visitó. */
  catalogo?: ProductoCatalogo[];
  /** Con qué arranca: un borrador retomado o un informe que se edita. */
  inicial?: EstadoInicialInforme;
  /** El borrador del que salió, para pisarlo al guardar y borrarlo al generar. */
  borradorId?: string;
  /** El número que trae el borrador. El informe lo hereda al generarse. */
  numeroDeBorrador?: number;
  /** El informe que se edita. Guardar crea una versión nueva, no otro informe. */
  editando?: {
    id: string;
    numero: number;
    /** Se abrió una versión vieja para rehacerla a partir de ella. */
    retomando?: { version: number; fotosPerdidas: number };
  };
}) {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>(() => {
    // Retomar donde se dejó, sin pasar del de firmar: la vista previa se arma
    // al llegar, así que aparecer directo ahí mostraría un visor vacío.
    const guardado = inicial?.paso;
    if (guardado && guardado >= 1 && guardado <= 3) return guardado as WizardStep;
    // Editando se entra directo a las secciones: el cliente no se cambia y las
    // visitas casi nunca son lo que se viene a corregir.
    return editando ? 2 : 1;
  });

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [serviciosDisponibles, setServiciosDisponibles] = useState<
    ServicioParaSeccion[]
  >([]);
  const [firmantesCatalog, setFirmantesCatalog] = useState<SavedFirmante[]>([]);
  const [clienteId, setClienteId] = useState<string | null>(
    inicial?.clienteId ?? null
  );

  const [dateRange, setDateRange] = useState<{
    label: string;
    from: string | null;
    to: string | null;
  }>(() => inicial?.rango ?? quickRange("este-mes"));

  const [availableVisitas, setAvailableVisitas] = useState<VisitaParaInforme[]>(
    [],
  );
  const [selectedVisitaIds, setSelectedVisitaIds] = useState<Set<string>>(
    () => new Set(inicial?.visitaIds ?? []),
  );
  const [loadingVisitas, setLoadingVisitas] = useState(false);

  const [pool, setPool] = useState<MediaPoolItem[]>([]);
  const [titulo, setTitulo] = useState(inicial?.titulo ?? "");
  const [secciones, setSecciones] = useState<SeccionDraft[]>(() =>
    inicial ? seccionesDesde(inicial) : [],
  );

  /**
   * La fecha que sale impresa. Arranca en hoy, que es lo más común, pero un
   * informe de agosto se puede estar armando en septiembre.
   */
  const [fecha, setFecha] = useState(inicial?.fecha ?? hoyISOEcuador());

  const [firmantes, setFirmantes] = useState<FirmanteDraft[]>(() => {
    if (inicial && inicial.firmantes.length > 0) {
      return inicial.firmantes.map((f, i) => ({
        tempId: `inicial-${i}`,
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
  const [guardandoBorrador, setGuardandoBorrador] = useState(false);
  /** Qué se cambió, para que la lista de versiones lo diga. Solo al editar. */
  const [notaDeCambio, setNotaDeCambio] = useState("");
  /** Confirmando salir de la edición. */
  const [saliendo, setSaliendo] = useState(false);
  /** El borrador en el que se está trabajando, si se guardó alguna vez. */
  const [borradorGuardado, setBorradorGuardado] = useState<string | null>(
    borradorId ?? null,
  );
  const [previsualizando, setPrevisualizando] = useState(false);
  /** El PDF del paso 5, como blob local. Nunca se guardó en ningún lado. */
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  /** El PDF que se está mirando a pantalla completa, si hay alguno. */
  const [aPantallaCompleta, setAPantallaCompleta] = useState<string | null>(
    null,
  );
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [savedInformeId, setSavedInformeId] = useState<string | null>(null);

  /**
   * El informe ya se generó. De acá no se vuelve: existe, tiene número y no se
   * edita. Lo que sigue es descargarlo, abrir su ficha o salir.
   */
  const terminado = step === 5 && savedInformeId != null;

  const [addPhotosFor, setAddPhotosFor] = useState<string | null>(null);

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

  // Las visitas del cliente, cada vez que cambia él o el rango.
  useEffect(() => {
    if (step !== 1 || !clienteId) return;
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
        `Informe de Áreas Verdes — ${capitalize(mes)} — ${nombreCliente(cliente)}`.trim(),
      );
    }
  }, [clientes, clienteId, dateRange, titulo]);

  // Las fotos de las visitas elegidas, mientras se eligen y no después: el
  // armado automático de secciones las necesita ya cargadas, y pedirlas al
  // entrar al paso siguiente lo dejaba corriendo contra la respuesta.
  useEffect(() => {
    if (step !== 1) return;
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
  const autogeneradas = useRef(inicial != null);

  // Los servicios que cubren las visitas seleccionadas son el catálogo de
  // secciones: título = nombre del servicio, descripción = la del servicio.
  useEffect(() => {
    if (step !== 2) return;
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
      .then(
        ([servicios, media]: [
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
                (m) => m.productoId === sv.productoId && !usadas.has(m.id),
              );
              fotos.forEach((m) => usadas.add(m.id));
              return {
                tempId: `auto-${sv.productoId}`,
                productoId: sv.productoId,
                titulo: sv.nombre,
                descripcion: sv.descripcion ?? "",
                fotos: fotos.map(fotoDeVisita),
                ...LAYOUT_POR_DEFECTO,
              };
            });
          });
        },
      )
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
    [pool, assignedIds],
  );

  function nextFromStep1() {
    if (!clienteId) return toast.error("Selecciona un cliente");
    // Sin visitas se sigue igual: las secciones se arman a mano, que es lo que
    // pasa cuando el informe no sale de una visita.
    setStep(2);
  }

  function nextFromStep2() {
    if (!titulo.trim()) return toast.error("El título es obligatorio");
    if (secciones.length === 0)
      return toast.error("Agrega al menos una sección");
    setStep(3);
  }

  /**
   * Al paso de la vista previa, armándola de entrada.
   *
   * Se rearma cada vez que se entra, no la primera nada más: si alguien vuelve
   * a corregir una sección y sigue, tiene que ver lo corregido. Una previa
   * cacheada que muestra lo de antes es peor que no tenerla.
   */
  async function nextFromStep3() {
    const cuerpo = cuerpoDelInforme();
    if (!cuerpo) return;
    setStep(4);
    await armarVistaPrevia(cuerpo);
  }

  async function armarVistaPrevia(
    cuerpo: ReturnType<typeof cuerpoBase>,
    opciones: { borrador?: boolean } = {},
  ): Promise<string | null> {
    if (!cuerpo) return null;
    setPrevisualizando(true);
    try {
      const res = await fetch("/api/admin/informes/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...cuerpo,
          borrador: opciones.borrador ?? false,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "No pudimos armar la vista previa");
      }
      const url = URL.createObjectURL(await res.blob());
      setPreviewUrl((anterior) => {
        // El anterior se suelta recién acá: hacerlo antes deja el visor en
        // blanco mientras se arma el nuevo.
        if (anterior) URL.revokeObjectURL(anterior);
        return url;
      });
      return url;
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No pudimos armar la vista previa",
      );
      return null;
    } finally {
      setPrevisualizando(false);
    }
  }

  /**
   * El cuerpo del informe, uno solo para generar y para la vista previa.
   *
   * Si fueran dos, la vista previa terminaría mostrando algo distinto de lo que
   * se guarda, que es peor que no tenerla. Devuelve `null` y avisa cuando falta
   * algo.
   */
  function cuerpoDelInforme() {
    const cuerpo = cuerpoBase();
    if (!cuerpo) {
      toast.error("Selecciona un cliente");
      return null;
    }
    if (cuerpo.firmantes.length === 0) {
      toast.error("Agrega al menos un firmante con nombre");
      return null;
    }
    return cuerpo;
  }

  /**
   * El cuerpo tal cual está, sin exigir nada.
   *
   * Lo usa la vista en vivo, que corre mientras se arman las secciones — o sea
   * antes de que haya firmante. Exigirlo ahí dejaría el panel vacío justo en el
   * momento en que sirve.
   */
  function cuerpoBase() {
    if (!clienteId) return null;
    const validFirmantes = firmantes
      .map((f) => ({
        nombre: f.nombre.trim(),
        cedula: f.cedula.trim() || null,
      }))
      .filter((f) => f.nombre.length > 0);
    return {
      clienteId,
      titulo: titulo.trim(),
      // El del borrador, si vino de uno: el #17 sigue siendo el #17.
      ...(numeroDeBorrador ? { numero: numeroDeBorrador } : {}),
      visitaIds: Array.from(selectedVisitaIds),
      fecha,
      firmantes: validFirmantes,
      secciones: secciones.map((s) => ({
        productoId: s.productoId,
        titulo: s.titulo,
        descripcion: s.descripcion || null,
        saltoDePagina: s.saltoDePagina,
        fotosPorFila: s.fotosPorFila,
        fotos: s.fotos.map((f) =>
          f.visitaMediaId
            ? { visitaMediaId: f.visitaMediaId }
            : { mediaId: f.mediaId },
        ),
      })),
    };
  }

  // Solo en el paso de las secciones, y solo si hay algo que dibujar: sin
  // secciones el servidor rechaza, y pedirlo para que falle es ruido.
  const cuerpoVivo = cuerpoBase();
  const enVivo = useVistaPreviaEnVivo(
    cuerpoVivo && cuerpoVivo.secciones.length > 0 ? cuerpoVivo : null,
    step === 2,
  );

  /**
   * Arma la previa y la muestra a pantalla completa.
   *
   * Es para las pantallas sin ancho para el panel de al lado. Antes abría otra
   * pestaña —con el rodeo de abrirla antes del `await` para que el navegador no
   * la bloqueara—; el visor no necesita nada de eso y deja el asistente montado
   * atrás, así que cerrar vuelve a donde se estaba.
   */
  async function vistaPrevia() {
    const cuerpo = cuerpoBase();
    if (!cuerpo) return toast.error("Selecciona un cliente");
    if (cuerpo.secciones.length === 0) {
      return toast.error("Agrega al menos una sección");
    }
    const url = await armarVistaPrevia(cuerpo, { borrador: true });
    if (url) setAPantallaCompleta(url);
  }

  /**
   * Guarda lo que hay, para seguir después.
   *
   * Se guarda el estado del asistente entero —con las urls de las fotos— y no
   * el pedido que va al servidor: retomar tiene que poder dibujar las miniaturas
   * sin salir a resolver cada id, y un borrador puede estar a medio llenar de
   * formas que el pedido definitivo no admite.
   */
  async function guardarBorrador() {
    setGuardandoBorrador(true);
    try {
      const res = await fetch("/api/admin/informes/borradores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: borradorGuardado,
          clienteId,
          // Editando, el borrador es de **ese** informe: al retomarlo hay que
          // volver a su edición, no abrir uno nuevo.
          informeId: editando?.id ?? null,
          titulo: titulo.trim() || null,
          contenido: {
            paso: step,
            clienteId,
            titulo,
            fecha,
            rango: dateRange,
            visitaIds: Array.from(selectedVisitaIds),
            firmantes: firmantes
              .filter((f) => f.nombre.trim())
              .map((f) => ({ nombre: f.nombre.trim(), cedula: f.cedula.trim() || null })),
            secciones: secciones.map((sec) => ({
              productoId: sec.productoId,
              titulo: sec.titulo,
              descripcion: sec.descripcion,
              saltoDePagina: sec.saltoDePagina,
              fotosPorFila: sec.fotosPorFila,
              fotos: sec.fotos.map((f) => ({
                visitaMediaId: f.visitaMediaId,
                mediaId: f.mediaId,
                url: f.url,
              })),
            })),
          } satisfies EstadoInicialInforme & { paso: number },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No pudimos guardarlo");
      setBorradorGuardado(data.id);
      toast.success("Borrador guardado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos guardarlo");
    } finally {
      setGuardandoBorrador(false);
    }
  }

  async function generate() {
    const cuerpo = cuerpoDelInforme();
    if (!cuerpo) return;
    setGenerating(true);
    setPdfUrl(null);
    try {
      // Editando es un PUT sobre el mismo informe: sube una versión, conserva
      // el número y deja el PDF anterior en la lista. Crear otro sería un
      // segundo informe casi igual, que es justo lo que se venía haciendo por
      // no poder editar.
      const res = await fetch(
        editando ? `/api/admin/informes/${editando.id}` : "/api/admin/informes",
        {
          method: editando ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            editando ? { ...cuerpo, nota: notaDeCambio.trim() || null } : cuerpo
          ),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Error generando informe");
      }
      const data: { id: string; pdfUrl: string } = await res.json();
      setSavedInformeId(data.id);
      setPdfUrl(data.pdfUrl);
      setStep(5);
      // El borrador ya cumplió: dejarlo sería ofrecer retomar algo que se
      // terminó, y a la larga una lista de borradores ya publicados.
      if (borradorGuardado) {
        void fetch(`/api/admin/informes/borradores/${borradorGuardado}`, {
          method: "DELETE",
        }).catch(() => {});
        setBorradorGuardado(null);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error generando informe");
    } finally {
      setGenerating(false);
    }
  }

  // ──────────────── Render ────────────────

  const stepHeadings: Record<
    WizardStep,
    { title: string; description: string }
  > = {
    1: {
      title: "Cliente y visitas",
      description:
        "De quién es el informe y qué visitas cubre. Podés seguir sin elegir ninguna visita y armar las secciones a mano.",
    },
    2: {
      title: "Componer secciones",
      description:
        "Arma las secciones del informe asignándole fotos del pool a cada una.",
    },
    3: {
      title: "Firma y fecha",
      description: "Con qué fecha sale el informe y quién lo firma.",
    },
    4: {
      title: "Vista previa",
      description:
        "El PDF como va a salir. Si algo no cuadra, vuelve y ajústalo — todavía no se guardó nada.",
    },
    5: {
      title: "Listo",
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

      {/* Los pasos, arriba y en una franja */}
      <div className="border-b bg-muted/20 px-6 py-2">
        <PasosHorizontales
          step={step}
          onJump={(s) => {
            if (!terminado && s <= step) setStep(s);
          }}
          terminado={terminado}
        />
      </div>

      {/* Body: el contenido y, cuando corresponde, la vista previa al lado */}
      <main className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1">
          <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
            {step === 1 ? (
              <Paso1ClienteYVisitas
                clientes={clientes}
                clienteId={clienteId}
                bloqueado={editando != null}
                onClienteChange={(id) => {
                  setClienteId(id);
                  setSelectedVisitaIds(new Set());
                  setTitulo("");
                }}
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
                  setSelectedVisitaIds(
                    all
                      ? new Set(availableVisitas.map((v) => v.id))
                      : new Set(),
                  );
                }}
                loading={loadingVisitas}
              />
            ) : null}

            {step === 2 ? (
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
              />
            ) : null}

            {step === 3 ? (
              <Step4Firmantes
                firmantes={firmantes}
                onChange={setFirmantes}
                catalog={firmantesCatalog}
                fecha={fecha}
                onFechaChange={setFecha}
              />
            ) : null}

            {step === 4 ? (
              <div className="space-y-4">
                <PasoVistaPrevia
                  url={previewUrl}
                  armando={previsualizando}
                  onExpandir={() =>
                    previewUrl && setAPantallaCompleta(previewUrl)
                  }
                />
                {editando ? (
                  <div className="max-w-xl space-y-1.5">
                    <label className="text-sm font-medium">
                      Qué cambiaste{" "}
                      <span className="font-normal text-muted-foreground">
                        (opcional)
                      </span>
                    </label>
                    <Input
                      value={notaDeCambio}
                      onChange={(e) => setNotaDeCambio(e.target.value)}
                      placeholder="Ej. Faltaban las fotos del riego"
                      maxLength={500}
                    />
                    <p className="text-xs text-muted-foreground">
                      Queda al lado de la versión, para saber por qué se rehízo
                      sin abrir las dos y compararlas.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {step === 5 && pdfUrl ? (
              <PasoListo
                pdfUrl={pdfUrl}
                titulo={titulo}
                informeId={savedInformeId}
              />
            ) : null}
          </div>

          {/* Al lado y no debajo: el punto es ver el efecto de lo que se toca
              sin dejar de mirar lo que se toca. Desde `xl` porque abajo de eso
              las dos columnas dejan a las dos sin ancho. */}
          {step === 2 ? (
            <aside className="hidden w-[420px] flex-none flex-col border-l bg-muted/20 xl:flex">
              <PanelEnVivo
                url={enVivo.url}
                actualizando={enVivo.actualizando}
                error={enVivo.error}
                onExpandir={() =>
                  enVivo.url && setAPantallaCompleta(enVivo.url)
                }
              />
            </aside>
          ) : null}
        </div>

        {/* Nav footer — only spans the right column. */}
        <div className="border-t bg-card px-6 py-3">
          <div className="flex items-center justify-between gap-2">
            {/* Una vez generado no hay Atrás: el informe ya existe y no se
                edita, así que volver solo serviría para generar un segundo
                informe casi igual sin querer. */}
            {!terminado ? (
              <Button
                variant="ghost"
                disabled={step === 1 || generating}
                onClick={() =>
                  setStep((s) => (s > 1 ? ((s - 1) as WizardStep) : s))
                }
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Atrás
              </Button>
            ) : null}

            {/* Todo lo demás junto a la derecha: son las salidas de esta
                pantalla —seguir, dejarlo guardado, abandonar— y repartidas en
                los dos extremos había que buscarlas en dos lados. */}
            <div className="flex items-center gap-2">
              {!terminado ? (
                <>
                  {/* También editando: una corrección se puede dejar por la
                      mitad igual que un informe nuevo, y el borrador recuerda
                      de qué informe era. Mientras tanto el informe sigue
                      publicado con la versión que tiene. */}
                  <Button
                    variant="ghost"
                    className="text-muted-foreground"
                    onClick={guardarBorrador}
                    disabled={guardandoBorrador || generating}
                  >
                    <Save className="mr-1 h-4 w-4" />
                    {guardandoBorrador ? "Guardando…" : "Guardar borrador"}
                  </Button>
                  {/* Salir de la edición. Solo editando: en uno nuevo no hay a
                      dónde volver, y el borrador es lo que evita perder el
                      trabajo. */}
                  {editando ? (
                    <Button
                      variant="ghost"
                      className="text-muted-foreground"
                      onClick={() => setSaliendo(true)}
                      disabled={generating}
                    >
                      Cancelar
                    </Button>
                  ) : null}
                </>
              ) : null}

              {step === 1 ? (
                <Button onClick={nextFromStep1} disabled={!clienteId}>
                  Continuar <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : null}
              {step === 2 ? (
                <>
                  {/* Solo donde el panel no entra: con pantalla ancha ya está
                      a la vista, y un botón para taparla es una opción que
                      nadie viene a buscar. Angosto, abrirla a pantalla completa
                      es la única forma de verla. */}
                  <Button
                    variant="outline"
                    className="xl:hidden"
                    onClick={vistaPrevia}
                    disabled={previsualizando}
                  >
                    <FileText className="mr-1 h-4 w-4" />
                    {previsualizando ? "Armando…" : "Vista previa"}
                  </Button>
                  <Button onClick={nextFromStep2}>
                    Continuar <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </>
              ) : null}
              {step === 3 ? (
                <Button onClick={nextFromStep3} disabled={previsualizando}>
                  {previsualizando ? "Armando…" : "Ver cómo queda"}{" "}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : null}
              {step === 4 ? (
                <Button
                  onClick={generate}
                  disabled={generating || previsualizando}
                >
                  {generating
                    ? "Generando…"
                    : editando
                      ? "Guardar versión nueva"
                      : "Generar PDF"}{" "}
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
        </div>
      </main>

      <Dialog open={saliendo} onOpenChange={(v) => !v && setSaliendo(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salir de la edición</DialogTitle>
            {/* Lo que de verdad pasa: el informe queda como está, y lo que se
                pierde es lo que se venía cambiando. */}
            <DialogDescription>
              El informe #{editando?.numero} queda como está, con la versión que
              ya tiene. Se pierden los cambios que hiciste aquí — si quieres
              seguir después, guardalos como borrador.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaliendo(false)}>
              Seguir editando
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                router.push(`/dashboard/informes/${editando?.id}`)
              }
            >
              Salir sin guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {aPantallaCompleta ? (
        <VisorPdf
          url={aPantallaCompleta}
          onCerrar={() => setAPantallaCompleta(null)}
        />
      ) : null}
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
      firmantes.map((f) => (f.tempId === tempId ? { ...f, ...patch } : f)),
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
          <DatePicker
            value={fecha}
            onChange={(v) => onFechaChange(v || fecha)}
          />
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
                  "application/x-firmante",
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
            <DropdownMenuItem onClick={add}>Firmante nuevo</DropdownMenuItem>
            {catalog.length > 0 ? (
              <>
                <div className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Guardados
                </div>
                {catalog.map((s) => {
                  const alreadyAdded = firmantes.some(
                    (f) => f.nombre === s.nombre,
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

/**
 * Los pasos, en una tira horizontal arriba del contenido.
 *
 * Era una columna de 256 px a la izquierda, y esa columna se la comía al editor
 * de secciones —que es donde se pasa el tiempo— para mostrar cinco renglones
 * que no cambian. Arriba ocupa una franja y devuelve todo el ancho.
 */
function PasosHorizontales({
  step,
  onJump,
  terminado,
}: {
  step: WizardStep;
  onJump: (s: WizardStep) => void;
  /** El informe ya existe: no se vuelve a ningún paso. */
  terminado: boolean;
}) {
  const items: Array<{ n: WizardStep; label: string }> = [
    { n: 1, label: "Cliente y visitas" },
    { n: 2, label: "Secciones" },
    { n: 3, label: "Firma y fecha" },
    { n: 4, label: "Vista previa" },
    { n: 5, label: "Listo" },
  ];

  return (
    <ol className="flex items-center gap-1 overflow-x-auto">
      {items.map((it, i) => {
        const hecho = it.n < step;
        const actual = it.n === step;
        const clickable = !terminado && it.n < step;
        return (
          <li key={it.n} className="flex flex-none items-center gap-1">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onJump(it.n)}
              className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition-colors disabled:cursor-default ${
                actual ? "bg-primary/10" : clickable ? "hover:bg-muted" : ""
              }`}
            >
              <span
                className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-semibold ${
                  hecho
                    ? "bg-primary text-primary-foreground"
                    : actual
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {hecho ? <Check className="h-3.5 w-3.5" /> : it.n}
              </span>
              <span
                className={`whitespace-nowrap text-xs ${
                  actual
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {it.label}
              </span>
            </button>
            {i < items.length - 1 ? (
              <span
                className={`h-px w-4 flex-none ${
                  it.n < step ? "bg-primary" : "bg-border"
                }`}
                aria-hidden
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

// ───────────── Step 1 ─────────────

/**
 * Cliente y visitas en un solo paso.
 *
 * Eran dos y elegir un cliente no es un paso: es un dato. Juntarlos también le
 * devuelve alto a la pantalla de las secciones, que es donde se trabaja de
 * verdad.
 *
 * Con el cliente ya elegido, la grilla se colapsa a un renglón: dejarla abierta
 * empujaba la lista de visitas fuera de la pantalla justo cuando pasa a ser lo
 * único que importa.
 */
function Paso1ClienteYVisitas({
  clientes,
  clienteId,
  onClienteChange,
  bloqueado,
  ...visitas
}: {
  clientes: Cliente[];
  clienteId: string | null;
  onClienteChange: (id: string) => void;
  /** Editando: el cliente no se cambia, así que se muestra cuál es y nada más. */
  bloqueado?: boolean;
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
  return (
    // El cliente en una columna angosta a la derecha y las visitas —que es lo
    // que ocupa lugar— en el resto. En pantalla chica se apilan, y el cliente
    // va primero en el DOM porque es lo primero que hay que elegir; el `order`
    // lo manda a la derecha recién cuando hay dos columnas.
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <aside className="lg:order-2">
        {bloqueado ? (
          <ClienteFijo
            cliente={clientes.find((c) => c.id === clienteId) ?? null}
          />
        ) : (
          <SelectorCliente
            clientes={clientes}
            clienteId={clienteId}
            onClienteChange={onClienteChange}
          />
        )}
      </aside>

      <div className="min-w-0 lg:order-1">
        {clienteId ? (
          <Step2Visitas {...visitas} />
        ) : (
          <div className="flex h-full min-h-[16rem] flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center">
            <Users className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">Elige un cliente primero</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Sus visitas con fotos van a aparecer aquí para que elijas cuáles
              cubre el informe.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * El cliente, cuando no se puede cambiar.
 *
 * Editando, `editarInforme` rechaza el cambio de cliente —sería otro informe—
 * así que ofrecer el buscador con toda la lista invita a una acción que después
 * se niega. Se muestra cuál es y listo.
 */
function ClienteFijo({ cliente }: { cliente: Cliente | null }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Cliente</p>
      <div className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2.5">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {cliente ? nombreCliente(cliente).slice(0, 2).toUpperCase() : "?"}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {cliente ? nombreCliente(cliente) : "Cargando…"}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Un informe no cambia de cliente: sería otro informe, con otro número.
      </p>
    </div>
  );
}

function SelectorCliente({
  clientes,
  clienteId,
  onClienteChange,
}: {
  clientes: Cliente[];
  clienteId: string | null;
  onClienteChange: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const elegido = useRef<HTMLButtonElement>(null);

  // Retomando un borrador el elegido puede estar a veinte filas de distancia,
  // o sea marcado pero fuera de la parte visible: se ve una lista sin nada
  // seleccionado. `nearest` para no mover la página, solo la lista.
  useEffect(() => {
    elegido.current?.scrollIntoView({ block: "nearest" });
  }, [clienteId, clientes.length]);
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
    <div className="space-y-3">
      <p className="text-sm font-medium">Cliente</p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre"
          className="pl-9"
          autoFocus
        />
      </div>

      {clientes.length === 0 ? (
        <EmptyState text="Cargando clientes…" />
      ) : filtered.length === 0 ? (
        <EmptyState text="Sin coincidencias." />
      ) : (
        /* Con scroll propio: la lista completa empujaba el resto de la página
           hacia abajo y dejaba las visitas fuera de la pantalla. */
        <div className="grid max-h-[26rem] gap-2 overflow-y-auto pr-1">
          {filtered.map((c) => {
            const selected = clienteId === c.id;
            const initials = nombreCliente(c).slice(0, 2).toUpperCase();
            return (
              <button
                key={c.id}
                ref={selected ? elegido : undefined}
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
  dateRange,
  onDateRangeChange,
  visitas,
  selectedIds,
  onToggle,
  onSelectAll,
  loading,
}: {
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
    // El cliente no se repite acá: está en la columna de al lado, a la vista.
    <div className="space-y-5">
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
    null,
  );
  const [sectionDragOverId, setSectionDragOverId] = useState<string | null>(
    null,
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
  /** Qué foto se está recortando, y de qué sección. */
  const [recortando, setRecortando] = useState<{
    tempId: string;
    foto: SeccionFotoDraft;
  } | null>(null);

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
              m.productoId === servicio.productoId && !assignedIds.has(m.id),
          )
          .map(fotoDeVisita)
      : [];
    const draft: SeccionDraft = {
      tempId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      productoId: servicio?.productoId ?? null,
      titulo: servicio?.nombre ?? "",
      descripcion: servicio?.descripcion ?? "",
      fotos: fotosDelServicio,
      ...LAYOUT_POR_DEFECTO,
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
      secciones.map((s) => (s.tempId === tempId ? { ...s, ...patch } : s)),
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
    antes: boolean,
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

  /**
   * Cambia una foto por su recorte, en el mismo lugar.
   *
   * En el lugar y no al final: el orden de las fotos es el orden en que salen
   * impresas, y recortar una no es reordenar la sección. Si el recorte ya
   * estaba en la sección, la vieja simplemente se va — dos veces la misma foto
   * no es lo que quiso nadie.
   */
  function reemplazarFoto(
    tempId: string,
    uid: string,
    nueva: SeccionFotoDraft,
  ) {
    const seccion = secciones.find((s) => s.tempId === tempId);
    if (!seccion) return;
    updateSeccion(tempId, {
      fotos: seccion.fotos
        .map((f) => (f.uid === uid ? nueva : f))
        .filter((f, i, todas) => todas.findIndex((o) => o.uid === f.uid) === i),
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
      // A la **biblioteca**, como cualquier otra imagen del portal. Antes el
      // archivo quedaba colgando de este informe y de nadie más: no se podía
      // reusar, ni recortar, ni encontrar.
      const nuevas = await subirALaBiblioteca(imagenes);
      const subidas: SeccionFotoDraft[] = nuevas.map((m) =>
        fotoDeBiblioteca(m),
      );

      addFotosToSeccion(tempId, subidas);
      toast.success(
        subidas.length === 1
          ? "Imagen agregada"
          : `${subidas.length} imágenes agregadas`,
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
            sectionDragOverId === s.tempId && draggingSectionId !== s.tempId;
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
                    <DescripcionSeccion
                      value={s.descripcion}
                      onChange={(descripcion) =>
                        updateSeccion(s.tempId, { descripcion })
                      }
                    />
                  </div>

                  <LayoutSeccion
                    seccion={s}
                    onCambiar={(patch) => updateSeccion(s.tempId, patch)}
                  />

                  {/* Photos area */}
                  <div className="px-4 pb-4 pt-2">
                    {hasPhotos ? (
                      <>
                        {/* Cuatro por fila, cinco en pantallas muy anchas.
                            Con seis la miniatura quedaba tan chica que no se
                            distinguía una foto de otra, que es justo para lo
                            que se las mira. */}
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 2xl:grid-cols-5">
                          {s.fotos.map((f) => (
                            /* Arrastrable para reordenar: en el PDF salen en
                                 este orden, y "la del antes primero" es una
                                 decisión que se toma aquí. */
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
                                  caja.height / 2,
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
                              {/* Tocar la foto la abre para editarla, como en
                                  el resto del portal: es lo que se quiere hacer
                                  con una foto que se está mirando, y el editor
                                  ya la muestra en grande. */}
                              <button
                                type="button"
                                onClick={() =>
                                  setRecortando({ tempId: s.tempId, foto: f })
                                }
                                // `overflow-hidden` aquí y no en el recuadro:
                                // ahí recortaría la barra que asoma al lado.
                                className="block h-full w-full overflow-hidden rounded-md"
                                title="Editar la foto"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={f.url}
                                  alt=""
                                  className="h-full w-full object-cover transition-transform hover:scale-105"
                                />
                              </button>
                              {/* Abajo a la izquierda: arriba a la derecha
                                  está el botón de quitar, y en una miniatura
                                  chica el cartel se le montaba encima.

                                  "Agregada" y no "Subida" porque también puede
                                  venir de la biblioteca. Lo que marca es la
                                  excepción: la mayoría sale de las visitas. */}
                              {!f.visitaMediaId ? (
                                <span
                                  className="pointer-events-none absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white"
                                  title="No viene de una visita: la subiste o la elegiste de la biblioteca"
                                >
                                  Agregada
                                </span>
                              ) : null}
                              <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeFotoFromSeccion(s.tempId, f.uid)
                                  }
                                  className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
                                  title="Quitar de esta sección"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
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
                            : "Arrastra imágenes aquí, o elígelas de las visitas."}
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

      {/* El recorte sale a la biblioteca en los dos casos, y el original queda
          donde estaba: si la foto era de una visita, la visita conserva la
          suya —es el registro de lo que se vio en el jardín— y esta sección
          pasa a mostrar el encuadre. */}
      {recortando ? (
        <EditorImagen
          media={{
            id: recortando.foto.visitaMediaId ?? recortando.foto.mediaId!,
            url: recortando.foto.url,
            alt: null,
          }}
          origen={recortando.foto.visitaMediaId ? "visita" : "biblioteca"}
          onCerrar={() => setRecortando(null)}
          onGuardado={(nueva) => {
            const donde = recortando;
            setRecortando(null);
            reemplazarFoto(
              donde.tempId,
              donde.foto.uid,
              fotoDeBiblioteca(nueva),
            );
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
  const [eligiendoBiblioteca, setEligiendoBiblioteca] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function subir(files: File[]) {
    const imagenes = files.filter((f) => f.type.startsWith("image/"));
    if (imagenes.length < files.length) {
      toast.error(
        imagenes.length === 0
          ? "Solo se pueden agregar imágenes"
          : "Se descartaron los archivos que no son imágenes",
      );
    }
    if (imagenes.length === 0) return;
    if (!clienteId) return toast.error("Selecciona un cliente primero");

    setSubiendo(true);
    try {
      // A la biblioteca, igual que en el resto del portal: así se pueden
      // reusar, recortar y encontrar después.
      const subidasNuevas = await subirALaBiblioteca(imagenes);
      setSubidas((prev) => [
        ...prev,
        ...subidasNuevas.map((m) => fotoDeBiblioteca(m)),
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al subir imágenes");
    } finally {
      setSubiendo(false);
    }
  }

  const total = selected.size + subidas.length;

  return (
    <>
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
                  ? "Soltá las imágenes aquí"
                  : "Arrastra imágenes de tu computadora, o"}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
                disabled={subiendo}
              >
                <Upload className="mr-1 h-4 w-4" /> Buscar en mi computadora
              </Button>
              {/* Las fotos del portal viven todas en la misma biblioteca, así que
                una que ya se subió para un producto sirve aquí sin volver a
                buscarla en el disco. */}
              <Button
                variant="ghost"
                size="sm"
                className="text-primary hover:bg-transparent hover:underline"
                onClick={() => setEligiendoBiblioteca(true)}
                disabled={subiendo}
              >
                Elegir de la biblioteca
              </Button>
            </div>
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
                    <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      Agregada
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setSubidas((prev) =>
                          prev.filter((x) => x.uid !== f.uid),
                        )
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

      {/* Fuera del fondo que cierra al clic, **a propósito**. El fondo de este
          modal está hecho a mano y cierra con `onClick`, y el diálogo de la
          biblioteca se dibuja en un portal: el DOM lo saca de aquí, pero React
          propaga los eventos por su propio árbol igual. Adentro, elegir una
          foto llegaba al fondo y cerraba los dos modales sin agregar nada. */}
      {eligiendoBiblioteca && (
        <MediaLibrary
          // Las que ya se eligieron acá no se vuelven a ofrecer.
          yaUsadas={subidas
            .map((f) => f.mediaId)
            .filter((id): id is string => Boolean(id))}
          onCerrar={() => setEligiendoBiblioteca(false)}
          onElegirItems={(items) => {
            setEligiendoBiblioteca(false);
            setSubidas((prev) => [...prev, ...items.map(fotoDeBiblioteca)]);
          }}
        />
      )}
    </>
  );
}

// ───────────── Step 3 ─────────────

/**
 * Cómo se imprime una sección.
 *
 * El corte de páginas se arregla solo —un título nunca queda al pie sin lo que
 * sigue— pero eso decide *dónde* cortar, no *cómo* se ve. Estas tres cosas sí:
 * cuántas fotos entran por fila (que es la densidad, y por lo tanto cuánto
 * espacio en blanco queda), si la sección arranca en hoja nueva y si puede
 * partirse. Van acá abajo y en letra chica porque el 90% de las secciones no
 * las toca.
 */
function LayoutSeccion({
  seccion,
  onCambiar,
}: {
  seccion: SeccionDraft;
  onCambiar: (patch: Partial<SeccionDraft>) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 pt-3 text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <span>Fotos por fila</span>
        <div className="flex overflow-hidden rounded-md border">
          {([2, 3, 4] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onCambiar({ fotosPorFila: n })}
              disabled={seccion.fotos.length === 0}
              className={`h-6 w-7 tabular-nums transition-colors disabled:opacity-40 ${
                seccion.fotosPorFila === n
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <label className="flex cursor-pointer items-center gap-1.5">
        <Checkbox
          checked={seccion.saltoDePagina}
          onCheckedChange={(v) => onCambiar({ saltoDePagina: v === true })}
        />
        Empezar en hoja nueva
      </label>
    </div>
  );
}

/**
 * La descripción de una sección, en un campo que crece con lo que se escribe.
 *
 * Es un párrafo, no un renglón: con dos líneas fijas se escribía mirando por
 * una ranura y había que desplazar para releer lo que uno mismo acababa de
 * poner. Arranca en cuatro líneas y se estira hasta el tope; recién ahí
 * aparece la barra.
 */
function DescripcionSeccion({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Primero a `auto`: si no, `scrollHeight` nunca baja y el campo solo crece.
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={4}
      className="block max-h-72 w-full resize-none overflow-y-auto rounded-md border-0 bg-transparent px-0 py-1 text-sm leading-relaxed text-muted-foreground focus:text-foreground focus:outline-none"
      placeholder="Descripción de la sección (opcional)"
    />
  );
}

/**
 * Cómo se pide un PDF incrustado, sin la barra del visor del navegador.
 *
 * Son parámetros del visor de Chrome/Edge: ahí la barra desaparece, y en
 * Firefox y Safari se ignoran y sigue estando. No hay forma de sacarla en todos
 * —el visor es del navegador, no de la página— así que esto es lo mejor que se
 * puede hacer sin dibujar un visor propio.
 *
 * Va en todos los visores, incluido el de pantalla completa: lo que se mira es
 * el documento, y la barra del navegador ofrece descargar e imprimir un archivo
 * que todavía no existe —la previa es un blob que no se guardó en ningún lado—.
 */
const SIN_BARRA = "#toolbar=0&navpanes=0&scrollbar=0&view=FitH";

/**
 * El PDF ocupando la pantalla.
 *
 * Un popup y no otra pestaña: el asistente sigue montado atrás, así que cerrar
 * devuelve exactamente al lugar donde se estaba, sin buscar la pestaña de vuelta
 * ni perder lo que se venía editando. Es el mismo blob que ya está en memoria,
 * o sea que abrir es instantáneo.
 */
function VisorPdf({ url, onCerrar }: { url: string; onCerrar: () => void }) {
  useEffect(() => {
    const alTeclado = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", alTeclado);
    return () => window.removeEventListener("keydown", alTeclado);
  }, [onCerrar]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/70 p-3 sm:p-6">
      <div className="mb-2 flex flex-none items-center justify-between gap-3">
        <span className="text-sm font-medium text-white">Vista previa</span>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20 hover:text-white"
          onClick={onCerrar}
          title="Cerrar (Esc)"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
      <iframe
        src={`${url}${SIN_BARRA}`}
        title="Vista previa del informe"
        className="min-h-0 flex-1 rounded-md bg-white"
      />
    </div>
  );
}

/**
 * El panel de al lado en el paso de las secciones.
 *
 * Muestra el PDF de verdad —achicado, no una maqueta— y se rehace solo cuando
 * la mano para. Mientras se rehace se sigue viendo el anterior: parpadear a
 * vacío en cada cambio hace imposible comparar, que es para lo que está.
 */
function PanelEnVivo({
  url,
  actualizando,
  error,
  onExpandir,
}: {
  url: string | null;
  /**
   * Lo que se ve ya no es lo que hay en pantalla — desde la tecla, no desde que
   * sale el pedido.
   */
  actualizando: boolean;
  error: string | null;
  onExpandir: () => void;
}) {
  return (
    <>
      {/* Un solo botón: agrandarla. Ocultar el panel ya está en la barra de
          abajo, y rearmarla no hace falta — se rearma sola. */}
      <div className="flex flex-none items-center justify-between gap-2 border-b px-3 py-2">
        <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          Vista previa
          {actualizando ? (
            <Loader2
              className="h-3 w-3 animate-spin"
              aria-label="Actualizando"
            />
          ) : null}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onExpandir}
          disabled={!url}
          title="Verla en grande"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="relative min-h-0 flex-1 p-2">
        {url ? (
          <iframe
            src={`${url}${SIN_BARRA}`}
            title="Vista previa del informe"
            className="h-full w-full rounded-md border bg-white"
          />
        ) : (
          <p className="flex h-full items-center justify-center px-6 text-center text-xs text-muted-foreground">
            {error
              ? error
              : actualizando
                ? "Armando la vista previa…"
                : "Agrega una sección para ver cómo queda."}
          </p>
        )}
        {/* Encima y translúcido, no en lugar del visor: se sigue viendo lo
            anterior, atenuado, que es justo lo que hay que decir — "esto ya no
            es lo que tienes en pantalla". Un recuadro vacío en cada tecla haría
            imposible comparar, que es para lo que está el panel. */}
        {actualizando && url ? (
          <div className="absolute inset-2 flex items-center justify-center gap-2 rounded-md bg-background/70 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Actualizando…
          </div>
        ) : null}
      </div>
    </>
  );
}

/**
 * El PDF como va a salir, antes de guardarlo.
 *
 * Va incrustado y no en otra pestaña: es un paso del asistente, y el punto es
 * mirarlo y volver a corregir sin perder de vista dónde se está. Lo que se ve
 * sale del mismo armado que el informe definitivo, así que no es una
 * aproximación — es el documento.
 */
function PasoVistaPrevia({
  url,
  armando,
  onExpandir,
}: {
  url: string | null;
  armando: boolean;
  onExpandir: () => void;
}) {
  return (
    <div className="space-y-3">
      {/* Nada de "volver a armar": se rearma sola al entrar al paso. Lo único
          que falta desde aquí es verla más grande. */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Todavía no se guardó nada. Si algo no cuadra, vuelve y ajústalo.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={onExpandir}
          disabled={!url || armando}
        >
          <Maximize2 className="mr-1 h-4 w-4" /> Verla en grande
        </Button>
      </div>

      <div className="relative h-[70vh] w-full overflow-hidden rounded-md border bg-muted">
        {url ? (
          <iframe
            src={`${url}${SIN_BARRA}`}
            title="Vista previa del informe"
            className="h-full w-full"
          />
        ) : null}
        {armando ? (
          // Encima y no en lugar del visor: mientras se rearma, seguir viendo
          // lo anterior dice mucho más que un recuadro vacío.
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-background/70 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Armando la vista previa…
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PasoListo({
  pdfUrl,
  titulo,
  informeId,
}: {
  pdfUrl: string;
  titulo: string;
  /** El informe recién creado, para poder abrir su ficha. */
  informeId: string | null;
}) {
  const cleanUrl = `${pdfUrl}${SIN_BARRA}`;

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
          {/* La ficha es donde el informe vive de aquí en adelante: desde ahí
              se descarga y se elimina si salió mal. */}
          {informeId ? (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={`/dashboard/informes/${informeId}`} />}
            >
              <FileText className="h-4 w-4 mr-1.5" /> Ver informe
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(pdfUrl, "_blank", "noopener,noreferrer")}
          >
            <ExternalLink className="h-4 w-4 mr-1.5" /> Abrir en pestaña
          </Button>
          {/* Igual que en la ficha: `download` no funciona entre dominios,
              así que la descarga pasa por nuestra ruta. */}
          <Button
            size="sm"
            nativeButton={false}
            render={
              <a
                href={
                  informeId
                    ? `/api/admin/informes/${informeId}/descargar`
                    : pdfUrl
                }
              />
            }
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

function quickRange(key: "este-mes" | "mes-pasado" | "ultimos-30"): {
  label: string;
  from: string;
  to: string;
} {
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
