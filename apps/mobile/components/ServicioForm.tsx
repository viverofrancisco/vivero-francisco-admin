import { useState } from "react";
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
  HelperText,
  Text,
  TextInput,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CreateServicioBody, TipoProducto } from "@vivero/shared";

const PRIMARY = "#2e7d32";

export interface ServicioFormProps {
  initial?: Partial<CreateServicioBody>;
  submitLabel: string;
  onSubmit: (values: CreateServicioBody) => Promise<void>;
}

export function ServicioForm({
  initial,
  submitLabel,
  onSubmit,
}: ServicioFormProps) {
  const insets = useSafeAreaInsets();
  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? "");
  const [tipo, setTipo] = useState<TipoProducto>(initial?.tipo ?? "SERVICIO");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!nombre.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
        tipo,
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
        <SectionTitle>Servicio</SectionTitle>
        <TextInput
          mode="outlined"
          label="Nombre *"
          value={nombre}
          onChangeText={setNombre}
          outlineColor="#e0e0e0"
          activeOutlineColor={PRIMARY}
          outlineStyle={styles.outline}
          style={styles.field}
        />
        <TextInput
          mode="outlined"
          label="Descripción"
          value={descripcion ?? ""}
          onChangeText={setDescripcion}
          multiline
          numberOfLines={4}
          outlineColor="#e0e0e0"
          activeOutlineColor={PRIMARY}
          outlineStyle={styles.outline}
          style={[styles.field, styles.notas]}
          contentStyle={styles.notasContent}
        />

        <SectionTitle>Tipo</SectionTitle>
        <View style={styles.tipoList}>
          <TipoOption
            label="Servicio"
            description="Trabajo que se ejecuta en una visita"
            selected={tipo === "SERVICIO"}
            onPress={() => setTipo("SERVICIO")}
          />
          <TipoOption
            label="Bien"
            description="Producto que se despacha"
            selected={tipo === "BIEN"}
            onPress={() => setTipo("BIEN")}
          />
        </View>

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

function TipoOption({
  label,
  description,
  selected,
  onPress,
}: {
  label: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tipoRow,
        selected && styles.tipoRowSelected,
        pressed && !selected && styles.tipoRowPressed,
      ]}
    >
      <View style={styles.tipoText}>
        <Text variant="bodyLarge" style={styles.tipoTitle}>
          {label}
        </Text>
        <Text variant="bodySmall" style={styles.tipoDesc}>
          {description}
        </Text>
      </View>
      {selected ? (
        <View style={styles.checkmark}>
          <Text style={styles.checkmarkIcon}>✓</Text>
        </View>
      ) : null}
    </Pressable>
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
  outline: { borderRadius: 12 },
  notas: { minHeight: 110 },
  notasContent: { paddingTop: 12, paddingBottom: 12 },

  tipoList: { gap: 6 },
  tipoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#fafafa",
  },
  tipoRowSelected: { backgroundColor: "#e8f5e9" },
  tipoRowPressed: { backgroundColor: "#eaeaea" },
  tipoText: { flex: 1, gap: 2 },
  tipoTitle: { color: "#111", fontWeight: "500" },
  tipoDesc: { color: "#888" },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  checkmarkIcon: { color: "#fff", fontWeight: "700", fontSize: 14 },

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
