import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from "react-native";
import { HelperText } from "react-native-paper";
import {
  BotonEliminar,
  Campo,
  PieDeFormulario,
  Titulo,
} from "@/components/ui/Formulario";
import { mensajeDeError } from "@/lib/api";
import { tema } from "@/lib/tema";

/**
 * Una tarea del catálogo: su nombre y en qué consiste.
 *
 * Sin precio, sin IVA y sin stock: una tarea es lo que se **hace** en una
 * visita, no lo que se vende. La descripción no es decoración — es el texto con
 * el que el asistente de informes escribe la sección de esa tarea, así que vale
 * la pena escribirla una vez bien.
 */
export function TareaForm({
  inicial,
  etiqueta,
  onSubmit,
  onEliminar,
}: {
  inicial?: { nombre: string; descripcion: string | null };
  etiqueta: string;
  onSubmit: (valores: { nombre: string; descripcion: string | null }) => Promise<void>;
  onEliminar?: () => void;
}) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    if (!nombre.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      await onSubmit({
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
      });
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos guardar"));
    } finally {
      setGuardando(false);
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
        <Titulo>Nombre</Titulo>
        <Campo
          label="Nombre"
          required
          value={nombre}
          onChangeText={setNombre}
          placeholder="Poda de setos"
        />

        <Titulo>En qué consiste</Titulo>
        <Campo
          label="Descripción"
          value={descripcion}
          onChangeText={setDescripcion}
          multiline
          placeholder="Lo que el informe va a contar de esta tarea."
        />

        {error ? (
          <HelperText type="error" visible style={styles.error}>
            {error}
          </HelperText>
        ) : null}

        {onEliminar ? (
          <BotonEliminar etiqueta="Eliminar tarea" onPress={onEliminar} />
        ) : null}
      </ScrollView>

      <PieDeFormulario
        etiqueta={etiqueta}
        onPress={guardar}
        cargando={guardando}
        deshabilitado={!nombre.trim()}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  error: { textAlign: "center", marginTop: 16, color: tema.rojo },
});
