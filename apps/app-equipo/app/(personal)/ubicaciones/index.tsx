import { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { direccionDeUbicacion, type Ubicacion } from "@vivero/shared";
import { apiRequest, mensajeDeError } from "@vivero/app-ui/lib/api";
import { PressableScale } from "@vivero/app-ui/components/ui/PressableScale";
import { FILA_LISTA, PantallaLista } from "@vivero/app-ui/components/ui/PantallaLista";
import { tema } from "@vivero/app-ui/lib/tema";

/**
 * Las ubicaciones del vivero, la *Locations* de Shopify y la misma pantalla
 * que *Configuración → Ubicaciones* del portal: cada local con su dirección,
 * si está activo y si el cliente puede retirar ahí. Solo el ADMIN.
 */
export default function UbicacionesScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Ubicacion[]>([]);
  const [estado, setEstado] = useState("");
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (filtro: string, inicial = false) => {
    if (inicial) setCargando(true);
    else setRefrescando(true);
    try {
      setItems(
        await apiRequest<Ubicacion[]>("/api/mobile/ubicaciones", {
          query: { estado: filtro || undefined },
        })
      );
      setError(null);
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos cargar las ubicaciones"));
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar(estado, items.length === 0);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cargar, estado])
  );

  return (
    <PantallaLista
      titulo="Ubicaciones"
      acciones={[
        { etiqueta: "Nueva ubicación", onPress: () => router.push("/(personal)/ubicaciones/nueva") },
      ]}
      grupos={[
        {
          id: "estado",
          titulo: "Estado",
          valor: estado,
          onElegir: setEstado,
          opciones: [
            { clave: "", etiqueta: "Todas" },
            { clave: "activas", etiqueta: "Activas" },
            { clave: "inactivas", etiqueta: "Inactivas" },
          ],
        },
      ]}
    >
      {cargando ? (
        <View style={styles.centro}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(u) => u.id}
          refreshControl={
            <RefreshControl refreshing={refrescando} onRefresh={() => cargar(estado)} />
          }
          ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
          ListEmptyComponent={
            <View style={styles.vacio}>
              <Text variant="titleMedium" style={styles.vacioTitulo}>
                {estado ? "Ninguna ubicación con ese estado" : "Todavía no hay ubicaciones"}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <PressableScale
              onPress={() => router.push(`/(personal)/ubicaciones/${item.id}`)}
              estiloExterno={styles.ancho}
              style={FILA_LISTA}
            >
              <View style={styles.filaTexto}>
                <Text variant="bodyLarge" style={styles.nombre} numberOfLines={1}>
                  {item.nombre}
                </Text>
                <Text variant="bodySmall" style={styles.detalle} numberOfLines={1}>
                  {direccionDeUbicacion(item) ?? "Sin dirección"}
                </Text>
                <View style={styles.pastillas}>
                  {item.activa ? (
                    <Pastilla texto="Activa" fondo={tema.verde50} color={tema.verde700} />
                  ) : (
                    <Pastilla texto="Inactiva" fondo={tema.linea2} color={tema.texto3} />
                  )}
                  {item.retiro ? (
                    <Pastilla texto="Retiro" fondo={tema.cielo50} color={tema.cielo} />
                  ) : null}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={tema.texto3} />
            </PressableScale>
          )}
        />
      )}
    </PantallaLista>
  );
}

function Pastilla({ texto, fondo, color }: { texto: string; fondo: string; color: string }) {
  return (
    <View style={[styles.pastilla, { backgroundColor: fondo }]}>
      <Text style={[styles.pastillaTexto, { color }]}>{texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  ancho: { alignSelf: "stretch" },
  filaTexto: { flex: 1, gap: 4 },
  nombre: { color: tema.texto, fontWeight: "700" },
  detalle: { color: tema.texto3 },
  pastillas: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pastilla: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  pastillaTexto: { fontSize: 11, fontWeight: "700" },
  vacio: { alignItems: "center", paddingVertical: 48 },
  vacioTitulo: { color: tema.texto },
  error: { color: tema.rojo, textAlign: "center", padding: 16 },
});
