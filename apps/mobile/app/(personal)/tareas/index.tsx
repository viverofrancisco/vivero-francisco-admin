import { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { ActivityIndicator, FAB, Searchbar, Text } from "react-native-paper";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { PressableScale } from "@/components/ui/PressableScale";
import { tema } from "@/lib/tema";

interface Tarea {
  id: string;
  nombre: string;
  descripcion: string | null;
}

/**
 * El catálogo de tareas: lo que se hace en una visita.
 *
 * Es una lista cerrada que mantiene la oficina, no texto libre — con texto
 * libre aparecen "poda de setos", "Poda setos" y "podar los setos" para una
 * sola cosa, y con eso no se puede ni agrupar las fotos del informe ni
 * responder si se hizo o no.
 *
 * **El orden se arregla en el portal.** Acá se listan como el portal las
 * ordena; arrastrar diecisiete filas es un gesto de escritorio, y hacerlo con
 * el pulgar en una lista que scrollea es pelear con el scroll.
 */
export default function TareasListScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Tarea[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (inicial = false) => {
    if (inicial) setCargando(true);
    else setRefrescando(true);
    try {
      const res = await apiRequest<{ items: Tarea[] }>("/api/mobile/tareas");
      setItems(res.items);
      setError(null);
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos cargar las tareas"));
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, []);

  // Al volver de crear o editar, la lista tiene que mostrarlo.
  useFocusEffect(
    useCallback(() => {
      cargar(items.length === 0);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cargar])
  );

  const q = busqueda.trim().toLowerCase();
  const visibles = q
    ? items.filter((t) => t.nombre.toLowerCase().includes(q))
    : items;

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.contenedor}>
      <FlatList
        data={visibles}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.lista}
        refreshControl={
          <RefreshControl refreshing={refrescando} onRefresh={() => cargar()} />
        }
        ListHeaderComponent={
          <>
            <Searchbar
              placeholder="Buscar tarea"
              value={busqueda}
              onChangeText={setBusqueda}
              elevation={0}
              style={styles.buscador}
              inputStyle={styles.buscadorTexto}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </>
        }
        ListEmptyComponent={
          <View style={styles.vacio}>
            <Text variant="titleMedium" style={styles.vacioTitulo}>
              {q ? "Sin coincidencias" : "No hay tareas"}
            </Text>
            <Text variant="bodyMedium" style={styles.vacioTexto}>
              {q
                ? "Probá con otro nombre."
                : "Agregá la primera con el botón de abajo."}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <PressableScale
            onPress={() => router.push(`/(personal)/tareas/${item.id}`)}
            style={styles.fila}
          >
            <View style={styles.filaTexto}>
              <Text variant="bodyLarge" style={styles.nombre}>
                {item.nombre}
              </Text>
              {item.descripcion ? (
                <Text
                  variant="bodySmall"
                  style={styles.descripcion}
                  numberOfLines={1}
                >
                  {item.descripcion}
                </Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={tema.texto3} />
          </PressableScale>
        )}
      />

      <FAB
        icon="plus"
        style={styles.fab}
        color="#fff"
        onPress={() => router.push("/(personal)/tareas/nueva")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: tema.fondo },
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  lista: { padding: 16, paddingBottom: 96 },
  buscador: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 12,
  },
  buscadorTexto: { fontSize: 15 },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 8,
  },
  filaTexto: { flex: 1, gap: 2 },
  nombre: { color: tema.texto, fontWeight: "500" },
  descripcion: { color: tema.texto3 },
  vacio: { alignItems: "center", paddingVertical: 48, gap: 6 },
  vacioTitulo: { color: tema.texto },
  vacioTexto: { color: tema.texto3, textAlign: "center" },
  error: { color: tema.rojo, marginBottom: 12, textAlign: "center" },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
    backgroundColor: tema.verde,
    borderRadius: 16,
  },
});
