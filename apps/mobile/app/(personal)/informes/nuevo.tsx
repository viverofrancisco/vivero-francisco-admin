import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput as RNTextInput,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Button,
  Divider,
  HelperText,
  IconButton,
  Menu,
  ProgressBar,
  Searchbar,
  Text,
  TextInput,
} from "react-native-paper";
import { Calendar, type DateData } from "react-native-calendars";
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from "react-native-draggable-flatlist";
import { useNavigation, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { nombreCliente } from "@vivero/shared";
import { apiRequest, ApiError } from "@/lib/api";
import type {
  ClienteListItem,
  ClientesListResponse,
} from "@/lib/types";

// ───────── types ─────────

interface VisitaPI {
  id: string;
  fechaProgramada: string;
  estado: "COMPLETADA" | "INCOMPLETA";
  servicioNombre: string;
  fotosCount: number;
}

interface MediaPoolItem {
  id: string;
  url: string;
  visitaId: string;
  visitaFecha: string;
  /// Producto de la visita con el que se etiquetó la foto, si lo tiene.
  productoId: string | null;
}

/** Servicio cubierto por las visitas seleccionadas. Origen de cada sección. */
interface ServicioParaSeccion {
  productoId: string;
  nombre: string;
  descripcion: string | null;
  visitasCount: number;
  fotosCount: number;
}

interface SavedFirmante {
  id: string;
  nombre: string;
  cedula: string | null;
  isDefault: boolean;
}

/**
 * Foto de una sección: o viene de una visita (`visitaMediaId`) o se subió
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
  /// Producto que origina la sección. Null = sección personalizada.
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

type Step = 0 | 1 | 2 | 3;
const STEP_LABELS = ["Cliente", "Visitas", "Secciones", "Firmantes"];
const ACCENT = "#2e7d32";

// ───────── main ─────────

export default function NuevoInformeScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const [step, setStep] = useState<Step>(0);

  // Reference data
  const [clientes, setClientes] = useState<ClienteListItem[]>([]);
  const [serviciosDisponibles, setServiciosDisponibles] = useState<
    ServicioParaSeccion[]
  >([]);
  const [firmantesCatalog, setFirmantesCatalog] = useState<SavedFirmante[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(true);

  // Form state
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);
  const [visitas, setVisitas] = useState<VisitaPI[]>([]);
  const [loadingVisitas, setLoadingVisitas] = useState(false);
  const [selectedVisitaIds, setSelectedVisitaIds] = useState<Set<string>>(
    new Set()
  );
  const [pool, setPool] = useState<MediaPoolItem[]>([]);
  const [loadingPool, setLoadingPool] = useState(false);
  const [secciones, setSecciones] = useState<SeccionDraft[]>([]);
  const [firmantes, setFirmantes] = useState<FirmanteDraft[]>([
    { tempId: "1", nombre: "", cedula: "" },
  ]);

  const [submitting, setSubmitting] = useState(false);
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

  // Auto-suggest title when entering step 1.
  useEffect(() => {
    if (step === 1 && !titulo && clienteId) {
      const c = clientes.find((x) => x.id === clienteId);
      if (c) {
        const now = new Date();
        const monthYear = now.toLocaleDateString("es-EC", {
          month: "long",
          year: "numeric",
        });
        setTitulo(
          `Informe ${capitalize(monthYear)} — ${nombreCliente(c)}`.trim()
        );
      }
    }
  }, [step, titulo, clienteId, clientes]);

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
    setLoadingPool(true);
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
        if (!cancelled) setLoadingPool(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step, selectedVisitaIds]);

  // Los productos que cubren las visitas seleccionadas son el catálogo de
  // secciones: título = nombre del servicio, descripción = la del servicio.
  useEffect(() => {
    if (step < 2 || selectedVisitaIds.size === 0) return;
    let cancelled = false;
    apiRequest<{ items: ServicioParaSeccion[] }>(
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

  const canContinue = (): boolean => {
    switch (step) {
      case 0:
        return !!clienteId;
      case 1:
        return selectedVisitaIds.size > 0 && titulo.trim().length > 0;
      case 2:
        return (
          secciones.length > 0 &&
          secciones.every((s) => s.titulo.trim().length > 0)
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
    if (step === 0) router.back();
    else setStep(((step - 1) as Step));
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const validFirmantes = firmantes
        .filter((f) => f.nombre.trim().length > 0)
        .map((f) => ({
          nombre: f.nombre.trim(),
          cedula: f.cedula.trim() || null,
        }));
      const validSecciones = secciones.map((s) => ({
        productoId: s.productoId,
        titulo: s.titulo.trim(),
        descripcion: s.descripcion.trim() || null,
        fotos: s.fotos.map((f) =>
          f.visitaMediaId ? { visitaMediaId: f.visitaMediaId } : { key: f.key }
        ),
      }));
      const result = await apiRequest<{ id: string; pdfUrl: string }>(
        "/api/mobile/informes",
        {
          method: "POST",
          body: {
            clienteId,
            titulo: titulo.trim(),
            visitaIds: Array.from(selectedVisitaIds),
            firmantes: validFirmantes,
            secciones: validSecciones,
          },
        }
      );
      router.replace(`/(personal)/informes/${result.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No pudimos generar");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingRefs) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.flex}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
          <View style={styles.headerTopRow}>
            <IconButton
              icon={step === 0 ? "close" : "chevron-left"}
              size={24}
              onPress={prev}
              style={styles.headerBtn}
            />
            <Text variant="bodySmall" style={styles.stepCounter}>
              Paso {step + 1} de {STEP_LABELS.length}
            </Text>
            <View style={styles.headerBtn} />
          </View>
          <ProgressBar
            progress={(step + 1) / STEP_LABELS.length}
            color={ACCENT}
            style={styles.progressBar}
          />
        </View>

        {step === 2 ? (
          <View style={styles.flex}>
            <SeccionesStep
              loadingPool={loadingPool}
              secciones={secciones}
              onChangeSecciones={setSecciones}
              productos={serviciosDisponibles}
              allPool={pool}
              clienteId={clienteId}
              poolCount={pool.length}
              unassignedCount={unassignedPool.length}
              onOpenPicker={(tempId) => setPhotoPickerForSection(tempId)}
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
                titulo={titulo}
                onChangeTitulo={setTitulo}
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
              />
            )}

            {error ? (
              <HelperText type="error" visible style={styles.error}>
                {error}
              </HelperText>
            ) : null}
          </ScrollView>
        )}

        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, 16) + 8 },
          ]}
        >
          {step < 3 ? (
            <Button
              mode="contained"
              onPress={next}
              disabled={!canContinue()}
              style={styles.primaryBtn}
              contentStyle={styles.primaryBtnContent}
              buttonColor={ACCENT}
            >
              Continuar
            </Button>
          ) : (
            <Button
              mode="contained"
              onPress={submit}
              loading={submitting}
              disabled={submitting}
              style={styles.primaryBtn}
              contentStyle={styles.primaryBtnContent}
              buttonColor={ACCENT}
            >
              Generar informe
            </Button>
          )}
        </View>
      </View>

      {/* Photo picker modal */}
      {photoPickerForSection !== null ? (
        <PhotoPickerModal
          pool={unassignedPool}
          onClose={() => setPhotoPickerForSection(null)}
          onConfirm={(ids) => {
            const byId = new Map(pool.map((m) => [m.id, m]));
            const nuevas = ids
              .map((id) => byId.get(id))
              .filter((m): m is MediaPoolItem => Boolean(m))
              .map(fotoDeVisita);
            setSecciones((prev) =>
              prev.map((s) =>
                s.tempId === photoPickerForSection
                  ? {
                      ...s,
                      fotos: [
                        ...s.fotos,
                        ...nuevas.filter(
                          (n) => !s.fotos.some((f) => f.uid === n.uid)
                        ),
                      ],
                    }
                  : s
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
  titulo,
  onChangeTitulo,
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
  titulo: string;
  onChangeTitulo: (v: string) => void;
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

      <View style={{ marginBottom: 16 }}>
        <NativeField
          label="Título del informe"
          value={titulo}
          onChangeText={onChangeTitulo}
        />
      </View>

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
  loadingPool,
  secciones,
  onChangeSecciones,
  productos,
  allPool,
  clienteId,
  poolCount,
  unassignedCount,
  onOpenPicker,
  error,
}: {
  loadingPool: boolean;
  secciones: SeccionDraft[];
  onChangeSecciones: (s: SeccionDraft[]) => void;
  productos: ServicioParaSeccion[];
  allPool: MediaPoolItem[];
  clienteId: string | null;
  poolCount: number;
  unassignedCount: number;
  onOpenPicker: (tempId: string) => void;
  error: string | null;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);

  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

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
   * servicio y arranca con las fotos etiquetadas con él que estén libres.
   */
  function addSeccion(servicio: ServicioParaSeccion | null) {
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
              m.productoId === servicio.productoId &&
              !yaAsignadas.has(m.id)
          )
          .map(fotoDeVisita)
      : [];
    onChangeSecciones([
      ...secciones,
      {
        tempId: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productoId: servicio?.productoId ?? null,
        titulo: servicio?.nombre ?? "",
        descripcion: servicio?.descripcion ?? "",
        fotos: fotosDelServicio,
      },
    ]);
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
   * Sube imágenes de la galería a R2 con URLs prefirmadas y las agrega a la
   * sección. Son fotos propias del informe: no vienen de ninguna visita.
   */
  async function subirImagenes(tempId: string) {
    if (!clienteId) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: 20,
    });
    if (result.canceled || result.assets.length === 0) return;

    setUploadingFor(tempId);
    try {
      const assets = result.assets.map((a) => {
        const fileName =
          a.fileName ?? a.uri.split("/").pop() ?? `imagen-${Date.now()}.jpg`;
        const ext = fileName.split(".").pop()?.toLowerCase() ?? "jpg";
        const contentType =
          ext === "png"
            ? "image/png"
            : ext === "webp"
              ? "image/webp"
              : "image/jpeg";
        return { uri: a.uri, fileName, contentType };
      });

      const { uploads } = await apiRequest<{
        uploads: { key: string; uploadUrl: string; url: string }[];
      }>("/api/mobile/informes/uploads", {
        method: "POST",
        body: {
          clienteId,
          files: assets.map((a) => ({
            fileName: a.fileName,
            contentType: a.contentType,
          })),
        },
      });

      await Promise.all(
        uploads.map(async (u, i) => {
          const asset = assets[i];
          const blob = await (await fetch(asset.uri)).blob();
          const put = await fetch(u.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": asset.contentType },
            body: blob,
          });
          if (!put.ok) throw new Error("No pudimos subir una de las imágenes.");
        })
      );

      const nuevas = uploads.map((u) => fotoSubida(u.key, u.url));
      const s = secciones.find((x) => x.tempId === tempId);
      if (s) update(tempId, { fotos: [...s.fotos, ...nuevas] });
    } catch {
      // El error se muestra al generar; acá solo evitamos romper la pantalla.
    } finally {
      setUploadingFor(null);
    }
  }

  function removeFoto(tempId: string, uid: string) {
    const s = secciones.find((x) => x.tempId === tempId);
    if (!s) return;
    update(tempId, { fotos: s.fotos.filter((f) => f.uid !== uid) });
  }

  const editing = secciones.find((s) => s.tempId === editingId) ?? null;

  return (
    <View style={{ flex: 1 }}>
      <DraggableFlatList
        data={secciones}
        keyExtractor={(s) => s.tempId}
        onDragEnd={({ data }) => onChangeSecciones(data)}
        activationDistance={12}
        containerStyle={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListHeaderComponent={
          <View style={{ marginBottom: 12 }}>
            <Text variant="headlineSmall" style={styles.title}>
              Componer secciones
            </Text>
            <Text style={styles.subtitle}>
              {loadingPool
                ? "Cargando fotos…"
                : `${poolCount} foto${poolCount === 1 ? "" : "s"} disponibles · ${unassignedCount} sin asignar`}
            </Text>
          </View>
        }
        renderItem={({ item: s, drag, isActive }: RenderItemParams<SeccionDraft>) => {
          const isCollapsed = collapsed.has(s.tempId);
          return (
            <ScaleDecorator>
              <View
                style={[
                  styles.seccionCard,
                  isActive && styles.seccionCardActive,
                ]}
              >
                {/* Header */}
                <Pressable
                  onPress={() => toggleCollapsed(s.tempId)}
                  onLongPress={drag}
                  delayLongPress={200}
                  style={({ pressed }) => [
                    styles.seccionHeaderRow,
                    pressed && styles.cardPressed,
                  ]}
                >
                  <View style={styles.dragHandle}>
                    <Ionicons name="reorder-three" size={18} color="#999" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.seccionDisplayTitle,
                        !s.titulo && styles.muted,
                      ]}
                      numberOfLines={isCollapsed ? 1 : undefined}
                    >
                      {s.titulo || "Sin título"}
                    </Text>
                    {isCollapsed ? (
                      <Text style={styles.seccionMeta}>
                        {s.fotos.length} foto
                        {s.fotos.length === 1 ? "" : "s"}
                        {s.descripcion ? " · con descripción" : ""}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons
                    name={isCollapsed ? "chevron-down" : "chevron-up"}
                    size={20}
                    color="#888"
                  />
                </Pressable>

                {!isCollapsed ? (
                  <>
                    {/* Description display (tap to edit) */}
                    <Pressable
                      onPress={() => setEditingId(s.tempId)}
                      style={({ pressed }) => [
                        styles.seccionEditable,
                        pressed && styles.cardPressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.seccionDescDisplay,
                          !s.descripcion && styles.muted,
                        ]}
                      >
                        {s.descripcion || "Toca para agregar descripción…"}
                      </Text>
                      <View style={styles.editHint}>
                        <Ionicons
                          name="pencil-outline"
                          size={12}
                          color="#888"
                        />
                        <Text style={styles.editHintText}>
                          Editar título y descripción
                        </Text>
                      </View>
                    </Pressable>

                    {/* Photos */}
                    {s.fotos.length > 0 ? (
                      <View style={styles.fotoGrid}>
                        {s.fotos.map((f) => (
                          <View key={f.uid} style={styles.fotoCell}>
                            <Image
                              source={{ uri: f.url }}
                              style={styles.foto}
                            />
                            {!f.visitaMediaId ? (
                              <View style={styles.fotoBadge}>
                                <Text style={styles.fotoBadgeText}>Subida</Text>
                              </View>
                            ) : null}
                            <Pressable
                              onPress={() => removeFoto(s.tempId, f.uid)}
                              style={styles.fotoX}
                              hitSlop={6}
                            >
                              <Ionicons name="close" size={14} color="#fff" />
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.seccionEmpty}>
                        Sin fotos asignadas.
                      </Text>
                    )}

                    {/* Actions */}
                    <View style={styles.seccionFooter}>
                      <Pressable
                        onPress={() => onOpenPicker(s.tempId)}
                        style={styles.iconBtn}
                      >
                        <Ionicons
                          name="image-outline"
                          size={18}
                          color={ACCENT}
                        />
                        <Text style={styles.iconBtnText}>De las visitas</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => subirImagenes(s.tempId)}
                        style={styles.iconBtn}
                        disabled={uploadingFor === s.tempId}
                      >
                        <Ionicons
                          name="cloud-upload-outline"
                          size={18}
                          color={ACCENT}
                        />
                        <Text style={styles.iconBtnText}>
                          {uploadingFor === s.tempId ? "Subiendo…" : "Subir"}
                        </Text>
                      </Pressable>
                      <IconButton
                        icon="trash-can-outline"
                        size={18}
                        onPress={() => remove(s.tempId)}
                        iconColor="#c62828"
                      />
                    </View>
                  </>
                ) : null}
              </View>
            </ScaleDecorator>
          );
        }}
        ListFooterComponent={
          <View style={{ marginTop: 16, gap: 8 }}>
            <Menu
              visible={menuOpen}
              onDismiss={() => setMenuOpen(false)}
              anchor={
                <Button
                  mode="outlined"
                  onPress={() => setMenuOpen(true)}
                  icon="plus"
                  textColor={ACCENT}
                >
                  Agregar sección
                </Button>
              }
            >
              <Menu.Item
                onPress={() => addSeccion(null)}
                title="Personalizada (vacía)"
                leadingIcon="text-box-outline"
              />
              {productos.length > 0 ? <Divider /> : null}
              {productos.map((sv) => (
                <Menu.Item
                  key={sv.productoId}
                  onPress={() => addSeccion(sv)}
                  title={sv.nombre}
                />
              ))}
            </Menu>
            {error ? (
              <HelperText type="error" visible style={styles.error}>
                {error}
              </HelperText>
            ) : null}
          </View>
        }
      />

      {editing ? (
        <SeccionEditModal
          key={editing.tempId}
          initialTitulo={editing.titulo}
          initialDescripcion={editing.descripcion}
          onClose={() => setEditingId(null)}
          onSave={(titulo, descripcion) => {
            update(editing.tempId, { titulo, descripcion });
            setEditingId(null);
          }}
        />
      ) : null}
    </View>
  );
}

// ───────── Native Field (static label) ─────────

function NativeField({
  label,
  value,
  onChangeText,
  multiline,
  autoFocus,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  multiline?: boolean;
  autoFocus?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[
        styles.fieldWrap,
        focused && styles.fieldWrapFocused,
        multiline && styles.fieldWrapMultiline,
      ]}
    >
      <Text style={[styles.fieldLabel, focused && styles.fieldLabelFocused]}>
        {label}
      </Text>
      <RNTextInput
        value={value}
        onChangeText={onChangeText}
        multiline={!!multiline}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.fieldInput, multiline && styles.fieldInputMultiline]}
        textAlignVertical={multiline ? "top" : "center"}
        scrollEnabled
      />
    </View>
  );
}

