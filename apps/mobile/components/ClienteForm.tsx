import { useState } from "react";
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { HelperText, Text, TextInput } from "react-native-paper";
import { useRouter } from "expo-router";
import type { CreateClienteBody, CreatePropiedadBody } from "@vivero/shared";
import {
  CamposDePropiedad,
  useCamposDePropiedad,
} from "@/components/PropiedadForm";
import { EncabezadoDeFormulario } from "@/components/ui/EncabezadoDeFormulario";
import { tema } from "@/lib/tema";

const PRIMARY = tema.verde;

export interface ClienteFormProps {
  initial?: Partial<CreateClienteBody>;
  /** "Nuevo cliente", "Editar cliente": va en el medio del encabezado. */
  titulo: string;
  /** "Crear", "Guardar": la acción, a la derecha del encabezado. */
  accion: string;
  onSubmit: (values: CreateClienteBody) => Promise<void>;
  /** Por defecto vuelve atrás. */
  onCancelar?: () => void;
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

/**
 * El formulario del cliente, con la acción en el encabezado.
 *
 * *Cancelar* · título · *Crear* arriba (`EncabezadoDeFormulario`), como en
 * Nueva orden y Nueva suscripción: es lo único que no se va scrolleando, y el
 * botón al pie que había quedaba debajo del teclado en cuanto se tocaba un
 * campo. El error se muestra arriba, pegado al encabezado, porque es ahí
 * donde se está mirando cuando se toca la acción.
 */
export function ClienteForm({
  initial,
  titulo,
  accion,
  onSubmit,
  onCancelar,
  pidePropiedad = true,
}: ClienteFormProps) {
  const router = useRouter();

  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [apellido, setApellido] = useState(initial?.apellido ?? "");
  const [empresa, setEmpresa] = useState(initial?.empresa ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [telefono, setTelefono] = useState(initial?.telefono ?? "");
  const [notas, setNotas] = useState(initial?.notas ?? "");
  /*
   * La dirección es de la **propiedad**, no del cliente.
   *
   * Un cliente con dos casas tiene dos direcciones y ninguna es "la suya". Acá
   * se carga la primera —sin un lugar donde trabajar el cliente no sirve para
   * agendar—, **entera**: los mismos campos que su propia pantalla, punto y
   * medidas incluidos. Pedía la dirección y los metros totales y nada más, y
   * la propiedad quedaba a medio cargar hasta que alguien la reabría. Las
   * demás se agregan desde la ficha del cliente, cada una con su pantalla.
   */
  const propiedad = useCamposDePropiedad(initial?.propiedad);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!nombre.trim()) {
      setError("El nombre es obligatorio");
      return;
    }

    let valoresPropiedad: CreatePropiedadBody | undefined;
    if (pidePropiedad) {
      const armado = propiedad.armar({ nombreOpcional: true });
      if (!armado.ok) {
        setError(armado.error);
        return;
      }
      valoresPropiedad = armado.valores;
    }

    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        nombre: nombre.trim(),
        apellido: apellido?.trim() || null,
        empresa: empresa?.trim() || null,
        email: email?.trim() || null,
        telefono: telefono?.trim() || null,
        notas: notas?.trim() || null,
        ...(valoresPropiedad ? { propiedad: valoresPropiedad } : {}),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.flex}>
      <EncabezadoDeFormulario
        titulo={titulo}
        accion={accion}
        onAccion={submit}
        onCancelar={onCancelar ?? (() => router.back())}
        cargando={submitting}
        deshabilitado={!nombre.trim()}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {error ? (
            <HelperText type="error" visible style={styles.error}>
              {error}
            </HelperText>
          ) : null}

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
            <CamposDePropiedad campos={propiedad} dentroDelCliente />
          ) : null}

          <SectionTitle>{pidePropiedad ? "Notas del cliente" : "Notas"}</SectionTitle>
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
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
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

  error: { textAlign: "center", marginTop: 4 },
});
