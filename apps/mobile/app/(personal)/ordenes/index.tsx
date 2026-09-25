import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
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
import {
  FILA_LISTA,
  PantallaLista,
  PieDeLista,
  type GrupoDeFiltro,
} from "@/components/ui/PantallaLista";
import type { OrdenListItem } from "@/lib/types";
import { tema } from "@/lib/tema";

/** El color de cada estado de cobro. El rojo se reserva para la anulada. */
const COLOR_COBRO: Record<EstadoCobro, { texto: string; fondo: string }> = {
  COBRADO: { texto: tema.verde700, fondo: tema.verde50 },
  PARCIAL: { texto: tema.ambarTexto, fondo: tema.ambar50 },
  SIN_COBRAR: { texto: tema.cielo, fondo: tema.cielo50 },
  SIN_SINCRONIZAR: { texto: tema.texto2, fondo: tema.linea2 },
};

const POR_PAGINA = 25;

const plata = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/**
 * Las órdenes: se consultan, se arman (⋯ → *Nueva orden*), y desde la ficha
 * se emite la factura y se registra el cobro. Lo mismo que el portal en el
 * teléfono.
 */
export default function OrdenesListScreen() {
  const router = useRouter();
  const [items, setItems] = useState<OrdenListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [busqueda, setBusqueda] = useState("");
  const [cobro, setCobro] = useState("");
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * De a páginas, con `offset`: la lista crece con el negocio y traerla entera
   * es una espera que empeora sola.
   */
  const traer = useCallback(
    async (
      desde: number,
      modo: "inicial" | "mas" | "refrescar",
      filtros: { q: string; cobro: string }
    ) => {
      if (modo === "inicial") setCargando(true);
      if (modo === "mas") setCargandoMas(true);
      if (modo === "refrescar") setRefrescando(true);
      try {
        const res = await apiRequest<{ items: OrdenListItem[]; total: number }>(
          "/api/mobile/ordenes",
          {
            query: {
              limit: POR_PAGINA,
              offset: desde,
              q: filtros.q.trim() || undefined,
              cobro: filtros.cobro || undefined,
            },
          }
        );
        setItems((antes) => (desde ? [...antes, ...res.items] : res.items));
        setTotal(res.total);
        setError(null);
      } catch (e) {
        setError(mensajeDeError(e, "No pudimos cargar las órdenes"));
      } finally {
        setCargando(false);
        setCargandoMas(false);
        setRefrescando(false);
      }
    },
    []
  );
  const cargar = useCallback(
    (inicial = false) =>
      traer(0, inicial ? "inicial" : "refrescar", { q: busqueda, cobro }),
    [traer, busqueda, cobro]
  );

  /*
   * Al cambiar la búsqueda o el filtro se pide de nuevo desde cero, con ~300 ms
   * de respiro: una consulta por tecla es ruido y las respuestas llegan
   * desordenadas.
   */
  useEffect(() => {
    const reloj = setTimeout(() => cargar(), 300);
    return () => clearTimeout(reloj);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda, cobro]);

  useFocusEffect(
    useCallback(() => {
      cargar(items.length === 0);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cargar])
  );

  // Lo que llega ya viene filtrado por el servidor.
  const visibles = items;

  const grupos: GrupoDeFiltro[] = [
    {
      id: "cobro",
      titulo: "Cobro",
      valor: cobro,
      onElegir: setCobro,
      opciones: [
        { clave: "", etiqueta: "Todas" },
        { clave: "SIN_COBRAR", etiqueta: "Sin cobrar" },
        { clave: "PARCIAL", etiqueta: "Parciales" },
        { clave: "COBRADO", etiqueta: "Cobradas" },
        { clave: "ANULADA", etiqueta: "Anuladas" },
      ],
    },
  ];

  return (
    <PantallaLista
      titulo="Órdenes"
      busqueda={busqueda}
      onBuscar={setBusqueda}
      placeholder="Buscar por cliente o número..."
      grupos={grupos}
      acciones={[
        {
          etiqueta: "Nueva orden",
          onPress: () => router.push("/(personal)/ordenes/nueva"),
        },
      ]}
    >
      {cargando ? (
        <View style={styles.centro}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={visibles}
          keyExtractor={(o) => o.id}
          refreshControl={
            <RefreshControl refreshing={refrescando} onRefresh={() => cargar()} />
          }
          ListHeaderComponent={
            error ? <Text style={styles.error}>{error}</Text> : null
          }
          ListEmptyComponent={
            <View style={styles.vacio}>
              <Text variant="titleMedium" style={styles.vacioTitulo}>
                {busqueda || cobro ? "Sin coincidencias" : "No hay órdenes"}
              </Text>
              <Text variant="bodyMedium" style={styles.vacioTexto}>
                Crea la primera desde el menú de arriba.
              </Text>
            </View>
          }
          ListFooterComponent={
            <PieDeLista cargando={cargandoMas} hayMas={items.length < total} />
          }
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (items.length < total && !cargandoMas)
              traer(items.length, "mas", { q: busqueda, cobro });
          }}
          renderItem={({ item }) => {
            const anulada = item.estado === "ANULADA";
            const estado = estadoCobro(item.total, item.saldo);
            const color = COLOR_COBRO[estado];
            const donde = resumenDePropiedades(item.propiedades);
            return (
              <PressableScale
                onPress={() => router.push(`/(personal)/ordenes/${item.id}`)}
                style={FILA_LISTA}
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
                  <Text variant="bodyLarge" style={styles.cliente} numberOfLines={1}>
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
                      {anulada ? "Anulada" : cobroLabel[estado]}
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
      )}
    </PantallaLista>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
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
  error: { color: tema.rojo, textAlign: "center", padding: 16 },
});
