import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Button,
  HelperText,
  IconButton,
  ProgressBar,
  Searchbar,
  Switch,
  Text,
  TextInput,
} from "react-native-paper";
import { Calendar, type DateData } from "react-native-calendars";
import { useRouter, useNavigation } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { nombreCliente } from "@vivero/shared";
import { apiRequest, ApiError } from "@/lib/api";
import type {
  ServicioListItem,
  ServiciosListResponse,
  ClienteListItem,
  ClienteStaffDetail,
  ClientesListResponse,
  GrupoOption,
  GruposListResponse,
  PersonalListResponse,
  PersonalOption,
} from "@/lib/types";

type Step = 0 | 1 | 2 | 3 | 4;
const STEP_LABELS = ["Cliente", "Servicios", "Fechas", "Personal", "Revisar"];

export default function CrearVisitaScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // Hide the default Stack header — we render our own progress header.
  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const [step, setStep] = useState<Step>(0);

  // Reference data
  const [clientes, setClientes] = useState<ClienteListItem[]>([]);
  const [grupos, setGrupos] = useState<GrupoOption[]>([]);
  const [personal, setPersonal] = useState<PersonalOption[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(true);

  // Form state
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(
    null
  );
  const [clienteDetail, setClienteDetail] = useState<ClienteStaffDetail | null>(
    null
  );
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedProductoIds, setSelectedProductoIds] = useState<string[]>([]);
  // Precio de cada trabajo suelto elegido, por productoId.
  const [preciosSueltos, setPreciosSueltos] = useState<
    Record<string, { precio: string; ivaTasa: string }>
  >({});
  const [catalogo, setCatalogo] = useState<ServicioListItem[]>([]);
  const [fechas, setFechas] = useState<string[]>([]);
  const [grupoId, setGrupoId] = useState<string | null>(null);
  const [selectedPersonalIds, setSelectedPersonalIds] = useState<string[]>([]);
  const [notas, setNotas] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiRequest<ClientesListResponse>("/api/mobile/clientes", {
        query: { limit: 500 },
      }).then((r) => setClientes(r.items)),
      apiRequest<GruposListResponse>("/api/mobile/grupos").then((r) =>
        setGrupos(r.items)
      ),
      apiRequest<PersonalListResponse>("/api/mobile/personal").then((r) =>
        setPersonal(r.items)
      ),
      // Catálogo completo: permite agendar un servicio que el cliente todavía
      // no tiene suscrito, sin pasar antes por otra pantalla.
      apiRequest<ServiciosListResponse>("/api/mobile/servicios", {
        query: { limit: 200 },
      }).then((r) => setCatalogo(r.items)),
    ])
      .catch(() => {})
      .finally(() => setLoadingRefs(false));
  }, []);

  useEffect(() => {
    if (!selectedClienteId) {
      setClienteDetail(null);
      setSelectedProductoIds([]);
      setPreciosSueltos({});
      return;
    }
    setLoadingDetail(true);
    apiRequest<ClienteStaffDetail>(`/api/mobile/clientes/${selectedClienteId}`)
      .then((c) => {
        setClienteDetail(c);
        const cubiertos = c.suscripciones
          .filter((s) => s.estado === "ACTIVO")
          .flatMap((s) => s.items);
        // Con un solo producto suscrito no hay nada que elegir: se preselecciona.
        setSelectedProductoIds(
          cubiertos.length === 1 ? [cubiertos[0].producto.id] : []
        );
        setPreciosSueltos({});
      })
      .catch(() => setClienteDetail(null))
      .finally(() => setLoadingDetail(false));
  }, [selectedClienteId]);

  const selectedCliente = clientes.find((c) => c.id === selectedClienteId);

  // Lo que ya cubre una suscripción activa: se elige sin pedir precio, porque
  // el precio vive en la suscripción.
  const cubiertoPorProductoId = new Map(
    (clienteDetail?.suscripciones ?? [])
      .filter((s) => s.estado === "ACTIVO")
      .flatMap((s) => s.items)
      .map((i) => [i.producto.id, i] as const)
  );

  // Todo el catálogo: desde que la visita no lleva precio, no hay motivo para
  // restringir qué se le puede agendar a quién. Lo que cubre un plan se marca
  // como tal; el resto queda pendiente de facturar.
  const catalogoDisponible = catalogo;
  const selectedServicios = catalogoDisponible.filter((sv) =>
    selectedProductoIds.includes(sv.id)
  );
  const totalServicios = selectedServicios.length;

  // Sin precios: agendar no cotiza. Lo suelto se cobra al armar la orden.
  const resumenProductosElegidos = selectedServicios.map((sv) =>
    cubiertoPorProductoId.has(sv.id)
      ? `${sv.nombre} (cubierto por la suscripción)`
      : `${sv.nombre} (se factura aparte)`
  );

  function toggleServicio(sv: ServicioListItem) {
    setSelectedProductoIds((prev) =>
      prev.includes(sv.id) ? prev.filter((x) => x !== sv.id) : [...prev, sv.id]
    );
  }
  const selectedPersonal = personal.filter((p) =>
    selectedPersonalIds.includes(p.id)
  );

  function canContinue(): boolean {
    if (step === 0) return !!selectedClienteId;
    if (step === 1) {
      return totalServicios > 0;
    }
    if (step === 2) return fechas.length > 0;
    if (step === 3) return true; // personal optional
    return true;
  }

  function next() {
    if (!canContinue()) return;
    setError(null);
    if (step < 4) setStep((step + 1) as Step);
  }

  function prev() {
    setError(null);
    if (step === 0) router.back();
    else setStep((step - 1) as Step);
  }

  async function submit() {
    setError(null);
    if (totalServicios === 0 || fechas.length === 0) return;
    setSubmitting(true);
    try {
      await apiRequest("/api/mobile/visitas", {
        method: "POST",
        body: {
          clienteId: selectedClienteId,
          // El servidor enlaza solo lo que cubre una suscripción activa; el
          // precio que va acá es el del trabajo suelto.
          productos: selectedServicios.map((sv) => {
            const cubierto = cubiertoPorProductoId.has(sv.id);
            const d = preciosSueltos[sv.id];
            return {
              productoId: sv.id,
              precio: cubierto ? null : Number(d?.precio ?? 0),
              ivaTasa:
                cubierto || !d?.ivaTasa.trim() ? null : Number(d.ivaTasa),
            };
          }),
          fechas,
          grupoId: grupoId || null,
          personalIds: selectedPersonalIds,
          notas: notas.trim() || null,
        },
      });
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No pudimos crear");
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
        {/* Header with progress */}
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
            color="#2e7d32"
            style={styles.progressBar}
          />
        </View>

        {/* Content */}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {step === 0 && (
            <ClienteStep
              clientes={clientes}
              selectedId={selectedClienteId}
              onSelect={setSelectedClienteId}
            />
          )}
          {step === 1 && (
            <ServicioStep
              loading={loadingDetail}
              catalogoDisponible={catalogoDisponible}
              selectedIds={selectedProductoIds}
              cubiertoPorProductoId={cubiertoPorProductoId}
              onToggle={toggleServicio}
            />
          )}
          {step === 2 && (
            <FechasStep
              fechas={fechas}
              onToggle={(iso) => {
                setFechas((prev) =>
                  prev.includes(iso)
                    ? prev.filter((d) => d !== iso)
                    : [...prev, iso].sort()
                );
              }}
              onClear={() => setFechas([])}
            />
          )}
          {step === 3 && (
            <PersonalStep
              grupos={grupos}
              personal={personal}
              selectedPersonalIds={selectedPersonalIds}
              onApplyGrupo={(id) => {
                setGrupoId(id);
                const g = grupos.find((x) => x.id === id);
                if (g) setSelectedPersonalIds(g.miembrosIds);
              }}
              onClearGrupo={() => {
                setGrupoId(null);
                setSelectedPersonalIds([]);
              }}
              onTogglePersonal={(id) =>
                setSelectedPersonalIds((prev) =>
                  prev.includes(id)
                    ? prev.filter((x) => x !== id)
                    : [...prev, id]
                )
              }
            />
          )}
          {step === 4 && (
            <RevisarStep
              cliente={selectedCliente}
              servicio={resumenProductosElegidos}
              fechas={fechas}
              personal={selectedPersonal}
              notas={notas}
              onChangeNotas={setNotas}
            />
          )}



          {error ? (
            <HelperText type="error" visible style={styles.error}>
              {error}
            </HelperText>
          ) : null}
        </ScrollView>

        {/* Footer — single full-width primary action */}
        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, 16) + 8 },
          ]}
        >
          {step < 4 ? (
            <Button
              mode="contained"
              onPress={next}
              disabled={!canContinue()}
              style={styles.primaryBtn}
              contentStyle={styles.primaryBtnContent}
              labelStyle={styles.primaryBtnLabel}
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
              labelStyle={styles.primaryBtnLabel}
            >
              {fechas.length > 1
                ? `Crear ${fechas.length} visitas`
                : "Crear visita"}
            </Button>
          )}
        </View>

      </View>
    </KeyboardAvoidingView>
  );
}

