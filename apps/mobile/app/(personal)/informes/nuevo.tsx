import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Button,
  HelperText,
  Searchbar,
  Text,
  TextInput,
} from "react-native-paper";
import { Calendar, type DateData } from "react-native-calendars";
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from "react-native-draggable-flatlist";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EncabezadoDePasos } from "@/components/ui/EncabezadoDePasos";
import { HojaInferior } from "@/components/ui/HojaInferior";
import { Ionicons } from "@expo/vector-icons";
import {
  encabezadoPorDefecto,
  fechaSola,
  nombreCliente,
  primeraLineaPlana,
  textoPlanoDeHtml,
} from "@vivero/shared";
import { apiRequest, mensajeDeError } from "@/lib/api";
import type {
  ClienteListItem,
  ClientesListResponse,
} from "@/lib/types";
import { tema } from "@/lib/tema";
import {
  SelectorDeSeccion,
  type TareaCatalogo,
  type TareaParaSeccion,
} from "@/components/informes/SelectorDeSeccion";
import {
  ARRIBA_DE_LA_HOJA,
  SelectorDeFotos,
  fotoDeBiblioteca,
  fotoDeVisita,
  type MediaPoolItem,
  type SeccionFotoDraft,
} from "@/components/informes/SelectorDeFotos";
import {
  FichaDeSeccion,
  type AlineacionDeFotos,
  type FotosPorFila,
} from "@/components/informes/FichaDeSeccion";
import { EditorDeEncabezado } from "@/components/informes/EditorDeEncabezado";
import { VisorDePdf } from "@/components/informes/VisorDePdf";
import {
  RecortarFoto,
  type EdicionDeFoto,
} from "@/components/informes/RecortarFoto";

// ───────── types ─────────

interface VisitaPI {
  id: string;
  fechaProgramada: string;
  estado: "COMPLETADA" | "INCOMPLETA";
  servicioNombre: string;
  fotosCount: number;
}

interface SavedFirmante {
  id: string;
  nombre: string;
  cedula: string | null;
  isDefault: boolean;
}

interface SeccionDraft {
  tempId: string;
  /// La tarea que origina la sección. Null = sección personalizada.
  tareaId: string | null;
  titulo: string;
  descripcion: string;
  fotos: SeccionFotoDraft[];
  /** Cómo se imprime, como en el portal. Los defaults son lo de siempre. */
  saltoDePagina: boolean;
  fotosPorFila: FotosPorFila;
  fotosAlineacion: AlineacionDeFotos;
}

/** Lo que el asistente lee de `GET /api/mobile/informes/[id]` para editar. */
interface InformeParaEditar {
  titulo: string;
  encabezado: string | null;
  fecha: string;
  fechaDesde: string | null;
  fechaHasta: string | null;
  cliente: { id: string; nombre: string; apellido?: string | null; empresa: string | null };
  visitas: { id: string }[];
  firmantes: { nombre: string; cedula: string | null }[];
  secciones: {
    tareaId: string | null;
    titulo: string;
    descripcion: string;
    saltoDePagina: boolean;
    fotosPorFila: FotosPorFila;
    fotosAlineacion: AlineacionDeFotos;
    fotos: { visitaMediaId: string | null; mediaId: string | null; url: string }[];
  }[];
}

interface FirmanteDraft {
  tempId: string;
  nombre: string;
  cedula: string;
}

type Step = 0 | 1 | 2 | 3;
const STEP_LABELS = ["Cliente", "Visitas", "Secciones", "Firmantes"];
const ACCENT = tema.verde;

// ───────── main ─────────

