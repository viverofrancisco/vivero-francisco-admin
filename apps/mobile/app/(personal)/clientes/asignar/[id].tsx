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
  Dialog,
  HelperText,
  Portal,
  Searchbar,
  Text,
  TextInput,
} from "react-native-paper";
import { Calendar, type DateData } from "react-native-calendars";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiRequest, ApiError } from "@/lib/api";
import type {
  ServicioListItem,
  ServiciosListResponse,
} from "@/lib/types";

export default function AsignarServicioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [servicios, setServicios] = useState<ServicioListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [servicioId, setServicioId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [precio, setPrecio] = useState("");
  const [iva, setIva] = useState("0");
  const [frecuenciaMensual, setFrecuenciaMensual] = useState("");
  const [fechaInicio, setFechaInicio] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [notas, setNotas] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<ServiciosListResponse>("/api/mobile/servicios", {
      query: { limit: 200 },
    })
      .then((res) => setServicios(res.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return servicios.slice(0, 10);
    return servicios
      .filter((s) =>
        `${s.nombre} ${s.descripcion ?? ""}`.toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [query, servicios]);

  const selectedServicio = servicios.find((s) => s.id === servicioId);
  const isRecurrente = selectedServicio?.tipo === "RECURRENTE";

  const canSubmit = !!servicioId && !!precio && !submitting;

  async function submit() {
    setError(null);
    if (!servicioId) {
      setError("Selecciona un servicio");
      return;
    }
    const precioNum = Number(precio);
    if (!Number.isFinite(precioNum) || precioNum < 0) {
      setError("Precio inválido");
      return;
    }
    const ivaNum = iva ? Number(iva) : 0;
    if (!Number.isFinite(ivaNum) || ivaNum < 0) {
      setError("IVA inválido");
      return;
    }
    const frecuencia =
      isRecurrente && frecuenciaMensual ? Number(frecuenciaMensual) : null;
    if (
      isRecurrente &&
      frecuencia !== null &&
      (!Number.isInteger(frecuencia) || frecuencia <= 0)
    ) {
      setError("Frecuencia debe ser un entero positivo");
      return;
    }

    setSubmitting(true);
    try {
      await apiRequest(`/api/mobile/clientes/${id}/servicios`, {
        method: "POST",
        body: {
          servicioId,
          precio: precioNum,
          iva: ivaNum,
          frecuenciaMensual: frecuencia,
          fechaInicio,
          notas: notas.trim() || null,
        },
      });
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No pudimos asignar");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
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
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Servicio */}
        <View style={styles.section}>
          <Text variant="labelMedium" style={styles.sectionLabel}>
            SERVICIO
          </Text>
          {selectedServicio ? (
            <Pressable
              onPress={() => {
                setServicioId(null);
                setQuery("");
              }}
              style={({ pressed }) => [
                styles.row,
                styles.rowSelected,
                pressed && styles.rowPressed,
              ]}
            >
              <View style={styles.rowText}>
                <Text variant="bodyLarge" style={styles.rowTitle}>
                  {selectedServicio.nombre}
                </Text>
                <Text variant="bodySmall" style={styles.muted}>
                  {selectedServicio.tipo === "RECURRENTE"
                    ? "Recurrente"
                    : "Único"}
                </Text>
              </View>
              <View style={styles.checkmark}>
                <Text style={styles.checkmarkIcon}>✓</Text>
              </View>
            </Pressable>
          ) : (
            <>
              <Searchbar
                placeholder="Buscar servicio"
                value={query}
                onChangeText={setQuery}
                elevation={0}
                style={styles.searchbar}
                inputStyle={styles.searchbarInput}
              />
              <View style={styles.list}>
                {filtered.length === 0 ? (
                  <Text style={styles.muted}>Sin coincidencias</Text>
                ) : (
                  filtered.map((s) => (
                    <Pressable
                      key={s.id}
                      onPress={() => {
                        setServicioId(s.id);
                        setQuery("");
                      }}
                      style={({ pressed }) => [
                        styles.row,
                        pressed && styles.rowPressed,
                      ]}
                    >
                      <View style={styles.rowText}>
                        <Text variant="bodyLarge" style={styles.rowTitle}>
                          {s.nombre}
                        </Text>
                        <Text variant="bodySmall" style={styles.muted}>
                          {s.tipo === "RECURRENTE" ? "Recurrente" : "Único"}
                        </Text>
                      </View>
                    </Pressable>
                  ))
                )}
              </View>
            </>
          )}
        </View>

        {/* Precio */}
        <Text variant="labelMedium" style={styles.sectionLabel}>
          PRECIO
        </Text>
        <TextInput
          mode="outlined"
          label="Precio"
          value={formatThousands(precio)}
          onChangeText={(t) => setPrecio(sanitizeCurrency(t))}
          keyboardType="decimal-pad"
          left={<TextInput.Affix text="$" />}
          outlineColor="#e0e0e0"
          activeOutlineColor="#2e7d32"
          outlineStyle={styles.outline}
          style={styles.field}
        />
        <TextInput
          mode="outlined"
          label="IVA"
          value={formatThousands(iva)}
          onChangeText={(t) => setIva(sanitizeCurrency(t))}
          keyboardType="decimal-pad"
          left={<TextInput.Affix text="$" />}
          outlineColor="#e0e0e0"
          activeOutlineColor="#2e7d32"
          outlineStyle={styles.outline}
          style={styles.field}
        />
        <View style={styles.totalRow}>
          <Text variant="bodyLarge" style={styles.totalLabel}>
            Total
          </Text>
          <Text variant="bodyLarge" style={styles.totalValue}>
            ${computeTotal(precio, iva)}
          </Text>
        </View>

        {/* Frecuencia */}
        {isRecurrente ? (
          <>
            <Text variant="labelMedium" style={styles.sectionLabel}>
              FRECUENCIA
            </Text>
            <TextInput
              mode="outlined"
              label="Visitas por mes"
              value={frecuenciaMensual}
              onChangeText={(t) =>
                setFrecuenciaMensual(t.replace(/[^\d]/g, ""))
              }
              keyboardType="number-pad"
              outlineColor="#e0e0e0"
              activeOutlineColor="#2e7d32"
              outlineStyle={styles.outline}
              style={styles.field}
            />
          </>
        ) : null}

        {/* Fecha inicio */}
        <View style={styles.section}>
          <Text variant="labelMedium" style={styles.sectionLabel}>
            FECHA DE INICIO
          </Text>
          <Pressable
            onPress={() => setDatePickerOpen(true)}
            style={({ pressed }) => [
              styles.dateRow,
              pressed && styles.rowPressed,
            ]}
          >
            <Text variant="bodyLarge" style={styles.dateValue}>
              {formatLongDate(fechaInicio)}
            </Text>
            <Text style={styles.dateChevron}>›</Text>
          </Pressable>
        </View>

        {/* Notas */}
        <Text variant="labelMedium" style={styles.sectionLabel}>
          NOTAS
        </Text>
        <TextInput
          mode="outlined"
          label="Notas (opcional)"
          value={notas}
          onChangeText={setNotas}
          multiline
          numberOfLines={4}
          outlineColor="#e0e0e0"
          activeOutlineColor="#2e7d32"
          outlineStyle={styles.outline}
          style={[styles.field, styles.notasField]}
          contentStyle={styles.notasContent}
        />

        {error ? (
          <HelperText type="error" visible style={styles.error}>
            {error}
          </HelperText>
        ) : null}
      </ScrollView>

      {/* Sticky footer */}
      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom, 16) + 8 },
        ]}
      >
        <Button
          mode="contained"
          onPress={submit}
          loading={submitting}
          disabled={!canSubmit}
          style={styles.primaryBtn}
          contentStyle={styles.primaryBtnContent}
          labelStyle={styles.primaryBtnLabel}
        >
          Asignar servicio
        </Button>
      </View>

      {/* Date picker dialog */}
      <Portal>
        <Dialog
          visible={datePickerOpen}
          onDismiss={() => setDatePickerOpen(false)}
          style={styles.dateDialog}
        >
          <Dialog.Content>
            <Calendar
              current={fechaInicio}
              markedDates={{
                [fechaInicio]: {
                  selected: true,
                  selectedColor: "#2e7d32",
                },
              }}
              onDayPress={(d: DateData) => {
                setFechaInicio(d.dateString);
                setDatePickerOpen(false);
              }}
              firstDay={1}
              enableSwipeMonths
              theme={{
                backgroundColor: "#fff",
                calendarBackground: "#fff",
                selectedDayBackgroundColor: "#2e7d32",
                selectedDayTextColor: "#fff",
                todayTextColor: "#2e7d32",
                dayTextColor: "#111",
                arrowColor: "#2e7d32",
                textMonthFontWeight: "600",
              }}
            />
          </Dialog.Content>
        </Dialog>
      </Portal>
    </KeyboardAvoidingView>
  );
}

