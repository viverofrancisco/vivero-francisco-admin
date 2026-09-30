import { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { PressableScale } from "@/components/ui/PressableScale";
import { FILA_LISTA, PantallaLista } from "@/components/ui/PantallaLista";
import { PastillasDeEmisor } from "@/components/facturacion/PastillasDeEmisor";
import type { EmisorConfig } from "@/lib/types";
import { tema } from "@/lib/tema";

/**
 * Con qué RUC factura el portal ante el SRI: la pantalla *Facturación
 * electrónica* del portal, en la app. Solo el ADMIN. Cada fila abre la ficha
 * del emisor, donde se edita, se carga la firma y se emite una prueba.
 */
export default function FacturacionScreen() {
  const router = useRouter();
  const [items, setItems] = useState<EmisorConfig[]>([]);
  const [cifradoListo, setCifradoListo] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (inicial = false) => {
    if (inicial) setCargando(true);
    else setRefrescando(true);
    try {
      const r = await apiRequest<{ items: EmisorConfig[]; cifradoListo: boolean }>(
        "/api/mobile/configuracion/emisores"
      );
      setItems(r.items);
      setCifradoListo(r.cifradoListo);
      setError(null);
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos cargar los emisores"));
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

  return (
    <PantallaLista
      titulo="Facturación electrónica"
      acciones={[
        { etiqueta: "Nuevo emisor", onPress: () => router.push("/(personal)/facturacion/editar/nuevo") },
      ]}
    >
      {cargando ? (
        <View style={styles.centro}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(e) => e.id}
          refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => cargar()} />}
          ListHeaderComponent={
            <>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {!cifradoListo ? (
                <Text style={styles.aviso}>
                  Falta configurar FIRMA_ENCRYPTION_KEY en el servidor: sin ella no se puede
                  guardar ningún certificado, y por lo tanto no se puede emitir.
                </Text>
              ) : null}
            </>
          }
          ListEmptyComponent={
            <View style={styles.vacio}>
              <Text variant="titleMedium" style={styles.vacioTitulo}>
                Todavía no hay ningún emisor cargado
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <PressableScale
              onPress={() => router.push(`/(personal)/facturacion/${item.id}`)}
              estiloExterno={styles.ancho}
              style={FILA_LISTA}
            >
              <View style={styles.filaTexto}>
                <Text variant="bodyLarge" style={styles.nombre} numberOfLines={1}>
                  {item.razonSocial}
                </Text>
                <Text variant="bodySmall" style={styles.detalle} numberOfLines={1}>
                  {item.ruc} · Serie {item.establecimiento}-{item.puntoEmision}
                </Text>
                <PastillasDeEmisor emisor={item} />
              </View>
              <Ionicons name="chevron-forward" size={18} color={tema.texto3} />
            </PressableScale>
          )}
        />
      )}
    </PantallaLista>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  ancho: { alignSelf: "stretch" },
  filaTexto: { flex: 1, gap: 4 },
  nombre: { color: tema.texto, fontWeight: "700" },
  detalle: { color: tema.texto3 },
  vacio: { alignItems: "center", paddingVertical: 48 },
  vacioTitulo: { color: tema.texto },
  error: { color: tema.rojo, textAlign: "center", padding: 16 },
  aviso: {
    color: tema.ambarTexto,
    backgroundColor: tema.ambar50,
    borderRadius: 12,
    padding: 12,
    margin: 12,
    fontSize: 13,
  },
});