// ──────────────────────────────────────────────
// Step 0 — Cliente
// ──────────────────────────────────────────────

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
    if (!q) return clientes.slice(0, 12);
    return clientes
      .filter((c) =>
        `${nombreCliente(c)} ${c.telefono ?? ""}`.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [query, clientes]);

  return (
    <View>
      <Text variant="headlineSmall" style={styles.title}>
        ¿Para qué cliente?
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Busca por nombre o teléfono
      </Text>

      <Searchbar
        placeholder="Buscar"
        value={query}
        onChangeText={setQuery}
        elevation={0}
        style={styles.searchbar}
        inputStyle={styles.searchbarInput}
      />

      <View style={styles.list}>
        {filtered.map((c) => {
          const selected = c.id === selectedId;
          return (
            <Pressable
              key={c.id}
              onPress={() => onSelect(c.id)}
              style={[styles.row, selected && styles.rowSelected]}
            >
              <View style={styles.rowText}>
                <Text variant="bodyLarge" style={styles.rowTitle}>
                  {nombreCliente(c)}
                </Text>
                {c.telefono || c.sector?.nombre ? (
                  <Text variant="bodySmall" style={styles.muted}>
                    {[c.telefono, c.sector?.nombre]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                ) : null}
              </View>
              {selected ? (
                <View style={styles.checkmark}>
                  <Text style={styles.checkmarkIcon}>✓</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
        {filtered.length === 0 && (
          <Text style={styles.empty}>Sin coincidencias.</Text>
        )}
      </View>
    </View>
  );
}

// ──────────────────────────────────────────────
// Step 1 — Servicios
// ──────────────────────────────────────────────

function ServicioStep({
  loading,
  catalogoDisponible,
  selectedIds,
  cubiertoPorProductoId,
  onToggle,
}: {
  loading: boolean;
  catalogoDisponible: ServicioListItem[];
  selectedIds: string[];
  cubiertoPorProductoId: Map<
    string,
    ClienteStaffDetail["suscripciones"][number]["items"][number]
  >;
  onToggle: (sv: ServicioListItem) => void;
}) {
  return (
    <View>
      <Text variant="headlineSmall" style={styles.title}>
        Selecciona los servicios
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Una visita puede cubrir varios servicios
      </Text>

      {loading ? (
        <ActivityIndicator />
      ) : catalogoDisponible.length === 0 ? (
        <Text style={styles.empty}>
          No hay productos en el catálogo.
        </Text>
      ) : (
        <View style={styles.list}>
          {catalogoDisponible.map((sv) => {
            const cubierto = cubiertoPorProductoId.get(sv.id);
            const selected = selectedIds.includes(sv.id);
            return (
              <View key={sv.id}>
                <Pressable
                  onPress={() => onToggle(sv)}
                  style={[styles.row, selected && styles.rowSelected]}
                >
                  <View style={styles.rowText}>
                    <Text variant="bodyLarge" style={styles.rowTitle}>
                      {sv.nombre}
                    </Text>
                    <Text variant="bodySmall" style={styles.muted}>
                      {cubierto
                        ? `Suscripción · $ ${Number(cubierto.precio).toFixed(2)}`
                        : "Trabajo suelto"}
                    </Text>
                  </View>
                  {selected ? (
                    <View style={styles.checkmark}>
                      <Text style={styles.checkmarkIcon}>✓</Text>
                    </View>
                  ) : null}
                </Pressable>

              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ──────────────────────────────────────────────
// Step 2 — Fechas
// ──────────────────────────────────────────────

function FechasStep({
  fechas,
  onToggle,
  onClear,
}: {
  fechas: string[];
  onToggle: (iso: string) => void;
  onClear: () => void;
}) {
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const todayMonthKey = today.slice(0, 7); // "YYYY-MM"
  const [visibleMonthKey, setVisibleMonthKey] = useState(todayMonthKey);

  const markedDates = useMemo(() => {
    const marks: Record<string, { selected: boolean; selectedColor: string }> =
      {};
    for (const d of fechas) {
      marks[d] = { selected: true, selectedColor: "#2e7d32" };
    }
    return marks;
  }, [fechas]);

  const sortedFechas = useMemo(() => [...fechas].sort(), [fechas]);

  // Disable the back arrow when the user is on (or somehow before) today's
  // month so they can't navigate into the past.
  const cantGoBack = visibleMonthKey <= todayMonthKey;

  return (
    <View>
      <Text variant="headlineSmall" style={styles.title}>
        ¿Qué fechas?
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Toca los días que quieres programar
      </Text>

      <Calendar
        current={today}
        minDate={today}
        markedDates={markedDates}
        onDayPress={(d: DateData) => onToggle(d.dateString)}
        onMonthChange={(m) => setVisibleMonthKey(m.dateString.slice(0, 7))}
        firstDay={1}
        enableSwipeMonths={!cantGoBack ? true : true}
        disableArrowLeft={cantGoBack}
        theme={{
          backgroundColor: "#fff",
          calendarBackground: "#fff",
          textSectionTitleColor: "#888",
          selectedDayBackgroundColor: "#2e7d32",
          selectedDayTextColor: "#fff",
          todayTextColor: "#2e7d32",
          dayTextColor: "#111",
          textDisabledColor: "#ccc",
          monthTextColor: "#111",
          arrowColor: "#2e7d32",
          textMonthFontWeight: "600",
          textDayFontSize: 15,
          textMonthFontSize: 16,
          textDayHeaderFontSize: 12,
        }}
        style={styles.calendar}
      />

      {sortedFechas.length > 0 ? (
        <View style={styles.fechasFooter}>
          <Text variant="bodySmall" style={styles.fechasCounter}>
            {sortedFechas.length} fecha
            {sortedFechas.length === 1 ? "" : "s"} seleccionada
            {sortedFechas.length === 1 ? "" : "s"}
          </Text>
          <Button
            mode="text"
            compact
            onPress={onClear}
            textColor="#b00020"
            labelStyle={styles.clearLabel}
          >
            Limpiar
          </Button>
        </View>
      ) : null}
    </View>
  );
}

// ──────────────────────────────────────────────
// Step 3 — Personal
// ──────────────────────────────────────────────

function PersonalStep({
  grupos,
  personal,
  selectedPersonalIds,
  onApplyGrupo,
  onClearGrupo,
  onTogglePersonal,
}: {
  grupos: GrupoOption[];
  personal: PersonalOption[];
  selectedPersonalIds: string[];
  onApplyGrupo: (id: string) => void;
  onClearGrupo: () => void;
  onTogglePersonal: (id: string) => void;
}) {
  const [query, setQuery] = useState("");

  // Build a quick lookup so grupo rows can show member names
  const personalById = useMemo(() => {
    const map: Record<string, PersonalOption> = {};
    for (const p of personal) map[p.id] = p;
    return map;
  }, [personal]);

  function grupoSubtitle(g: GrupoOption): string {
    if (g.miembrosIds.length === 0) return "Sin miembros";
    const names = g.miembrosIds
      .map((id) => personalById[id]?.nombre)
      .filter((n): n is string => !!n);
    const preview = names.slice(0, 3).join(", ");
    const extra = names.length - 3;
    return extra > 0 ? `${preview} y ${extra} más` : preview;
  }

  const filteredPersonal = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return personal;
    return personal.filter((p) =>
      `${p.nombre} ${p.apellido ?? ""} ${p.tipo}`.toLowerCase().includes(q)
    );
  }, [query, personal]);

  const selectedSet = useMemo(
    () => new Set(selectedPersonalIds),
    [selectedPersonalIds]
  );
  const selectedFiltered = filteredPersonal.filter((p) => selectedSet.has(p.id));
  const availableFiltered = filteredPersonal.filter(
    (p) => !selectedSet.has(p.id)
  );

  return (
    <View>
      <Text variant="headlineSmall" style={styles.title}>
        ¿Quién va?
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Selecciona personal o un grupo (opcional)
      </Text>

      {grupos.length > 0 ? (
        <View style={styles.section}>
          <Text variant="labelMedium" style={styles.sectionLabel}>
            Asignación rápida
          </Text>
          <View style={styles.list}>
            <Pressable
              onPress={onClearGrupo}
              style={({ pressed }) => [
                styles.row,
                pressed && styles.rowPressed,
              ]}
            >
              <View style={styles.rowText}>
                <Text variant="bodyLarge" style={styles.rowTitle}>
                  Sin miembros
                </Text>
                <Text variant="bodySmall" style={styles.muted}>
                  Quitar todos los seleccionados
                </Text>
              </View>
            </Pressable>
            {grupos.map((g) => (
              <Pressable
                key={g.id}
                onPress={() => onApplyGrupo(g.id)}
                style={({ pressed }) => [
                  styles.row,
                  pressed && styles.rowPressed,
                ]}
              >
                <View style={styles.rowText}>
                  <Text variant="bodyLarge" style={styles.rowTitle}>
                    {g.nombre}
                  </Text>
                  <Text
                    variant="bodySmall"
                    style={styles.muted}
                    numberOfLines={2}
                  >
                    {grupoSubtitle(g)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text variant="labelMedium" style={styles.sectionLabel}>
          Miembros ({selectedPersonalIds.length})
        </Text>
        {personal.length === 0 ? (
          <Text style={styles.empty}>No hay personal activo.</Text>
        ) : (
          <>
            <Searchbar
              placeholder="Buscar miembro"
              value={query}
              onChangeText={setQuery}
              elevation={0}
              style={styles.searchbar}
              inputStyle={styles.searchbarInput}
            />

            {selectedFiltered.length > 0 ? (
              <>
                <Text variant="labelSmall" style={styles.miniLabel}>
                  Seleccionados
                </Text>
                {selectedFiltered.map((p) => (
                  <PersonalRow
                    key={p.id}
                    personal={p}
                    checked
                    onToggle={() => onTogglePersonal(p.id)}
                  />
                ))}
              </>
            ) : null}

            {availableFiltered.length > 0 ? (
              <>
                {selectedFiltered.length > 0 ? (
                  <Text variant="labelSmall" style={styles.miniLabel}>
                    Disponibles
                  </Text>
                ) : null}
                {availableFiltered.map((p) => (
                  <PersonalRow
                    key={p.id}
                    personal={p}
                    checked={false}
                    onToggle={() => onTogglePersonal(p.id)}
                  />
                ))}
              </>
            ) : null}

            {filteredPersonal.length === 0 ? (
              <Text style={styles.empty}>Sin coincidencias.</Text>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

function PersonalRow({
  personal: p,
  checked,
  onToggle,
}: {
  personal: PersonalOption;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        checked && styles.rowSelected,
        pressed && !checked && styles.rowPressed,
      ]}
      onPress={onToggle}
    >
      <View style={styles.rowText}>
        <Text variant="bodyLarge" style={styles.rowTitle}>
          {`${p.nombre} ${p.apellido ?? ""}`.trim()}
        </Text>
        <Text variant="bodySmall" style={styles.muted}>
          {p.tipo}
        </Text>
      </View>
      <Switch value={checked} onValueChange={onToggle} />
    </Pressable>
  );
}

// ──────────────────────────────────────────────
// Step 4 — Revisar (notas + summary)
// ──────────────────────────────────────────────

function RevisarStep({
  cliente,
  servicio,
  fechas,
  personal,
  notas,
  onChangeNotas,
}: {
  cliente: ClienteListItem | undefined;
  /** Líneas ya formateadas: "Nombre · $ 00.00". */
  servicio: string[];
  fechas: string[];
  personal: PersonalOption[];
  notas: string;
  onChangeNotas: (s: string) => void;
}) {
  return (
    <View>
      <Text variant="headlineSmall" style={styles.title}>
        Revisar y crear
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Confirma los detalles antes de crear
      </Text>

      <View style={styles.summaryBox}>
        <SummaryRow
          label="Cliente"
          value={cliente ? nombreCliente(cliente) : "—"}
        />
        <SummaryRow
          label={servicio.length === 1 ? "Servicio" : "Servicios"}
          value={
            servicio.length > 0 ? servicio.join("\n") : "—"
          }
        />
        <SummaryRow
          label="Fechas"
          value={
            fechas.length === 0
              ? "—"
              : fechas
                  .map((iso) =>
                    new Date(iso + "T00:00:00").toLocaleDateString("es-EC", {
                      day: "numeric",
                      month: "short",
                    })
                  )
                  .join(", ")
          }
        />
        <SummaryRow label="Personal" isLast>
          {personal.length === 0 ? (
            <Text variant="bodyMedium" style={styles.summaryValue}>
              Sin asignar
            </Text>
          ) : (
            <View style={styles.personalList}>
              {personal.map((p) => (
                <View key={p.id} style={styles.personalRow}>
                  <Text variant="bodyMedium" style={styles.personalName}>
                    {`${p.nombre} ${p.apellido ?? ""}`.trim()}
                  </Text>
                  <Text variant="bodySmall" style={styles.personalTipo}>
                    {p.tipo}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </SummaryRow>
      </View>

      <View style={styles.section}>
        <Text variant="labelMedium" style={styles.sectionLabel}>
          NOTAS
        </Text>
        <TextInput
          mode="outlined"
          label="Notas (opcional)"
          value={notas}
          onChangeText={onChangeNotas}
          multiline
          numberOfLines={4}
          outlineColor="#e0e0e0"
          activeOutlineColor="#2e7d32"
          outlineStyle={styles.notasOutline}
          style={styles.notasField}
          contentStyle={styles.notasContent}
        />
      </View>
    </View>
  );
}

function SummaryRow({
  label,
  value,
  children,
  isLast,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.summaryRow, isLast && styles.summaryRowLast]}>
      <Text variant="labelMedium" style={styles.summaryLabel}>
        {label}
      </Text>
      {children ?? (
        <Text variant="bodyMedium" style={styles.summaryValue}>
          {value}
        </Text>
      )}
    </View>
  );
}

// ──────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    paddingBottom: 8,
    backgroundColor: "#fff",
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  headerBtn: { width: 48 },
  stepCounter: { color: "#888", letterSpacing: 0.5 },
  progressBar: {
    height: 3,
    marginTop: 4,
    backgroundColor: "#f0f0f0",
  },

  content: {
    padding: 24,
    paddingBottom: 48,
  },

  title: {
    fontWeight: "700",
    color: "#111",
    marginBottom: 4,
  },
  subtitle: {
    color: "#777",
    marginBottom: 16,
  },

  searchbar: {
    backgroundColor: "#f4f4f4",
    borderRadius: 12,
    marginBottom: 16,
  },
  searchbarInput: { fontSize: 15 },

  list: {
    gap: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#fafafa",
  },
  rowSelected: {
    backgroundColor: "#e8f5e9",
  },
  groupLabel: {
    color: "#888",
    letterSpacing: 0.6,
    marginBottom: 6,
    marginTop: 4,
  },
  groupHint: {
    color: "#888",
    marginBottom: 8,
  },
  precioSuelto: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: "#e8f5e9",
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  nuevoInput: {
    flex: 1,
    backgroundColor: "#fff",
  },
  rowPressed: {
    backgroundColor: "#eaeaea",
  },
  rowText: { flex: 1 },
  rowTitle: { color: "#111" },

  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#2e7d32",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  checkmarkIcon: { color: "#fff", fontWeight: "700", fontSize: 14 },

  empty: {
    color: "#999",
    paddingVertical: 16,
    textAlign: "center",
  },
  muted: { color: "#888", marginTop: 2 },

  calendar: {
    borderRadius: 12,
    overflow: "hidden",
  },
  fechasFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingHorizontal: 4,
  },
  fechasCounter: {
    color: "#888",
  },
  clearLabel: {
    fontSize: 13,
    fontWeight: "500",
  },

  section: { marginTop: 12, gap: 8 },
  sectionLabel: {
    color: "#888",
    marginBottom: 4,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  miniLabel: {
    color: "#999",
    marginTop: 8,
    marginBottom: 2,
    paddingLeft: 4,
  },


  summaryBox: {
    backgroundColor: "#fafafa",
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
  },
  summaryRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eaeaea",
    gap: 4,
  },
  summaryRowLast: { borderBottomWidth: 0 },
  summaryLabel: { color: "#888" },
  summaryValue: { color: "#111" },

  personalList: {
    gap: 6,
    marginTop: 4,
  },
  personalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  personalName: { color: "#111" },
  personalTipo: {
    color: "#888",
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

  notasField: {
    minHeight: 110,
    backgroundColor: "#fff",
  },
  notasOutline: { borderRadius: 12 },
  notasContent: {
    paddingTop: 12,
    paddingBottom: 12,
  },

  error: { textAlign: "center", marginTop: 16 },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#fff",
  },
  primaryBtn: {
    borderRadius: 14,
  },
  primaryBtnContent: {
    paddingVertical: 8,
  },
  primaryBtnLabel: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});
