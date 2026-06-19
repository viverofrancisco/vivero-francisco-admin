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
  Button,
  Dialog,
  HelperText,
  Portal,
  Searchbar,
  Text,
  TextInput,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CreateClienteBody } from "@vivero/shared";
import { apiRequest } from "@/lib/api";
import type { SectorOption, SectoresListResponse } from "@/lib/types";

const PRIMARY = "#2e7d32";

export interface ClienteFormProps {
  initial?: Partial<CreateClienteBody>;
  submitLabel: string;
  onSubmit: (values: CreateClienteBody) => Promise<void>;
}

export function ClienteForm({
  initial,
  submitLabel,
  onSubmit,
}: ClienteFormProps) {
  const insets = useSafeAreaInsets();

  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [apellido, setApellido] = useState(initial?.apellido ?? "");
  const [empresa, setEmpresa] = useState(initial?.empresa ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [telefono, setTelefono] = useState(initial?.telefono ?? "");
  const [ciudad, setCiudad] = useState(initial?.ciudad ?? "");
  const [direccion, setDireccion] = useState(initial?.direccion ?? "");
  const [numeroCasa, setNumeroCasa] = useState(initial?.numeroCasa ?? "");
  const [referencia, setReferencia] = useState(initial?.referencia ?? "");
  const [notas, setNotas] = useState(initial?.notas ?? "");
  const [metrosCuadrados, setMetrosCuadrados] = useState(
    initial?.metrosCuadrados != null ? String(initial.metrosCuadrados) : ""
  );
  const [sectorId, setSectorId] = useState<string | null>(
    initial?.sectorId ?? null
  );

  const [sectores, setSectores] = useState<SectorOption[]>([]);
  const [sectorPickerOpen, setSectorPickerOpen] = useState(false);
  const [sectorQuery, setSectorQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedSector = sectores.find((s) => s.id === sectorId);
  const filteredSectores = useMemo(() => {
    const q = sectorQuery.trim().toLowerCase();
    if (!q) return sectores;
    return sectores.filter((s) => s.nombre.toLowerCase().includes(q));
  }, [sectorQuery, sectores]);

  useEffect(() => {
    apiRequest<SectoresListResponse>("/api/mobile/sectores")
      .then((res) => setSectores(res.items))
      .catch(() => {});
  }, []);

  async function submit() {
    if (!nombre.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const metros = metrosCuadrados.trim() ? Number(metrosCuadrados) : null;
      if (metros !== null && (!Number.isFinite(metros) || metros <= 0)) {
        setError("Metros² debe ser un número mayor a 0");
        setSubmitting(false);
        return;
      }
      await onSubmit({
        nombre: nombre.trim(),
        apellido: apellido?.trim() || null,
        empresa: empresa?.trim() || null,
        email: email?.trim() || null,
        telefono: telefono?.trim() || null,
        ciudad: ciudad?.trim() || null,
        sectorId: sectorId ?? null,
        direccion: direccion?.trim() || null,
        numeroCasa: numeroCasa?.trim() || null,
        referencia: referencia?.trim() || null,
        notas: notas?.trim() || null,
        metrosCuadrados: metros,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSubmitting(false);
    }
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
        <SectionTitle>Nombre</SectionTitle>
        <Field
          label="Nombre"
          required
          value={nombre}
          onChangeText={setNombre}
        />
        <Field
          label="Apellido"
          value={apellido ?? ""}
          onChangeText={setApellido}
        />
        <Field
          label="Empresa"
          value={empresa ?? ""}
          onChangeText={setEmpresa}
        />

        <SectionTitle>Contacto</SectionTitle>
        <Field
          label="Teléfono"
          value={telefono ?? ""}
          onChangeText={setTelefono}
          keyboardType="phone-pad"
        />
        <Field
          label="Email"
          value={email ?? ""}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <SectionTitle>Sector</SectionTitle>
        <Pressable
          onPress={() => {
            setSectorQuery("");
            setSectorPickerOpen(true);
          }}
          style={({ pressed }) => [
            styles.sectorRow,
            pressed && styles.sectorRowPressed,
          ]}
        >
          <Text variant="bodyLarge" style={styles.sectorValue}>
            {selectedSector?.nombre ?? "Sin sector"}
          </Text>
          <Text style={styles.sectorChevron}>›</Text>
        </Pressable>

        <SectionTitle>Dirección</SectionTitle>
        <Field
          label="Calle"
          value={direccion ?? ""}
          onChangeText={setDireccion}
        />
        <Field
          label="Número de casa"
          value={numeroCasa ?? ""}
          onChangeText={setNumeroCasa}
        />
        <Field
          label="Ciudad"
          value={ciudad ?? ""}
          onChangeText={setCiudad}
        />
        <Field
          label="Referencia"
          value={referencia ?? ""}
          onChangeText={setReferencia}
        />
        <Field
          label="Metros²"
          value={metrosCuadrados}
          onChangeText={(t) => setMetrosCuadrados(t.replace(/[^\d.]/g, ""))}
          keyboardType="numeric"
        />

        <SectionTitle>Notas</SectionTitle>
        <TextInput
          mode="outlined"
          value={notas ?? ""}
          onChangeText={setNotas}
          multiline
          numberOfLines={5}
          placeholder="Información adicional..."
          outlineColor="#e0e0e0"
          activeOutlineColor={PRIMARY}
          outlineStyle={styles.outline}
          style={[styles.field, styles.notas]}
          contentStyle={styles.notasContent}
        />

        {error ? (
          <HelperText type="error" visible style={styles.error}>
            {error}
          </HelperText>
        ) : null}
      </ScrollView>

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
          disabled={submitting || !nombre.trim()}
          style={styles.primaryBtn}
          contentStyle={styles.primaryBtnContent}
          labelStyle={styles.primaryBtnLabel}
        >
          {submitLabel}
        </Button>
      </View>

      {/* Sector picker dialog */}
      <Portal>
        <Dialog
          visible={sectorPickerOpen}
          onDismiss={() => setSectorPickerOpen(false)}
          style={styles.sectorDialog}
        >
          <Dialog.Title>Seleccionar sector</Dialog.Title>
          <Dialog.Content style={styles.sectorDialogContent}>
            <Searchbar
              placeholder="Buscar sector"
              value={sectorQuery}
              onChangeText={setSectorQuery}
              elevation={0}
              style={styles.sectorSearch}
              inputStyle={styles.sectorSearchInput}
              autoFocus
            />
          </Dialog.Content>
          <Dialog.ScrollArea style={styles.sectorDialogScroll}>
            <ScrollView>
              <Pressable
                onPress={() => {
                  setSectorId(null);
                  setSectorPickerOpen(false);
                }}
                style={({ pressed }) => [
                  styles.sectorOption,
                  sectorId === null && styles.sectorOptionSelected,
                  pressed && styles.sectorOptionPressed,
                ]}
              >
                <Text variant="bodyLarge" style={styles.sectorOptionText}>
                  Sin sector
                </Text>
                {sectorId === null ? (
                  <View style={styles.checkmark}>
                    <Text style={styles.checkmarkIcon}>✓</Text>
                  </View>
                ) : null}
              </Pressable>
              {filteredSectores.length === 0 ? (
                <Text style={styles.empty}>Sin coincidencias.</Text>
              ) : (
                filteredSectores.map((s) => {
                  const selected = sectorId === s.id;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => {
                        setSectorId(s.id);
                        setSectorPickerOpen(false);
                      }}
                      style={({ pressed }) => [
                        styles.sectorOption,
                        selected && styles.sectorOptionSelected,
                        pressed && !selected && styles.sectorOptionPressed,
                      ]}
                    >
                      <Text variant="bodyLarge" style={styles.sectorOptionText}>
                        {s.nombre}
                      </Text>
                      {selected ? (
                        <View style={styles.checkmark}>
                          <Text style={styles.checkmarkIcon}>✓</Text>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setSectorPickerOpen(false)}>Cerrar</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </KeyboardAvoidingView>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text variant="labelMedium" style={styles.sectionTitle}>
      {String(children).toUpperCase()}
    </Text>
  );
}

function Field({
  label,
  required,
  value,
  onChangeText,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?:
    | "default"
    | "email-address"
    | "phone-pad"
    | "numeric"
    | "decimal-pad";
  autoCapitalize?: "none" | "sentences" | "words";
}) {
  return (
    <TextInput
      mode="outlined"
      label={required ? `${label} *` : label}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      outlineColor="#e0e0e0"
      activeOutlineColor={PRIMARY}
      outlineStyle={styles.outline}
      style={styles.field}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },

  sectionTitle: {
    color: "#888",
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingLeft: 4,
    marginTop: 18,
    marginBottom: 8,
  },

  field: {
    marginBottom: 8,
    backgroundColor: "#fff",
  },
  outline: {
    borderRadius: 12,
  },

  sectorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#fafafa",
    marginBottom: 8,
  },
  sectorRowPressed: { backgroundColor: "#eaeaea" },
  sectorValue: { color: "#111" },
  sectorChevron: { fontSize: 22, color: "#bbb" },

  sectorDialog: { backgroundColor: "#fff", borderRadius: 16 },
  sectorDialogContent: { paddingBottom: 8 },
  sectorDialogScroll: { paddingHorizontal: 0, maxHeight: 360 },
  sectorSearch: {
    backgroundColor: "#f4f4f4",
    borderRadius: 12,
  },
  sectorSearchInput: { fontSize: 15 },

  sectorOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  sectorOptionSelected: { backgroundColor: "#e8f5e9" },
  sectorOptionPressed: { backgroundColor: "#fafafa" },
  sectorOptionText: { color: "#111" },
  checkmark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#2e7d32",
    alignItems: "center",
    justifyContent: "center",
  },
  checkmarkIcon: { color: "#fff", fontWeight: "700", fontSize: 12 },
  empty: { padding: 16, color: "#888", textAlign: "center" },

  notas: {
    minHeight: 110,
  },
  notasContent: {
    paddingTop: 12,
    paddingBottom: 12,
  },

  error: { textAlign: "center", marginTop: 16 },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#eee",
  },
  primaryBtn: { borderRadius: 14 },
  primaryBtnContent: { paddingVertical: 8 },
  primaryBtnLabel: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});