// ───────── Section Edit Modal ─────────

function SeccionEditModal({
  initialTitulo,
  initialDescripcion,
  onClose,
  onSave,
}: {
  initialTitulo: string;
  initialDescripcion: string;
  onClose: () => void;
  onSave: (titulo: string, descripcion: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [titulo, setTitulo] = useState(initialTitulo);
  const [descripcion, setDescripcion] = useState(initialDescripcion);
  const canSave = titulo.trim().length > 0;

  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Pressable onPress={onClose}>
              <Text style={{ color: ACCENT, fontWeight: "500" }}>
                Cancelar
              </Text>
            </Pressable>
            <Text style={{ fontWeight: "600", fontSize: 16 }}>
              Editar sección
            </Text>
            <Pressable
              onPress={() => onSave(titulo, descripcion)}
              disabled={!canSave}
            >
              <Text
                style={{
                  color: canSave ? ACCENT : "#bbb",
                  fontWeight: "600",
                }}
              >
                Guardar
              </Text>
            </Pressable>
          </View>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, gap: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            <NativeField
              label="Título"
              value={titulo}
              onChangeText={setTitulo}
              autoFocus
            />
            <NativeField
              label="Descripción (opcional)"
              value={descripcion}
              onChangeText={setDescripcion}
              multiline
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ───────── Step 3: Firmantes ─────────

function FirmantesStep({
  firmantes,
  onChange,
  catalog,
}: {
  firmantes: FirmanteDraft[];
  onChange: (next: FirmanteDraft[]) => void;
  catalog: SavedFirmante[];
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
      <Text variant="headlineSmall" style={styles.title}>
        Firmantes
      </Text>
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

      {firmantes.length < 3 ? (
        <Menu
          visible={menuOpen}
          onDismiss={() => setMenuOpen(false)}
          anchor={
            <Button
              mode="outlined"
              onPress={() => setMenuOpen(true)}
              icon="plus"
              style={{ marginTop: 16 }}
              textColor={ACCENT}
            >
              Agregar firmante
            </Button>
          }
        >
          <Menu.Item
            onPress={addCustom}
            title="Custom (vacío)"
            leadingIcon="account-plus-outline"
          />
          {catalog.length > 0 ? <Divider /> : null}
          {catalog.map((s) => {
            const already = firmantes.some((f) => f.nombre === s.nombre);
            return (
              <Menu.Item
                key={s.id}
                onPress={() => addFromCatalog(s)}
                title={s.nombre}
                disabled={already}
              />
            );
          })}
        </Menu>
      ) : null}
    </View>
  );
}

// ───────── Photo Picker Modal ─────────

function PhotoPickerModal({
  pool,
  onClose,
  onConfirm,
}: {
  pool: MediaPoolItem[];
  onClose: () => void;
  onConfirm: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
        <View style={styles.modalHeader}>
          <Pressable onPress={onClose}>
            <Text style={{ color: ACCENT, fontWeight: "500" }}>Cancelar</Text>
          </Pressable>
          <Text style={{ fontWeight: "600", fontSize: 16 }}>
            {selected.size > 0
              ? `${selected.size} seleccionada${selected.size === 1 ? "" : "s"}`
              : "Selecciona fotos"}
          </Text>
          <Pressable
            onPress={() => onConfirm(Array.from(selected))}
            disabled={selected.size === 0}
          >
            <Text
              style={{
                color: selected.size > 0 ? ACCENT : "#bbb",
                fontWeight: "600",
              }}
            >
              Agregar
            </Text>
          </Pressable>
        </View>
        {pool.length === 0 ? (
          <Text style={[styles.empty, { padding: 32 }]}>
            No hay fotos sin asignar.
          </Text>
        ) : (
          <FlatList
            data={pool}
            keyExtractor={(i) => i.id}
            numColumns={3}
            contentContainerStyle={{ padding: 4 }}
            renderItem={({ item }) => {
              const isSel = selected.has(item.id);
              return (
                <Pressable
                  onPress={() =>
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (next.has(item.id)) next.delete(item.id);
                      else next.add(item.id);
                      return next;
                    })
                  }
                  style={styles.pickerCell}
                >
                  <Image source={{ uri: item.url }} style={styles.pickerImg} />
                  {isSel ? (
                    <View style={styles.pickerCheck}>
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    </View>
                  ) : null}
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

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
      <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
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
  const d = new Date(yyyymmdd + "T00:00:00");
  return d.toLocaleDateString("es-EC", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatChip(yyyymmdd: string): string {
  const d = new Date(yyyymmdd + "T00:00:00");
  return d.toLocaleDateString("es-EC", { day: "2-digit", month: "short" });
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
  header: {
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
    paddingBottom: 8,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  headerBtn: { width: 40 },
  stepCounter: { color: "#666" },
  progressBar: { height: 3, marginHorizontal: 16 },
  content: { padding: 16, paddingBottom: 32 },
  footer: {
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e0e0e0",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  primaryBtn: { borderRadius: 12 },
  primaryBtnContent: { paddingVertical: 6 },
  title: { marginBottom: 4, fontWeight: "600" },
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
  estadoChipOk: { backgroundColor: "#e8f5e9", color: "#2e7d32" },
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
  fotoBadge: {
    position: "absolute",
    top: 4,
    left: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  fotoBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "600",
  },
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
  iconBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#e8f5e9",
  },
  iconBtnText: { color: ACCENT, fontWeight: "500", fontSize: 13 },
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
  pickerCell: {
    flex: 1 / 3,
    aspectRatio: 1,
    padding: 2,
  },
  pickerImg: { width: "100%", height: "100%", borderRadius: 6 },
  pickerCheck: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
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
  error: { textAlign: "center", marginTop: 12 },
});