export default function NuevoInformeScreen() {
  const router = useRouter();
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  /**
   * Con `?id=` el asistente **edita** ese informe: se carga entero —cliente,
   * visitas, encabezado, secciones, firmantes, fecha impresa— y arranca en
   * las secciones; el cliente no se cambia, así que el primer paso es el de
   * las visitas. Guardar hace una versión nueva, como en el portal.
   */
  const { id: informeId } = useLocalSearchParams<{ id?: string }>();
  const editando = !!informeId;
  const primerPaso: Step = editando ? 1 : 0;
  const [step, setStep] = useState<Step>(0);
  const [cargandoInforme, setCargandoInforme] = useState(editando);
  /** La fecha impresa, `YYYY-MM-DD`: al editar se conserva la del informe. */
  const [fecha, setFecha] = useState<string | null>(null);

  // Reference data
  const [clientes, setClientes] = useState<ClienteListItem[]>([]);
  const [serviciosDisponibles, setServiciosDisponibles] = useState<
    TareaParaSeccion[]
  >([]);
  /** El catálogo entero: una sección puede ser de algo que nadie registró. */
  const [catalogoTareas, setCatalogoTareas] = useState<TareaCatalogo[]>([]);
  const [firmantesCatalog, setFirmantesCatalog] = useState<SavedFirmante[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(true);

  // Form state
  const [clienteId, setClienteId] = useState<string | null>(null);
  /**
   * El encabezado impreso, en HTML, escrito con el mismo editor que las
   * secciones. Se siembra con el de siempre en cuanto hay cliente.
   */
  const [encabezado, setEncabezado] = useState("");
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);
  const [visitas, setVisitas] = useState<VisitaPI[]>([]);
  const [loadingVisitas, setLoadingVisitas] = useState(false);
  const [selectedVisitaIds, setSelectedVisitaIds] = useState<Set<string>>(
    new Set()
  );
  const [pool, setPool] = useState<MediaPoolItem[]>([]);
  const [secciones, setSecciones] = useState<SeccionDraft[]>([]);
  const [firmantes, setFirmantes] = useState<FirmanteDraft[]>([
    { tempId: "1", nombre: "", cedula: "" },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [previsualizando, setPrevisualizando] = useState(false);
  /** La URL de la vista previa recién armada, mientras se mira. */
  const [urlDeVistaPrevia, setUrlDeVistaPrevia] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Photo picker modal state (which section is currently picking)
  const [photoPickerForSection, setPhotoPickerForSection] = useState<
    string | null
  >(null);

  // Load reference data on mount.
  useEffect(() => {
    Promise.all([
      apiRequest<ClientesListResponse>("/api/mobile/clientes", {
        query: { limit: 500 },
      }).then((r) => setClientes(r.items)),
      apiRequest<{ items: TareaCatalogo[] }>("/api/mobile/tareas")
        .then((r) => setCatalogoTareas(r.items))
        .catch(() => {}),
      apiRequest<{ items: SavedFirmante[] }>("/api/mobile/firmantes")
        .then((r) => {
          setFirmantesCatalog(r.items);
          // Seed firmantes with defaults if any.
          const defaults = r.items.filter((f) => f.isDefault).slice(0, 3);
          if (defaults.length > 0) {
            setFirmantes(
              defaults.map((f, i) => ({
                tempId: `default-${i}`,
                nombre: f.nombre,
                cedula: f.cedula ?? "",
              }))
            );
          }
        })
        .catch(() => {}),
    ])
      .catch(() => {})
      .finally(() => setLoadingRefs(false));
  }, []);

  // El informe que se edita, cargado una vez: cada pieza a su estado.
  useEffect(() => {
    if (!informeId) return;
    let cancelado = false;
    apiRequest<InformeParaEditar>(`/api/mobile/informes/${informeId}`)
      .then((d) => {
        if (cancelado) return;
        setClienteId(d.cliente.id);
        setSelectedVisitaIds(new Set(d.visitas.map((v) => v.id)));
        setDateFrom(d.fechaDesde ? d.fechaDesde.slice(0, 10) : null);
        setDateTo(d.fechaHasta ? d.fechaHasta.slice(0, 10) : null);
        setEncabezado(d.encabezado ?? encabezadoPorDefecto(d.titulo, nombreCliente(d.cliente)));
        setFecha(d.fecha);
        setFirmantes(
          d.firmantes.length > 0
            ? d.firmantes.map((f, i) => ({
                tempId: `f${i}`,
                nombre: f.nombre,
                cedula: f.cedula ?? "",
              }))
            : [{ tempId: "1", nombre: "", cedula: "" }]
        );
        setSecciones(
          d.secciones.map((sec, i) => ({
            tempId: `s${i}-${Date.now()}`,
            tareaId: sec.tareaId,
            titulo: sec.titulo,
            descripcion: sec.descripcion,
            fotos: sec.fotos.map((f) => ({
              uid: f.visitaMediaId ? `visita-${f.visitaMediaId}` : `media-${f.mediaId}`,
              visitaMediaId: f.visitaMediaId,
              mediaId: f.mediaId,
              url: f.url,
            })),
            saltoDePagina: sec.saltoDePagina,
            fotosPorFila: sec.fotosPorFila,
            fotosAlineacion: sec.fotosAlineacion,
          }))
        );
        setStep(2);
      })
      .catch((e) => {
        if (!cancelado) setError(mensajeDeError(e, "No pudimos cargar el informe"));
      })
      .finally(() => {
        if (!cancelado) setCargandoInforme(false);
      });
    return () => {
      cancelado = true;
    };
  }, [informeId]);

  // El encabezado de siempre, al salir del cliente: el mismo que el portal
  // ofrece, con el mes y el nombre.
  useEffect(() => {
    if (step >= 1 && !encabezado && clienteId) {
      const c = clientes.find((x) => x.id === clienteId);
      if (c) {
        const now = new Date();
        const monthYear = now.toLocaleDateString("es-EC", {
          month: "long",
          year: "numeric",
        });
        setEncabezado(
          encabezadoPorDefecto(
            `Informe de Áreas Verdes — ${capitalize(monthYear)} — ${nombreCliente(c)}`.trim(),
            nombreCliente(c)
          )
        );
      }
    }
  }, [step, encabezado, clienteId, clientes]);

  // Fetch visitas when entering step 1 (or filters change).
  useEffect(() => {
    if (step !== 1 || !clienteId) return;
    let cancelled = false;
    setLoadingVisitas(true);
    apiRequest<{ items: VisitaPI[] }>("/api/mobile/informes/visitas", {
      query: {
        clienteId,
        ...(dateFrom ? { from: dateFrom } : {}),
        ...(dateTo ? { to: dateTo } : {}),
      },
    })
      .then((r) => {
        if (!cancelled) setVisitas(r.items);
      })
      .catch(() => {
        if (!cancelled) setVisitas([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingVisitas(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step, clienteId, dateFrom, dateTo]);

  // Fetch media pool when entering step 2.
  useEffect(() => {
    if (step < 2 || selectedVisitaIds.size === 0) return;
    let cancelled = false;
    apiRequest<{ items: MediaPoolItem[] }>("/api/mobile/informes/media", {
      method: "POST",
      body: { visitaIds: Array.from(selectedVisitaIds) },
    })
      .then((r) => {
        if (!cancelled) setPool(r.items);
      })
      .catch(() => {
        if (!cancelled) setPool([]);
      })
      .finally(() => {
      });
    return () => {
      cancelled = true;
    };
  }, [step, selectedVisitaIds]);

  // Las tareas hechas en las visitas seleccionadas son el primer origen de
  // las secciones: título = nombre de la tarea, descripción = la suya.
  useEffect(() => {
    if (step < 2 || selectedVisitaIds.size === 0) return;
    let cancelled = false;
    apiRequest<{ items: TareaParaSeccion[] }>(
      "/api/mobile/informes/servicios",
      { method: "POST", body: { visitaIds: Array.from(selectedVisitaIds) } }
    )
      .then((r) => {
        if (!cancelled) setServiciosDisponibles(r.items);
      })
      .catch(() => {
        if (!cancelled) setServiciosDisponibles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [step, selectedVisitaIds]);

  const selectedCliente = useMemo(
    () => clientes.find((c) => c.id === clienteId) ?? null,
    [clientes, clienteId]
  );

  const assignedMediaIds = useMemo(() => {
    const set = new Set<string>();
    for (const s of secciones) {
      for (const f of s.fotos) {
        if (f.visitaMediaId) set.add(f.visitaMediaId);
      }
    }
    return set;
  }, [secciones]);

  const unassignedPool = useMemo(
    () => pool.filter((p) => !assignedMediaIds.has(p.id)),
    [pool, assignedMediaIds]
  );

  /** Las libres, y antes de ellas las que la sección ya tiene. */
  function poolParaElegir(tempId: string): MediaPoolItem[] {
    const seccion = secciones.find((s) => s.tempId === tempId);
    const propias = new Set(
      (seccion?.fotos ?? []).map((f) => f.visitaMediaId).filter(Boolean)
    );
    return [...pool.filter((m) => propias.has(m.id)), ...unassignedPool];
  }

  const canContinue = (): boolean => {
    switch (step) {
      case 0:
        return !!clienteId;
      case 1:
        /*
         * **Las visitas son opcionales.** Un informe que no sale de ninguna
         * visita es un documento igual —una recomendación, un relevamiento— y
         * acá no se podía avanzar sin marcar una: con un cliente sin visitas
         * con fotos en el rango, el asistente quedaba trabado en un paso que no
         * tenía nada para ofrecer.
         */
        return true;
      case 2:
        // El encabezado es como se llama el documento: sin él no hay informe.
        return (
          !!primeraLineaPlana(encabezado) &&
          secciones.length > 0 &&
          secciones.every((s) => textoPlanoDeHtml(s.titulo).length > 0)
        );
      case 3: {
        const valid = firmantes.filter((f) => f.nombre.trim().length > 0);
        return valid.length >= 1;
      }
      default:
        return true;
    }
  };

  function next() {
    setError(null);
    if (!canContinue()) return;
    if (step < 3) setStep(((step + 1) as Step));
  }
  function prev() {
    setError(null);
    if (step <= primerPaso) router.back();
    else setStep(((step - 1) as Step));
  }

  /**
   * Lo que se manda a generar, y también a previsualizar: si la vista previa
   * aceptara otra cosa, mostraría un documento distinto del que se archiva.
   */
  function cuerpoDelInforme() {
    // El título de las listas es la primera línea del encabezado, como lo
    // deriva el servidor.
    return {
      clienteId,
      titulo: primeraLineaPlana(encabezado) ?? "Informe",
      encabezado,
      ...(fecha ? { fecha } : {}),
      visitaIds: Array.from(selectedVisitaIds),
      firmantes: firmantes
        .filter((f) => f.nombre.trim().length > 0)
        .map((f) => ({
          nombre: f.nombre.trim(),
          cedula: f.cedula.trim() || null,
        })),
      secciones: secciones.map((s) => ({
        tareaId: s.tareaId,
        titulo: s.titulo.trim(),
        descripcion: s.descripcion.trim() || null,
        fotos: s.fotos.map((f) =>
          f.visitaMediaId
            ? { visitaMediaId: f.visitaMediaId }
            : { mediaId: f.mediaId }
        ),
        saltoDePagina: s.saltoDePagina,
        fotosPorFila: s.fotosPorFila,
        // Solo cuando no es la izquierda, como el portal: el schema no le
        // pone default a propósito.
        ...(s.fotosAlineacion !== "IZQUIERDA"
          ? { fotosAlineacion: s.fotosAlineacion }
          : {}),
      })),
    };
  }

  /**
   * El PDF tal como saldría, en una ventana de la app. El servidor lo sube a
   * R2 y devuelve la URL; achicado (`borrador`), que para mirarlo en un
   * teléfono alcanza y tarda la mitad.
   */
  async function vistaPrevia() {
    setError(null);
    setPrevisualizando(true);
    try {
      const { url } = await apiRequest<{ url: string }>(
        "/api/mobile/informes/preview",
        { method: "POST", body: { ...cuerpoDelInforme(), borrador: true } }
      );
      setUrlDeVistaPrevia(url);
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos armar la vista previa"));
    } finally {
      setPrevisualizando(false);
    }
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      if (informeId) {
        // Una versión nueva del mismo informe, como el PUT del portal.
        await apiRequest(`/api/mobile/informes/${informeId}`, {
          method: "PUT",
          body: { ...cuerpoDelInforme(), nota: null },
        });
        router.replace(`/(personal)/informes/${informeId}`);
        return;
      }
      const result = await apiRequest<{ id: string; pdfUrl: string }>(
        "/api/mobile/informes",
        { method: "POST", body: cuerpoDelInforme() }
      );
      router.replace(`/(personal)/informes/${result.id}`);
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos generar"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingRefs || cargandoInforme) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior="padding"
    >
      <View style={styles.flex}>
        {/* La acción del paso arriba, a la derecha del contador, y no en un
            botón al pie: es donde están *Crear* y *Guardar* en las demás
            pantallas, y donde queda fijo mientras la lista scrollea. */}
        <EncabezadoDePasos
          paso={step - primerPaso}
          total={STEP_LABELS.length - primerPaso}
          onAtras={prev}
          accion={step < 3 ? "Continuar" : editando ? "Guardar" : "Generar"}
          onAccion={step < 3 ? next : submit}
          deshabilitado={step < 3 && !canContinue()}
          cargando={submitting || previsualizando}
        />

        {step === 2 ? (
          <View style={styles.flex}>
            <SeccionesStep
              secciones={secciones}
              onChangeSecciones={setSecciones}
              productos={serviciosDisponibles}
              catalogo={catalogoTareas}
              allPool={pool}
              clienteId={clienteId}
              onOpenPicker={(tempId) => setPhotoPickerForSection(tempId)}
              onVistaPrevia={() => void vistaPrevia()}
              previsualizando={previsualizando}
              encabezado={encabezado}
              onChangeEncabezado={setEncabezado}
              error={error}
            />
          </View>
        ) : (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {step === 0 && (
              <ClienteStep
                clientes={clientes}
                selectedId={clienteId}
                onSelect={setClienteId}
              />
            )}
            {step === 1 && (
              <VisitasStep
                cliente={selectedCliente}
                visitas={visitas}
                loading={loadingVisitas}
                dateFrom={dateFrom}
                dateTo={dateTo}
                onChangeDates={(f, t) => {
                  setDateFrom(f);
                  setDateTo(t);
                }}
                selectedIds={selectedVisitaIds}
                onToggle={(id) =>
                  setSelectedVisitaIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  })
                }
                onSelectAll={(all, ids) => {
                  if (all) setSelectedVisitaIds(new Set(ids));
                  else setSelectedVisitaIds(new Set());
                }}
              />
            )}
            {step === 3 && (
              <FirmantesStep
                firmantes={firmantes}
                onChange={setFirmantes}
                catalog={firmantesCatalog}
                onVistaPrevia={() => void vistaPrevia()}
                previsualizando={previsualizando}
              />
            )}

            {error ? (
              <HelperText type="error" visible style={styles.error}>
                {error}
              </HelperText>
            ) : null}
          </ScrollView>
        )}

      </View>

      {urlDeVistaPrevia ? (
        <VisorDePdf
          url={urlDeVistaPrevia}
          titulo="Vista previa"
          onCerrar={() => setUrlDeVistaPrevia(null)}
        />
      ) : null}

      {/* El selector de fotos: las de las visitas que ninguna sección tiene,
          más las que ya tiene *esta* —salen marcadas, y desmarcar una es
          quitarla—. Devuelve la lista final. */}
      {photoPickerForSection !== null ? (
        <SelectorDeFotos
          pool={poolParaElegir(photoPickerForSection)}
          enLaSeccion={
            secciones.find((s) => s.tempId === photoPickerForSection)?.fotos ??
            []
          }
          onCerrar={() => setPhotoPickerForSection(null)}
          onConfirmar={(fotos) => {
            setSecciones((prev) =>
              prev.map((s) =>
                s.tempId === photoPickerForSection ? { ...s, fotos } : s
              )
            );
            setPhotoPickerForSection(null);
          }}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

// ───────── Step 0: Cliente ─────────

function ClienteStep({
  clientes,
  selectedId,
  onSelect,
}: {
  clientes: ClienteListItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clientes.slice(0, 30);
    return clientes
      .filter((c) =>
        `${nombreCliente(c)} ${c.telefono ?? ""}`.toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [query, clientes]);

  return (
    <View>
      <Text variant="headlineSmall" style={styles.title}>
        ¿Para qué cliente?
      </Text>
      <Searchbar
        placeholder="Buscar por nombre o teléfono"
        value={query}
        onChangeText={setQuery}
        elevation={0}
        style={styles.search}
        inputStyle={styles.searchInput}
      />
      <View style={{ gap: 6 }}>
        {filtered.map((c) => {
          const selected = selectedId === c.id;
          const displayName = nombreCliente(c);
          const initials =
            displayName
              .split(" ")
              .filter(Boolean)
              .slice(0, 2)
              .map((w) => w[0])
              .join("")
              .toUpperCase() || "?";
          return (
            <Pressable
              key={c.id}
              onPress={() => onSelect(c.id)}
              style={({ pressed }) => [
                styles.card,
                selected && styles.cardSelected,
                pressed && !selected && styles.cardPressed,
              ]}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials || "?"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {displayName}
                </Text>
                {c.telefono ? (
                  <Text style={styles.cardSubtitle}>{c.telefono}</Text>
                ) : null}
              </View>
              {selected ? (
                <Ionicons name="checkmark-circle" size={22} color={ACCENT} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ───────── Step 1: Visitas ─────────

function VisitasStep({
  cliente,
  visitas,
  loading,
  dateFrom,
  dateTo,
  onChangeDates,
  selectedIds,
  onToggle,
  onSelectAll,
}: {
  cliente: ClienteListItem | null;
  visitas: VisitaPI[];
  loading: boolean;
  dateFrom: string | null;
  dateTo: string | null;
  onChangeDates: (from: string | null, to: string | null) => void;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: (all: boolean, ids: string[]) => void;
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const allSelected =
    visitas.length > 0 && visitas.every((v) => selectedIds.has(v.id));

  const activePreset = useMemo(
    () => detectActivePreset(dateFrom, dateTo),
    [dateFrom, dateTo]
  );

  const dateLabel = useMemo(() => {
    if (!dateFrom && !dateTo) return "Cualquier fecha";
    if (dateFrom && dateTo && dateFrom === dateTo)
      return formatLongDate(dateFrom);
    if (dateFrom && dateTo)
      return `${formatChip(dateFrom)} → ${formatChip(dateTo)}`;
    if (dateFrom) return `Desde ${formatChip(dateFrom)}`;
    return `Hasta ${formatChip(dateTo ?? "")}`;
  }, [dateFrom, dateTo]);

  return (
    <View>
      <Text variant="headlineSmall" style={styles.title}>
        Selecciona las visitas
      </Text>
      <Text style={styles.subtitle}>
        {cliente ? `Cliente: ${nombreCliente(cliente)}` : ""}
      </Text>

      <Text style={styles.label}>Rango de fechas</Text>
      <View style={styles.quickRow}>
        {(
          [
            ["todas", "Todas"],
            ["este-mes", "Este mes"],
            ["mes-pasado", "Mes pasado"],
            ["ultimos-30", "Últimos 30"],
            ["personalizado", "Personalizado"],
          ] as const
        ).map(([key, label]) => {
          const active =
            key === "todas" ? activePreset === null : activePreset === key;
          return (
            <Pressable
              key={key}
              onPress={() => {
                if (key === "todas") {
                  onChangeDates(null, null);
                  return;
                }
                if (key === "personalizado") {
                  setCalendarOpen(true);
                  return;
                }
                const r = presetRange(key);
                onChangeDates(r.from, r.to);
              }}
              style={({ pressed }) => [
                styles.quickChip,
                active && styles.quickChipActive,
                pressed && !active && styles.quickChipPressed,
              ]}
            >
              <Text
                style={[
                  styles.quickChipText,
                  active && styles.quickChipTextActive,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {dateFrom || dateTo ? (
        <Text style={styles.dateCaption} numberOfLines={1}>
          {dateLabel}
        </Text>
      ) : null}

      <DateRangeModal
        visible={calendarOpen}
        from={dateFrom}
        to={dateTo}
        onChange={onChangeDates}
        onClose={() => setCalendarOpen(false)}
      />

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>
          {visitas.length} visita{visitas.length === 1 ? "" : "s"} ·{" "}
          <Text style={{ color: "#222", fontWeight: "600" }}>
            {selectedIds.size} seleccionada
            {selectedIds.size === 1 ? "" : "s"}
          </Text>
        </Text>
        {visitas.length > 0 ? (
          <Pressable
            onPress={() =>
              onSelectAll(
                !allSelected,
                visitas.map((v) => v.id)
              )
            }
            style={({ pressed }) => [
              styles.selectAllBtn,
              pressed && styles.selectAllBtnPressed,
            ]}
          >
            <Ionicons
              name={
                allSelected
                  ? "remove-circle-outline"
                  : "checkmark-circle-outline"
              }
              size={14}
              color={ACCENT}
            />
            <Text style={styles.selectAllText}>
              {allSelected ? "Deseleccionar todas" : "Seleccionar todas"}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : visitas.length === 0 ? (
        <Text style={styles.empty}>
          No hay visitas con fotos para este cliente en el rango seleccionado.
          {"\n\n"}
          Puedes seguir igual: el informe se arma con las secciones que agregues
          en el paso siguiente.
        </Text>
      ) : (
        <View style={{ gap: 6 }}>
          {visitas.map((v) => {
            const selected = selectedIds.has(v.id);
            return (
              <Pressable
                key={v.id}
                onPress={() => onToggle(v.id)}
                style={({ pressed }) => [
                  styles.card,
                  selected && styles.cardSelected,
                  pressed && !selected && styles.cardPressed,
                ]}
              >
                <View
                  style={[
                    styles.checkbox,
                    selected && styles.checkboxSelected,
                  ]}
                >
                  {selected ? (
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  ) : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>
                    {formatLongDate(v.fechaProgramada.slice(0, 10))}
                  </Text>
                  <Text style={styles.cardSubtitle} numberOfLines={1}>
                    {v.servicioNombre}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text
                    style={[
                      styles.estadoChip,
                      v.estado === "COMPLETADA"
                        ? styles.estadoChipOk
                        : styles.estadoChipPending,
                    ]}
                  >
                    {v.estado === "COMPLETADA" ? "Completa" : "Incompleta"}
                  </Text>
                  <Text style={styles.fotosCount}>
                    {v.fotosCount} foto{v.fotosCount === 1 ? "" : "s"}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ───────── Step 2: Secciones ─────────

function SeccionesStep({
  secciones,
  onChangeSecciones,
  productos,
  catalogo,
  allPool,
  clienteId,
  onOpenPicker,
  encabezado,
  onChangeEncabezado,
  onVistaPrevia,
  previsualizando,
  error,
}: {
  secciones: SeccionDraft[];
  onChangeSecciones: (s: SeccionDraft[]) => void;
  productos: TareaParaSeccion[];
  catalogo: TareaCatalogo[];
  allPool: MediaPoolItem[];
  clienteId: string | null;
  onOpenPicker: (tempId: string) => void;
  /** El PDF tal como saldría, desde el ojo junto al título. */
  onVistaPrevia: () => void;
  previsualizando: boolean;
  /** El encabezado impreso, en HTML. */
  encabezado: string;
  onChangeEncabezado: (html: string) => void;
  error: string | null;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  /** La sección abierta en su ficha, y en qué pestaña se abre. */
  const [abierta, setAbierta] = useState<{ tempId: string; pestana: "texto" | "fotos" } | null>(null);
  const [editandoEncabezado, setEditandoEncabezado] = useState(false);
  /** La foto que se está recortando, y de qué sección. */
  const [recortando, setRecortando] = useState<{
    tempId: string;
    foto: SeccionFotoDraft;
  } | null>(null);
  const [guardandoRecorte, setGuardandoRecorte] = useState(false);
  const [avisoDeFoto, setAvisoDeFoto] = useState<string | null>(null);

  /**
   * Crea una sección. Con una tarea, el título y la descripción salen de la
   * tarea y arranca con las fotos etiquetadas con ella que estén libres.
   */
  function addSeccion(servicio: TareaParaSeccion | null) {
    setMenuOpen(false);
    const yaAsignadas = new Set(
      secciones.flatMap((s) =>
        s.fotos.map((f) => f.visitaMediaId).filter((id): id is string => !!id)
      )
    );
    const fotosDelServicio = servicio
      ? allPool
          .filter(
            (m) =>
              m.tareaId === servicio.tareaId &&
              !yaAsignadas.has(m.id)
          )
          .map(fotoDeVisita)
      : [];
    const nuevaId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    onChangeSecciones([
      ...secciones,
      {
        tempId: nuevaId,
        tareaId: servicio?.tareaId ?? null,
        titulo: servicio?.nombre ?? "",
        descripcion: servicio?.descripcion ?? "",
        fotos: fotosDelServicio,
        saltoDePagina: false,
        fotosPorFila: 3,
        fotosAlineacion: "IZQUIERDA",
      },
    ]);
    // Recién creada se abre en su texto, como en el portal.
    setAbierta({ tempId: nuevaId, pestana: "texto" });
  }
  function update(tempId: string, patch: Partial<SeccionDraft>) {
    onChangeSecciones(
      secciones.map((s) => (s.tempId === tempId ? { ...s, ...patch } : s))
    );
  }
  function remove(tempId: string) {
    onChangeSecciones(secciones.filter((s) => s.tempId !== tempId));
  }
  /**
   * Aplica el recorte y cambia la foto por su recorte, **en el mismo lugar**:
   * el orden de las fotos es el orden en que salen impresas. Lo aplica el
   * servidor con el mismo servicio que el portal y devuelve otra imagen, en
   * la biblioteca; el original queda donde estaba, y si la foto era de una
   * visita, la visita conserva la suya.
   */
  async function aplicarRecorte(edicion: EdicionDeFoto) {
    if (!recortando) return;
    const { tempId, foto } = recortando;
    setGuardandoRecorte(true);
    try {
      const id = foto.visitaMediaId ?? foto.mediaId;
      const { media } = await apiRequest<{ media: { id: string; url: string } }>(
        `/api/mobile/media/${id}/editar`,
        {
          method: "POST",
          body: {
            origen: foto.visitaMediaId ? "visita" : "biblioteca",
            ...edicion,
          },
        }
      );
      const nueva = fotoDeBiblioteca(media);
      const s = secciones.find((x) => x.tempId === tempId);
      if (s) {
        update(tempId, {
          fotos: s.fotos
            .map((f) => (f.uid === foto.uid ? nueva : f))
            .filter((f, i, todas) => todas.findIndex((o) => o.uid === f.uid) === i),
        });
      }
      setRecortando(null);
    } catch (e) {
      setAvisoDeFoto(mensajeDeError(e, "No pudimos recortar la foto"));
      setRecortando(null);
    } finally {
      setGuardandoRecorte(false);
    }
  }


  const indiceAbierto = abierta
    ? secciones.findIndex((x) => x.tempId === abierta.tempId)
    : -1;
  const seccionAbierta = indiceAbierto >= 0 ? secciones[indiceAbierto] : null;

  return (
    <View style={{ flex: 1 }}>
      <DraggableFlatList
        data={secciones}
        keyExtractor={(s) => s.tempId}
        onDragEnd={({ data }) => onChangeSecciones(data)}
        activationDistance={12}
        containerStyle={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListHeaderComponent={
          <View style={{ marginBottom: 12 }}>
            <TituloConVistaPrevia
              texto="Componer secciones"
              onVistaPrevia={onVistaPrevia}
              previsualizando={previsualizando}
              onAgregar={() => setMenuOpen(true)}
            />
            {/* El encabezado, primera fila, como en el portal: se escribe una
                vez por informe, y se abre igual que una sección. */}
            <Pressable
              onPress={() => setEditandoEncabezado(true)}
              style={({ pressed }) => [
                styles.encabezadoFila,
                pressed && styles.cardPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Editar el encabezado"
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.encabezadoRotulo}>Encabezado</Text>
                <Text
                  style={[styles.encabezadoTexto, !primeraLineaPlana(encabezado) && styles.muted]}
                  numberOfLines={2}
                >
                  {primeraLineaPlana(encabezado) ?? "Toca para escribirlo"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#888" />
            </Pressable>
          </View>
        }
        renderItem={({ item: s, drag, isActive, getIndex }: RenderItemParams<SeccionDraft>) => {
          const titulo = textoPlanoDeHtml(s.titulo);
          const descripcion = textoPlanoDeHtml(s.descripcion);
          const numero = (getIndex() ?? 0) + 1;
          return (
            <ScaleDecorator>
              {/* La fila del portal: el asa, el número, el título en plano,
                  cuántas fotos y el arranque de la descripción, y el chevron.
                  Tocarla abre la sección; mantenerla, la arrastra. */}
              <Pressable
                onPress={() => setAbierta({ tempId: s.tempId, pestana: "texto" })}
                onLongPress={drag}
                delayLongPress={200}
                style={({ pressed }) => [
                  styles.seccionFila,
                  isActive && styles.seccionCardActive,
                  pressed && styles.cardPressed,
                ]}
                accessibilityRole="button"
              >
                <View style={styles.dragHandle}>
                  <Ionicons name="reorder-three" size={20} color="#999" />
                </View>
                <View style={styles.seccionNumber}>
                  <Text style={styles.seccionNumeroTexto}>{numero}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.seccionDisplayTitle, !titulo && styles.muted]}
                    numberOfLines={1}
                  >
                    {titulo || "Sin título"}
                  </Text>
                  <Text style={styles.seccionMeta} numberOfLines={1}>
                    {s.fotos.length === 1 ? "1 foto" : `${s.fotos.length} fotos`}
                    {descripcion ? ` · ${descripcion}` : ""}
                  </Text>
                </View>
                <Pressable
                  onPress={() => remove(s.tempId)}
                  hitSlop={8}
                  style={({ pressed }) => [styles.tacho, pressed && styles.cardPressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Eliminar la sección"
                >
                  <Ionicons name="trash-outline" size={19} color="#c62828" />
                </Pressable>
                <Ionicons name="chevron-forward" size={20} color="#888" />
              </Pressable>
            </ScaleDecorator>
          );
        }}
        ListEmptyComponent={
          <View style={styles.sinSecciones}>
            <Text style={styles.sinSeccionesTexto}>
              Aún no hay secciones. Agrega una con el + de arriba.
            </Text>
          </View>
        }
        ListFooterComponent={
          <View style={{ marginTop: 16, gap: 8 }}>
            {/* Se abre desde el + junto al título. Un cajón y no un menú
                colgado del botón: son las tareas de las visitas más el
                catálogo entero, y eso es una lista. */}
            <SelectorDeSeccion
              visible={menuOpen}
              onCerrar={() => setMenuOpen(false)}
              deVisitas={productos}
              catalogo={catalogo}
              usadas={secciones
                .map((sec) => sec.tareaId)
                .filter((id): id is string => !!id)}
              onElegir={addSeccion}
            />
            {error || avisoDeFoto ? (
              <HelperText type="error" visible style={styles.error}>
                {error ?? avisoDeFoto}
              </HelperText>
            ) : null}
          </View>
        }
      />

      {seccionAbierta && abierta ? (
        <FichaDeSeccion
          key={seccionAbierta.tempId}
          seccion={seccionAbierta}
          indice={indiceAbierto}
          total={secciones.length}
          pestanaInicial={abierta.pestana}
          onCambiar={(patch) => update(seccionAbierta.tempId, patch)}
          onEliminar={() => {
            remove(seccionAbierta.tempId);
            setAbierta(null);
          }}
          onIr={(paso) => {
            const destino = secciones[indiceAbierto + paso];
            if (destino) setAbierta({ tempId: destino.tempId, pestana: "texto" });
          }}
          onCerrar={() => setAbierta(null)}
          onAgregarFotos={() => onOpenPicker(seccionAbierta.tempId)}
          onRecortar={(foto) => setRecortando({ tempId: seccionAbierta.tempId, foto })}
        />
      ) : null}
      {recortando ? (
        <RecortarFoto
          key={recortando.foto.uid}
          url={recortando.foto.url}
          guardando={guardandoRecorte}
          onCerrar={() => setRecortando(null)}
          onGuardar={(edicion) => void aplicarRecorte(edicion)}
        />
      ) : null}
      {editandoEncabezado ? (
        <EditorDeEncabezado
          html={encabezado}
          onCerrar={() => setEditandoEncabezado(false)}
          onGuardar={(html) => {
            onChangeEncabezado(html);
            setEditandoEncabezado(false);
          }}
        />
      ) : null}
    </View>
  );
}

// ───────── El título de un paso, con el ojo ─────────

/**
 * El título del paso y, a su derecha, el ojo que abre la vista previa del
 * PDF: en los dos pasos donde cambia lo que se imprime —las secciones y la
 * firma—. Estaba en un ⋯ del encabezado, y un ⋯ con una sola opción es una
 * puerta que esconde un botón. En las secciones lleva además el + de
 * *Agregar sección*.
 */
function TituloConVistaPrevia({
  texto,
  onVistaPrevia,
  previsualizando,
  onAgregar,
}: {
  texto: string;
  onVistaPrevia: () => void;
  previsualizando: boolean;
  /** El + de *Agregar sección*, en el paso que lo tiene. */
  onAgregar?: () => void;
}) {
  return (
    <View style={styles.tituloConOjo}>
      <Text style={styles.tituloTexto}>{texto}</Text>
      {onAgregar ? (
        <Pressable
          onPress={onAgregar}
          hitSlop={8}
          style={({ pressed }) => [styles.ojo, pressed && styles.cardPressed]}
          accessibilityRole="button"
          accessibilityLabel="Agregar sección"
        >
          <Ionicons name="add" size={22} color={ACCENT} />
        </Pressable>
      ) : null}
      <Pressable
        onPress={onVistaPrevia}
        disabled={previsualizando}
        hitSlop={8}
        style={({ pressed }) => [styles.ojo, pressed && styles.cardPressed]}
        accessibilityRole="button"
        accessibilityLabel="Vista previa del PDF"
      >
        {previsualizando ? (
          <ActivityIndicator size="small" color={ACCENT} />
        ) : (
          <Ionicons name="eye-outline" size={19} color={ACCENT} />
        )}
      </Pressable>
    </View>
  );
}

// ───────── Step 3: Firmantes ─────────

function FirmantesStep({
  firmantes,
  onChange,
  catalog,
  onVistaPrevia,
  previsualizando,
}: {
  firmantes: FirmanteDraft[];
  onChange: (next: FirmanteDraft[]) => void;
  catalog: SavedFirmante[];
  onVistaPrevia: () => void;
  previsualizando: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  function update(tempId: string, patch: Partial<FirmanteDraft>) {
    onChange(firmantes.map((f) => (f.tempId === tempId ? { ...f, ...patch } : f)));
  }
  function remove(tempId: string) {
    if (firmantes.length === 1) return;
    onChange(firmantes.filter((f) => f.tempId !== tempId));
  }
  function addCustom() {
    setMenuOpen(false);
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
  function addFromCatalog(s: SavedFirmante) {
    setMenuOpen(false);
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

  return (
    <View>
      <TituloConVistaPrevia
        texto="Firmantes"
        onVistaPrevia={onVistaPrevia}
        previsualizando={previsualizando}
        // Hasta tres: con tres el + se va, que es lo que dice que no entra otro.
        onAgregar={firmantes.length < 3 ? () => setMenuOpen(true) : undefined}
      />
      <Text style={styles.subtitle}>
        Entre 1 y 3 personas que firman este informe.
      </Text>

      <View style={{ gap: 12 }}>
        {firmantes.map((f) => (
          <View key={f.tempId} style={styles.firmanteCard}>
            <TextInput
              mode="outlined"
              value={f.nombre}
              onChangeText={(v) => update(f.tempId, { nombre: v })}
              label="Nombre completo"
              dense
            />
            <TextInput
              mode="outlined"
              value={f.cedula}
              onChangeText={(v) => update(f.tempId, { cedula: v })}
              label="Cédula (opcional)"
              dense
              keyboardType="numeric"
            />
            {firmantes.length > 1 ? (
              <Pressable
                onPress={() => remove(f.tempId)}
                style={{ alignSelf: "flex-end", padding: 6 }}
              >
                <Text style={{ color: "#c62828", fontWeight: "500" }}>
                  Quitar
                </Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>

      {/* Un cajón y no un menú colgado del botón: los firmantes guardados
          son una lista, y el vacío va primero, que es el que no depende de
          nada. El mismo cajón que abre el portal en el teléfono. */}
      <HojaInferior visible={menuOpen} onCerrar={() => setMenuOpen(false)} maxAlto={0.85}>
        <Text style={styles.hojaTitulo}>Agregar firmante</Text>
        <ScrollView style={styles.hojaLista} contentContainerStyle={{ paddingBottom: 12 }}>
          <Pressable
            onPress={addCustom}
            style={({ pressed }) => [styles.hojaFila, pressed && styles.cardPressed]}
            accessibilityRole="button"
          >
            <Ionicons name="person-add-outline" size={20} color={ACCENT} />
            <View style={{ flex: 1 }}>
              <Text style={styles.hojaFilaTexto}>Firmante nuevo</Text>
              <Text style={styles.hojaFilaDetalle}>Se escribe desde cero</Text>
            </View>
          </Pressable>
          {catalog.length > 0 ? <Text style={styles.hojaRotulo}>GUARDADOS</Text> : null}
          {catalog.map((c) => {
            const yaEsta = firmantes.some((f) => f.nombre === c.nombre);
            return (
              <Pressable
                key={c.id}
                onPress={() => addFromCatalog(c)}
                disabled={yaEsta}
                style={({ pressed }) => [
                  styles.hojaFila,
                  yaEsta && { opacity: 0.5 },
                  pressed && styles.cardPressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ disabled: yaEsta }}
              >
                <Ionicons name="person-outline" size={20} color="#666" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.hojaFilaTexto}>{c.nombre}</Text>
                  <Text style={styles.hojaFilaDetalle}>
                    {yaEsta ? "Ya está en el informe" : (c.cedula ?? "Sin cédula")}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </HojaInferior>
    </View>
  );
}

// ───────── Photo Picker Modal ─────────

// ───────── Date Range Modal ─────────

function DateRangeModal({
  visible,
  from,
  to,
  onChange,
  onClose,
}: {
  visible: boolean;
  from: string | null;
  to: string | null;
  onChange: (from: string | null, to: string | null) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  function handleDayPress(d: DateData) {
    const day = d.dateString;
    if (!from && !to) {
      onChange(day, day);
      return;
    }
    if (from && to && from !== to) {
      onChange(day, day);
      return;
    }
    if (from && to && from === to) {
      if (day === from) {
        onChange(null, null);
        return;
      }
      if (day > from) onChange(from, day);
      else onChange(day, from);
    }
  }

  const label = (() => {
    if (!from && !to) return "Sin fecha";
    if (from && to && from === to) return formatLongDate(from);
    if (from && to) return `${formatChip(from)} → ${formatChip(to)}`;
    return "—";
  })();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <View style={[styles.modalContainer, { paddingTop: ARRIBA_DE_LA_HOJA(insets.top) }]}>
        <View style={styles.modalHeader}>
          <Pressable onPress={onClose}>
            <Text style={{ color: ACCENT, fontWeight: "500" }}>Cerrar</Text>
          </Pressable>
          <Text style={{ fontWeight: "600", fontSize: 16 }}>
            Rango de fechas
          </Text>
          <Pressable
            onPress={() => onChange(null, null)}
            disabled={!from && !to}
          >
            <Text
              style={{
                color: from || to ? "#c62828" : "#bbb",
                fontWeight: "500",
              }}
            >
              Limpiar
            </Text>
          </Pressable>
        </View>
        <View style={styles.modalDateLabel}>
          <Text style={{ color: "#222", fontWeight: "500" }}>{label}</Text>
        </View>
        <Calendar
          markingType="period"
          markedDates={buildMarkedDates(from, to)}
          onDayPress={handleDayPress}
          firstDay={1}
          theme={{
            todayTextColor: ACCENT,
            arrowColor: ACCENT,
          }}
        />
        <Text style={styles.modalHint}>
          Toca un día para seleccionarlo. Toca otro para crear un rango.
        </Text>
        <View style={[styles.modalFooter, { paddingBottom: insets.bottom + 12 }]}>
          <Button
            mode="contained"
            onPress={onClose}
            buttonColor={ACCENT}
            contentStyle={{ paddingVertical: 4 }}
            style={{ borderRadius: 12 }}
          >
            Listo
          </Button>
        </View>
      </View>
    </Modal>
  );
}

// ───────── helpers ─────────

function buildMarkedDates(
  from: string | null,
  to: string | null
): Record<
  string,
  { startingDay?: boolean; endingDay?: boolean; color: string; textColor: string }
> {
  if (!from && !to) return {};
  const out: Record<
    string,
    {
      startingDay?: boolean;
      endingDay?: boolean;
      color: string;
      textColor: string;
    }
  > = {};
  if (from && to && from === to) {
    out[from] = {
      startingDay: true,
      endingDay: true,
      color: ACCENT,
      textColor: "#fff",
    };
    return out;
  }
  if (from && to && from !== to) {
    const start = from < to ? from : to;
    const end = from < to ? to : from;
    let cursor = start;
    while (cursor <= end) {
      out[cursor] = {
        color: ACCENT,
        textColor: "#fff",
        ...(cursor === start ? { startingDay: true } : {}),
        ...(cursor === end ? { endingDay: true } : {}),
      };
      cursor = nextDay(cursor);
      if (Object.keys(out).length > 400) break;
    }
    return out;
  }
  const single = (from ?? to)!;
  out[single] = {
    startingDay: true,
    endingDay: true,
    color: ACCENT,
    textColor: "#fff",
  };
  return out;
}

function nextDay(yyyymmdd: string): string {
  const d = new Date(yyyymmdd + "T00:00:00");
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatLongDate(yyyymmdd: string): string {
  return fechaSola(yyyymmdd, { day: "numeric", month: "short", year: "numeric" });
}

function formatChip(yyyymmdd: string): string {
  return fechaSola(yyyymmdd, { day: "2-digit", month: "short" });
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type RangePresetKey = "este-mes" | "mes-pasado" | "ultimos-30" | "personalizado";

function presetRange(key: Exclude<RangePresetKey, "personalizado">): {
  from: string;
  to: string;
} {
  const now = new Date();
  if (key === "este-mes") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: toIsoDate(from), to: toIsoDate(to) };
  }
  if (key === "mes-pasado") {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: toIsoDate(from), to: toIsoDate(to) };
  }
  // ultimos-30
  const to = now;
  const from = new Date(now);
  from.setDate(from.getDate() - 30);
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

function detectActivePreset(
  from: string | null,
  to: string | null
): RangePresetKey | null {
  if (!from && !to) return null;
  for (const key of ["este-mes", "mes-pasado", "ultimos-30"] as const) {
    const r = presetRange(key);
    if (r.from === from && r.to === to) return key;
  }
  return "personalizado";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ───────── styles ─────────

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, paddingBottom: 32 },
  title: { marginBottom: 4, fontWeight: "600" },
  tituloConOjo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8,
  },
  // El título del paso, del tamaño de los de la app en el teléfono, y sus
  // dos botones chicos: son atajos, no la acción del paso.
  tituloTexto: { flex: 1, fontSize: 18, fontWeight: "700", color: "#1e231f" },
  ojo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e8f5e9",
  },
  subtitle: { color: "#666", marginBottom: 16 },
  label: { color: "#444", fontSize: 13, marginBottom: 6, fontWeight: "500" },
  search: {
    backgroundColor: "#f4f4f4",
    borderRadius: 12,
    marginBottom: 12,
  },
  searchInput: { fontSize: 15 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fafafa",
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  cardSelected: { backgroundColor: "#e8f5e9" },
  cardPressed: { backgroundColor: "#eaeaea" },
  cardTitle: { color: "#111", fontWeight: "500" },
  cardSubtitle: { color: "#888", fontSize: 12, marginTop: 2 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#e8f5e9",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: ACCENT, fontWeight: "600" },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#bbb",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: { backgroundColor: ACCENT, borderColor: ACCENT },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#fafafa",
    marginBottom: 8,
  },
  fieldRowLabel: { flex: 1, color: "#222", fontWeight: "500" },
  fieldRowValue: { color: "#666", fontSize: 13 },
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: "#f0f0f0",
    borderWidth: 1,
    borderColor: "transparent",
  },
  quickChipPressed: { backgroundColor: "#e5e5e5" },
  quickChipActive: {
    backgroundColor: "#e8f5e9",
    borderColor: ACCENT,
  },
  quickChipText: { color: "#444", fontSize: 13, fontWeight: "500" },
  quickChipTextActive: { color: ACCENT },
  dateCaption: {
    color: "#666",
    fontSize: 12,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  selectAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#e8f5e9",
    borderWidth: 1,
    borderColor: ACCENT,
  },
  selectAllBtnPressed: { backgroundColor: "#d4ead6" },
  selectAllText: { color: ACCENT, fontSize: 12, fontWeight: "600" },
  calendarBox: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e0e0e0",
    marginBottom: 12,
    paddingVertical: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    marginTop: 8,
  },
  sectionHeaderText: { color: "#666", fontSize: 13 },
  empty: {
    color: "#888",
    textAlign: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  estadoChip: {
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: "hidden",
    textTransform: "uppercase",
  },
  estadoChipOk: { backgroundColor: "#e8f5e9", color: tema.verde },
  estadoChipPending: { backgroundColor: "#fff3e0", color: "#e65100" },
  fotosCount: { color: "#888", fontSize: 11, marginTop: 4 },
  // Secciones
  seccionCard: {
    backgroundColor: "#fafafa",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  seccionCardActive: {
    backgroundColor: "#e8f5e9",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  dragHandle: {
    paddingVertical: 4,
    paddingRight: 4,
  },
  seccionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  seccionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  seccionNumberText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  seccionTitleInput: {
    flex: 1,
    backgroundColor: "transparent",
    fontSize: 15,
  },
  seccionDescInput: { backgroundColor: "#fff" },
  seccionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  seccionDisplayTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111",
  },
  seccionMeta: {
    color: "#888",
    fontSize: 12,
    marginTop: 2,
  },
  muted: { color: "#999", fontStyle: "italic", fontWeight: "400" },
  seccionEditable: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    padding: 10,
    gap: 6,
  },
  seccionDescDisplay: {
    color: "#222",
    fontSize: 14,
    lineHeight: 20,
  },
  editHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  editHintText: { color: "#888", fontSize: 11 },
  fieldWrap: {
    borderWidth: 1,
    borderColor: "#d0d0d0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  fieldWrapFocused: { borderColor: ACCENT, borderWidth: 1.5 },
  fieldWrapMultiline: { paddingBottom: 8 },
  fieldLabel: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  fieldLabelFocused: { color: ACCENT },
  fieldInput: {
    fontSize: 16,
    color: "#222",
    paddingVertical: 4,
    height: 32,
    margin: 0,
  },
  fieldInputMultiline: {
    height: undefined,
    minHeight: 120,
    maxHeight: 280,
    paddingTop: 4,
  },
  fotoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  fotoCell: {
    position: "relative",
    width: "32%",
    aspectRatio: 1,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "#eee",
  },
  foto: { width: "100%", height: "100%" },
  fotoX: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  seccionEmpty: {
    color: "#888",
    fontSize: 12,
    fontStyle: "italic",
    paddingVertical: 6,
  },
  seccionFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  // Firmantes
  firmanteCard: {
    backgroundColor: "#fafafa",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  // Modal
  modalContainer: { flex: 1, backgroundColor: "#fff" },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
  },
  modalDateLabel: {
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
  },
  modalHint: {
    color: "#888",
    fontSize: 12,
    textAlign: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  modalFooter: {
    paddingHorizontal: 16,
    paddingTop: 8,
    marginTop: "auto",
  },
  agregarFotos: { borderRadius: 8 },
  // El encabezado como fila de la lista: rótulo chico arriba, la primera
  // línea debajo, el chevron al costado.
  encabezadoFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fafafa",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  encabezadoRotulo: { color: "#888", fontSize: 12, marginBottom: 2 },
  // La fila de una sección, como en el portal.
  seccionFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fafafa",
    borderRadius: 12,
    paddingVertical: 10,
    paddingLeft: 8,
    paddingRight: 12,
  },
  seccionNumeroTexto: { color: "#fff", fontSize: 12, fontWeight: "700" },
  tacho: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 16 },
  // Las filas de un cajón, como las del selector de sección.
  hojaTitulo: { fontSize: 17, fontWeight: "700", color: "#1e231f", paddingHorizontal: 4, paddingTop: 6, paddingBottom: 4 },
  hojaLista: { flexGrow: 0 },
  hojaRotulo: { color: "#7c827d", fontSize: 11, letterSpacing: 0.8, paddingHorizontal: 4, paddingTop: 14, paddingBottom: 4 },
  hojaFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 4,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#ecf0ec",
  },
  hojaFilaTexto: { fontSize: 16, color: "#1e231f", fontWeight: "500" },
  hojaFilaDetalle: { fontSize: 13, color: "#7c827d", marginTop: 2 },
  sinSecciones: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#ddd",
    padding: 24,
  },
  sinSeccionesTexto: { color: "#888", textAlign: "center", fontSize: 14 },
  encabezadoTexto: { fontSize: 15, fontWeight: "600", color: "#222" },
  error: { textAlign: "center", marginTop: 12 },
});