// Strip everything except digits + a single dot, and cap decimals at 2.
function sanitizeCurrency(text: string): string {
  let s = text.replace(/[^\d.]/g, "");
  const firstDot = s.indexOf(".");
  if (firstDot !== -1) {
    // Keep only the first dot
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
    // Cap decimals at 2
    const dec = s.slice(firstDot + 1);
    if (dec.length > 2) s = s.slice(0, firstDot + 1) + dec.slice(0, 2);
  }
  return s;
}

// Add thousand separators for display (input/state stays raw "1234.56").
function formatThousands(value: string): string {
  if (!value) return "";
  const [intPart, decPart] = value.split(".");
  const formattedInt = (intPart || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt;
}

function computeTotal(precio: string, iva: string): string {
  const p = Number(precio) || 0;
  const i = Number(iva) || 0;
  return (p + i).toFixed(2);
}

function formatLongDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-EC", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },

  section: { marginTop: 20, gap: 6 },
  sectionLabel: {
    color: "#888",
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingLeft: 4,
  },

  searchbar: {
    backgroundColor: "#f4f4f4",
    borderRadius: 12,
  },
  searchbarInput: { fontSize: 15 },

  list: { gap: 6, marginTop: 6 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#fafafa",
  },
  rowSelected: { backgroundColor: "#e8f5e9" },
  rowPressed: { backgroundColor: "#eaeaea" },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { color: "#111", fontWeight: "500" },
  muted: { color: "#888" },
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

  field: {
    marginBottom: 8,
    backgroundColor: "#fff",
  },
  outline: { borderRadius: 12 },
  notasField: { minHeight: 110 },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: "#f4f4f4",
    borderRadius: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  totalLabel: { color: "#222", fontWeight: "500" },
  totalValue: { color: "#2e7d32", fontWeight: "700" },

  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: "#fafafa",
  },
  dateValue: { color: "#111", textTransform: "capitalize" },
  dateChevron: { fontSize: 22, color: "#bbb" },
  dateDialog: { backgroundColor: "#fff", borderRadius: 16 },

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
  primaryBtn: { borderRadius: 14 },
  primaryBtnContent: { paddingVertical: 8 },
  primaryBtnLabel: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});
