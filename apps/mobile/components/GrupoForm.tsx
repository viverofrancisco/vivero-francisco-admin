import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { HelperText, Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import {
  BotonEliminar,
  Campo,
  PieDeFormulario,
  Titulo,
} from "@/components/ui/Formulario";
import { apiRequest, mensajeDeError } from "@/lib/api";
import type { PersonalFicha } from "@/lib/types";
import { tema } from "@/lib/tema";

export interface DatosGrupo {
  nombre: string;
  descripcion: string | null;
  miembrosIds: string[];
}

/**
 * Una cuadrilla: quiénes trabajan juntos.
 *
 * El grupo dice con quién sale cada uno **habitualmente**; quién fue a una
 * visita es la asignación, que se elige al agendar y es la que cuenta para las
 * horas y las tareas. Por eso acá no hay nada de visitas: cambiar la cuadrilla
 * no reescribe lo que ya pasó.
 *
 * Los miembros se eligen tocando la lista entera, sin buscador: el vivero tiene
 * cinco personas y un buscador sobre cinco filas es un campo de más.
 */
export function GrupoForm({
  inicial,
  etiqueta,
  onSubmit,
  onEliminar,
}: {
  inicial?: DatosGrupo;
  etiqueta: string;
  onSubmit: (valores: DatosGrupo) => Promise<void>;
  onEliminar?: () => void;
}) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? "");
  const [miembros, setMiembros] = useState<string[]>(inicial?.miembrosIds ?? []);
  const [gente, setGente] = useState<PersonalFicha[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<{ items: PersonalFicha[] }>("/api/mobile/personal")
      .then((res) => setGente(res.items))
      .catch(() => {});
  }, []);

  function alternar(id: string) {
    setMiembros((antes) =>
      antes.includes(id) ? antes.filter((x) => x !== id) : [...antes, id]
    );
  }

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
        miembrosIds: miembros,
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
          placeholder="Grupo 1 Mantenimiento"
        />
        <Campo
          label="Descripción"
          value={descripcion}
          onChangeText={setDescripcion}
        />

        <Titulo>
          {miembros.length > 0 ? `Quiénes (${miembros.length})` : "Quiénes"}
        </Titulo>
        <View style={styles.gente}>
          {gente.length === 0 ? (
            <Text style={styles.nota}>No hay personal cargado todavía.</Text>
          ) : (
            gente.map((p) => {
              const elegido = miembros.includes(p.id);
              return (
                <Pressable
                  key={p.id}
                  onPress={() => alternar(p.id)}
                  style={({ pressed }) => [
                    styles.persona,
                    elegido && styles.personaElegida,
                    pressed && !elegido && styles.personaPresionada,
                  ]}
                >
                  <Text variant="bodyLarge" style={styles.personaNombre}>
                    {`${p.nombre} ${p.apellido ?? ""}`.trim()}
                  </Text>
                  {elegido ? (
                    <View style={styles.tilde}>
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    </View>
                  ) : null}
                </Pressable>
              );
            })
          )}
        </View>

        {error ? (
          <HelperText type="error" visible style={styles.error}>
            {error}
          </HelperText>
        ) : null}

        {onEliminar ? (
          <BotonEliminar etiqueta="Archivar grupo" onPress={onEliminar} />
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
  gente: { gap: 8 },
  persona: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#fafafa",
  },
  personaElegida: { backgroundColor: tema.verde50 },
  personaPresionada: { backgroundColor: "#f0f0f0" },
  personaNombre: { color: tema.texto, flexShrink: 1 },
  tilde: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: tema.verde,
    alignItems: "center",
    justifyContent: "center",
  },
  nota: { color: tema.texto3, paddingVertical: 8 },
  error: { textAlign: "center", marginTop: 16, color: tema.rojo },
});
