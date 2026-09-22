import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { PressableScale } from "@/components/ui/PressableScale";
import { Campo, PieDeFormulario, Titulo } from "@/components/ui/Formulario";
import type { ChatDetalle } from "@/lib/chats";
import { tema } from "@/lib/tema";

interface Persona {
  id: string;
  nombre: string;
  rol: string;
}

const ROL: Record<string, string> = {
  ADMIN: "Admin",
  STAFF: "Oficina",
  PERSONAL: "Campo",
};

/**
 * Armar un chat o cambiarle la gente. **Solo el ADMIN llega acá** — el servicio
 * lo rechaza igual, pero la pantalla no ofrece lo que después va a negar.
 *
 * La misma pantalla crea y edita: con `?id=` trae lo que hay y guarda encima.
 * Son los mismos dos campos, y dos pantallas iguales son dos lugares donde
 * arreglar lo mismo.
 */
export default function ChatFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const editando = Boolean(id);

  const [nombre, setNombre] = useState("");
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [personas, setPersonas] = useState<Persona[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [lista, chat] = await Promise.all([
          apiRequest<{ items: Persona[] }>("/api/mobile/chats/miembros"),
          id
            ? apiRequest<ChatDetalle>(`/api/mobile/chats/${id}`)
            : Promise.resolve(null),
        ]);
        if (!vivo) return;
        setPersonas(lista.items);
        if (chat) {
          setNombre(chat.nombre);
          setElegidos(chat.miembros.map((m) => m.id));
        }
      } catch (e) {
        if (vivo) setError(mensajeDeError(e, "No pudimos cargar"));
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [id]);

  async function guardar() {
    if (!nombre.trim()) {
      setError("Ponele un nombre");
      return;
    }
    setGuardando(true);
    try {
      const body = { nombre: nombre.trim(), miembrosIds: elegidos };
      if (editando) {
        await apiRequest(`/api/mobile/chats/${id}`, { method: "PUT", body });
        router.back();
      } else {
        const chat = await apiRequest<{ id: string }>("/api/mobile/chats", {
          method: "POST",
          body,
        });
        router.replace(`/(personal)/chats/${chat.id}`);
      }
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos guardar"));
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.pantalla}>
      <ScrollView contentContainerStyle={styles.cuerpo}>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Campo
          label="Nombre"
          required
          value={nombre}
          onChangeText={setNombre}
          placeholder="Cuadrilla 1, Oficina, Urgencias..."
        />

        <Titulo>Quiénes están</Titulo>
        {personas === null || personas.length === 0 ? (
          <Text style={styles.vacio}>
            No hay cuentas que puedan entrar a un chat.
          </Text>
        ) : (
          <View style={styles.lista}>
            {personas.map((p) => {
              const marcado = elegidos.includes(p.id);
              return (
                <PressableScale
                  key={p.id}
                  onPress={() =>
                    setElegidos((actuales) =>
                      marcado
                        ? actuales.filter((x) => x !== p.id)
                        : [...actuales, p.id]
                    )
                  }
                  estiloExterno={styles.ancho}
                  style={[styles.fila, marcado && styles.filaMarcada]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: marcado }}
                >
                  <Ionicons
                    name={marcado ? "checkbox" : "square-outline"}
                    size={22}
                    color={marcado ? tema.verde : tema.texto3}
                  />
                  <Text style={styles.nombre} numberOfLines={1}>
                    {p.nombre}
                  </Text>
                  <Text style={styles.rol}>{ROL[p.rol] ?? p.rol}</Text>
                </PressableScale>
              );
            })}
          </View>
        )}
        {/* Quien lo arma queda adentro sin marcarse: es el que después va a
            tener que agregar o sacar gente. */}
        <Text style={styles.nota}>
          Vos quedás adentro siempre. Al agregar a alguien le llega un aviso al
          teléfono.
        </Text>
      </ScrollView>

      <PieDeFormulario
        etiqueta={editando ? "Guardar" : "Crear chat"}
        onPress={guardar}
        cargando={guardando}
        deshabilitado={!nombre.trim()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.fondo },
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  cuerpo: { padding: 16, gap: 12, paddingBottom: 32 },
  ancho: { alignSelf: "stretch" },
  lista: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tema.linea,
    backgroundColor: tema.superficie,
    overflow: "hidden",
  },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tema.linea2,
  },
  filaMarcada: { backgroundColor: tema.verde50 },
  nombre: { flex: 1, fontSize: 15, fontWeight: "500", color: tema.texto },
  rol: { fontSize: 12, color: tema.texto3 },
  nota: { fontSize: 13, color: tema.texto3 },
  vacio: { color: tema.texto3 },
  error: { color: tema.rojo },
});
