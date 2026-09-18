import { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { ActivityIndicator, FAB, Text } from "react-native-paper";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { PressableScale } from "@/components/ui/PressableScale";
import { FILA_LISTA, PantallaLista } from "@/components/ui/PantallaLista";
import { useAuthStore } from "@/lib/auth-store";
import type { PersonalFicha } from "@/lib/types";
import { tema } from "@/lib/tema";

const ETIQUETA_TIPO: Record<string, string> = {
  JARDINERO: "Jardinero",
  CHOFER: "Chofer",
  SUPERVISOR: "Supervisor",
  MECANICO: "Mecánico",
};

/**
 * La gente del vivero.
 *
 * La fila dice lo que se busca acá: quién es, qué hace y **con qué entra a la
 * app** —el usuario es lo que la oficina dicta por teléfono, y lo primero que
 * la persona olvida—. El acceso revocado se avisa porque explica solo por qué
 * alguien dice que "no puede entrar".
 */
export default function PersonalListScreen() {
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.role);
  const puedeEditar = rol === "ADMIN" || rol === "STAFF";
  const [items, setItems] = useState<PersonalFicha[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (inicial = false) => {
    if (inicial) setCargando(true);
    else setRefrescando(true);
    try {
      const res = await apiRequest<{ items: PersonalFicha[] }>(
        "/api/mobile/personal"
      );
      setItems(res.items);
      setError(null);
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos cargar el personal"));
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar(items.length === 0);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cargar])
  );

  const q = busqueda.trim().toLowerCase();
  const visibles = q
    ? items.filter((p) =>
        `${p.nombre} ${p.apellido ?? ""} ${p.user?.usuario ?? ""}`
          .toLowerCase()
          .includes(q)
      )
    : items;

  return (
    <PantallaLista
      titulo="Personal"
      busqueda={busqueda}
      onBuscar={setBusqueda}
      placeholder="Buscar por nombre o usuario..."
    >
      {cargando ? (
        <View style={styles.centro}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
      <FlatList
        data={visibles}
        keyExtractor={(p) => p.id}
        refreshControl={
          <RefreshControl refreshing={refrescando} onRefresh={() => cargar()} />
        }
        ListHeaderComponent={
          error ? <Text style={styles.error}>{error}</Text> : null
        }
        ListEmptyComponent={
          <View style={styles.vacio}>
            <Text variant="titleMedium" style={styles.vacioTitulo}>
              {q ? "Sin coincidencias" : "No hay nadie cargado"}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <PressableScale
            onPress={() => router.push(`/(personal)/personal/${item.id}`)}
            style={FILA_LISTA}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarTexto}>
                {item.nombre.slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={styles.filaTexto}>
              <Text variant="bodyLarge" style={styles.nombre}>
                {`${item.nombre} ${item.apellido ?? ""}`.trim()}
              </Text>
              <Text variant="bodySmall" style={styles.detalle}>
                {[
                  ETIQUETA_TIPO[item.tipo ?? ""] ?? item.tipo,
                  item.user?.usuario,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Sin cuenta"}
              </Text>
              {item.estado !== "ACTIVO" || item.user?.accesoRevocadoEl ? (
                <Text variant="bodySmall" style={styles.aviso}>
                  {item.estado !== "ACTIVO" ? "Inactivo" : "Acceso revocado"}
                </Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={tema.texto3} />
          </PressableScale>
        )}
      />
      )}

      {puedeEditar ? (
        <FAB
          icon="plus"
          style={styles.fab}
          color="#fff"
          onPress={() => router.push("/(personal)/personal/nuevo")}
        />
      ) : null}
    </PantallaLista>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tema.verde50,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTexto: { color: tema.verde700, fontWeight: "700", fontSize: 16 },
  filaTexto: { flex: 1, gap: 2 },
  nombre: { color: tema.texto, fontWeight: "500" },
  detalle: { color: tema.texto3 },
  aviso: { color: tema.ambarTexto },
  vacio: { alignItems: "center", paddingVertical: 48 },
  vacioTitulo: { color: tema.texto },
  error: { color: tema.rojo, textAlign: "center", padding: 16 },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
    backgroundColor: tema.verde,
    borderRadius: 16,
  },
});
