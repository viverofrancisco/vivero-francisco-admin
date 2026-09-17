import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Button, HelperText, Text, TextInput } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CreateClienteBody } from "@vivero/shared";
import { SelectorSector } from "@/components/SelectorSector";
import { tema } from "@/lib/tema";

const PRIMARY = tema.verde;

export interface ClienteFormProps {
  initial?: Partial<CreateClienteBody>;
  submitLabel: string;
  onSubmit: (values: CreateClienteBody) => Promise<void>;
  /**
   * Si se pregunta también por la primera propiedad. Solo al crear.
   *
   * Al editar estos campos estaban y **no hacían nada**: `updateClienteSchema`
   * no tiene `propiedad`, así que Zod los descartaba y la dirección volvía
   * igual que antes sin decir una palabra. Ahora las propiedades tienen su
   * pantalla, que es donde se corrigen.
   */
  pidePropiedad?: boolean;
}

export function ClienteForm({
  initial,
  submitLabel,
  onSubmit,
  pidePropiedad = true,
}: ClienteFormProps) {
  const insets = useSafeAreaInsets();

  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [apellido, setApellido] = useState(initial?.apellido ?? "");
  const [empresa, setEmpresa] = useState(initial?.empresa ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [telefono, setTelefono] = useState(initial?.telefono ?? "");
  /*
   * La dirección es de la **propiedad**, no del cliente.
   *
   * Un cliente con dos casas tiene dos direcciones y ninguna es "la suya". Acá
   * se carga la primera —sin un lugar donde trabajar el cliente no sirve para
   * agendar—, y las demás se agregan desde su ficha, cada una con su pantalla.
   */
  const [ciudad, setCiudad] = useState(initial?.propiedad?.ciudad ?? "");
  const [direccion, setDireccion] = useState(initial?.propiedad?.direccion ?? "");
  const [numeroCasa, setNumeroCasa] = useState(
    initial?.propiedad?.numeroCasa ?? ""
  );
  const [referencia, setReferencia] = useState(
    initial?.propiedad?.referencia ?? ""
  );
  const [notas, setNotas] = useState(initial?.notas ?? "");
  const [metrosCuadrados, setMetrosCuadrados] = useState(
    initial?.propiedad?.m2Total != null ? String(initial.propiedad.m2Total) : ""
  );
  const [sectorId, setSectorId] = useState<string | null>(
    initial?.propiedad?.sectorId ?? null
  );

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
        notas: notas?.trim() || null,
        ...(pidePropiedad
          ? {
              propiedad: {
                ciudad: ciudad?.trim() || null,
                sectorId: sectorId ?? null,
                direccion: direccion?.trim() || null,
                numeroCasa: numeroCasa?.trim() || null,
                referencia: referencia?.trim() || null,
                m2Total: metros,
              },
            }
          : {}),
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

        {pidePropiedad ? (
          <>
            {/* La dirección es de la **propiedad**, no del cliente. Acá se
                carga la primera —sin ella el cliente no sirve para agendar—;
                las demás se agregan desde su ficha. */}
            <SectionTitle>Sector</SectionTitle>
            <SelectorSector value={sectorId} onChange={setSectorId} />

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
            <Field label="Ciudad" value={ciudad ?? ""} onChangeText={setCiudad} />
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
          </>
        ) : null}

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
