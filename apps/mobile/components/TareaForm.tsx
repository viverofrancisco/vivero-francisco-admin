import { useState } from "react";
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { HelperText } from "react-native-paper";
import { BotonEliminar, Campo, Titulo } from "@/components/ui/Formulario";
import { EncabezadoDeFormulario } from "@/components/ui/EncabezadoDeFormulario";
import { mensajeDeError } from "@/lib/api";
import { tema } from "@/lib/tema";

/**
 * Una tarea del catálogo: su nombre y en qué consiste.
 *
 * Sin precio, sin IVA y sin stock: una tarea es lo que se **hace** en una
 * visita, no lo que se vende. La descripción no es decoración — es el texto con
 * el que el asistente de informes escribe la sección de esa tarea, así que vale
 * la pena escribirla una vez bien.
 *
 * *Cancelar* · título · *Crear* / *Guardar* arriba (`EncabezadoDeFormulario`),
 * como los demás formularios de la app y el portal en el teléfono: tenía la
 * barra nativa con "index" en la flecha y un botón ancho al pie.
 */
export function TareaForm({
  inicial,
  titulo,
  accion,
  onSubmit,
  onCancelar,
  onEliminar,
}: {
  inicial?: { nombre: string; descripcion: string | null };
  titulo: string;
  /** "Crear" o "Guardar". */
  accion: string;
  onSubmit: (valores: { nombre: string; descripcion: string | null }) => Promise<void>;
  onCancelar: () => void;
  onEliminar?: () => void;
}) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
   * Al editar, *Guardar* se prende solo cuando algo difiere de lo cargado:
   * un botón verde sobre una ficha sin tocar invita a apretarlo para nada.
   * Al crear, con el nombre alcanza.
   */
  const valores = { nombre: nombre.trim(), descripcion: descripcion.trim() || null };
  const hayCambios = inicial
    ? valores.nombre !== inicial.nombre || valores.descripcion !== inicial.descripcion
    : valores.nombre.length > 0;

  async function guardar() {
    if (!nombre.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      await onSubmit(valores);
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos guardar"));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <View style={styles.flex}>
      <EncabezadoDeFormulario
        titulo={titulo}
        accion={accion}
        onAccion={guardar}
        onCancelar={onCancelar}
        cargando={guardando}
        deshabilitado={!valores.nombre || !hayCambios}
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
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  error: { textAlign: "center", marginTop: 16, color: tema.rojo },
});
