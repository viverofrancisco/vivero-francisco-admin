import { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { ActivityIndicator, Searchbar, Text } from "react-native-paper";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  cobroLabel,
  estadoCobro,
  fechaSola,
  resumenDePropiedades,
  type EstadoCobro,
} from "@vivero/shared";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { PressableScale } from "@/components/ui/PressableScale";
import type { OrdenListItem } from "@/lib/types";
import { tema } from "@/lib/tema";

/** El color de cada estado de cobro. El rojo se reserva para la anulada. */
const COLOR_COBRO: Record<EstadoCobro, { texto: string; fondo: string }> = {
  COBRADO: { texto: tema.verde700, fondo: tema.verde50 },
  PARCIAL: { texto: tema.ambarTexto, fondo: tema.ambar50 },
  SIN_COBRAR: { texto: tema.cielo, fondo: tema.cielo50 },
  SIN_SINCRONIZAR: { texto: tema.texto2, fondo: tema.linea2 },
};

const plata = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/**
 * Las órdenes, para mirar.
 *
 * Desde el teléfono se consulta —"¿este cliente debe algo?", "¿qué se le
 * cobró?"—; armar una orden y emitir una factura se siguen haciendo en el
 * portal, que es donde están el catálogo, los precios y el emisor.
 */
export default function OrdenesListScreen() {
  const router = useRouter();
  const [items, setItems] = useState<OrdenListItem[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (inicial = false) => {
    if (inicial) setCargando(true);
    else setRefrescando(true);
    try {
      const res = await apiRequest<{ items: OrdenListItem[] }>(
        "/api/mobile/ordenes",
        { query: { limit: 100 } }
      );
      setItems(res.items);
      setError(null);
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos cargar las órdenes"));
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
    ? items.filter(
        (o) =>
          o.cliente.toLowerCase().includes(q) ||
          String(o.numero).includes(q.replace("#", ""))
      )
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
        keyExtractor={(o) => o.id}
        contentContainerStyle={styles.lista}
        refreshControl={
          <RefreshControl refreshing={refrescando} onRefresh={() => cargar()} />
        }
        ListHeaderComponent={
          <>
            <Searchbar
              placeholder="Buscar por cliente o número"
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
              {q ? "Sin coincidencias" : "No hay órdenes"}
            </Text>
            <Text variant="bodyMedium" style={styles.vacioTexto}>
              Las órdenes se arman en el portal.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const anulada = item.estado === "ANULADA";
          const cobro = estadoCobro(item.total, item.saldo);
          const color = COLOR_COBRO[cobro];
          const donde = resumenDePropiedades(item.propiedades);
          return (
            <PressableScale
              onPress={() => router.push(`/(personal)/ordenes/${item.id}`)}
              style={styles.fila}
            >
              <View style={styles.filaTexto}>
                <View style={styles.encabezado}>
                  <Text variant="bodySmall" style={styles.numero}>
                    #{item.numero}
                  </Text>
                  <Text variant="bodySmall" style={styles.fecha}>
                    {fechaSola(item.fecha, { day: "numeric", month: "short" })}
                  </Text>
                </View>
                <Text variant="bodyLarge" style={styles.cliente}>
                  {item.cliente}
                </Text>
                {donde ? (
                  <Text variant="bodySmall" style={styles.donde} numberOfLines={1}>
                    {donde}
                  </Text>
                ) : null}
                <View
                  style={[
                    styles.pastilla,
                    { backgroundColor: anulada ? tema.rojo50 : color.fondo },
                  ]}
                >
                  <Text
                    style={[
                      styles.pastillaTexto,
                      { color: anulada ? tema.rojo : color.texto },
                    ]}
                  >
                    {anulada ? "Anulada" : cobroLabel[cobro]}
                  </Text>
                </View>
              </View>
              <View style={styles.derecha}>
                <Text variant="bodyLarge" style={styles.total}>
                  {plata(item.total)}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={tema.texto3} />
              </View>
            </PressableScale>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: tema.fondo },
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  lista: { padding: 16, paddingBottom: 32 },
  buscador: { backgroundColor: "#fff", borderRadius: 12, marginBottom: 12 },
  buscadorTexto: { fontSize: 15 },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  filaTexto: { flex: 1, gap: 3 },
  encabezado: { flexDirection: "row", gap: 8 },
  numero: { color: tema.texto2, fontWeight: "700" },
  fecha: { color: tema.texto3 },
  cliente: { color: tema.texto, fontWeight: "500" },
  donde: { color: tema.texto3 },
  pastilla: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 2,
  },
  pastillaTexto: { fontSize: 11, fontWeight: "600" },
  derecha: { alignItems: "flex-end", gap: 4 },
  total: { color: tema.texto, fontWeight: "700" },
  vacio: { alignItems: "center", paddingVertical: 48, gap: 6 },
  vacioTitulo: { color: tema.texto },
  vacioTexto: { color: tema.texto3, textAlign: "center" },
  error: { color: tema.rojo, marginBottom: 12, textAlign: "center" },
});
