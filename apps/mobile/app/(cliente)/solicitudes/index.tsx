import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { useFocusEffect, useRouter } from "expo-router";
import type { SolicitudItem } from "@vivero/shared";
import { fechaYHora12 } from "@/lib/hora";
import { apiRequest } from "@/lib/api";
import { EncabezadoDeFicha } from "@/components/ui/EncabezadoDeFicha";
import { MenuDeEncabezado } from "@/components/ui/MenuDeEncabezado";
import { tema } from "@/lib/tema";

/**
 * Lo que el cliente le pidió al vivero, con si ya lo atendieron. Es la
 * respuesta a "¿me vieron el pedido?" sin tener que llamar.
 */
export default function MisSolicitudesScreen() {
  const router = useRouter();
  const [items, setItems] = useState<SolicitudItem[] | null>(null);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const res = await apiRequest<{ items: SolicitudItem[] }>("/api/mobile/solicitudes");
      setItems(res.items);
    } catch {
      setItems((prev) => prev ?? []);
    } finally {
      setRefrescando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  return (
    <View style={styles.pantalla}>
      <EncabezadoDeFicha
        titulo="Mis solicitudes"
        derecha={
          <MenuDeEncabezado
            opciones={[
              {
                etiqueta: "Nueva solicitud",
                onPress: () => router.push("/(cliente)/solicitudes/nueva"),
              },
            ]}
          />
        }
      />
      {items === null ? (
        <View style={styles.centro}>
          <ActivityIndicator color={tema.verde} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.lista}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={() => {
                setRefrescando(true);
                cargar();
              }}
            />
          }
          ListEmptyComponent={
            <View style={styles.vacio}>
              <Text style={styles.vacioTexto}>
                Todavía no nos has pedido nada.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.fila}>
              <View style={styles.filaArriba}>
                <Text style={styles.titulo} numberOfLines={1}>
                  {item.producto ? `Cotización · ${item.producto.nombre}` : "Solicitud"}
                </Text>
                <View
                  style={[styles.pastilla, item.atendidaEl ? styles.atendida : styles.pendiente]}
                >
                  <Text
                    style={[
                      styles.pastillaTexto,
                      { color: item.atendidaEl ? tema.verde700 : "#8a5a00" },
                    ]}
                  >
                    {item.atendidaEl ? "Atendida" : "Pendiente"}
                  </Text>
                </View>
              </View>
              <Text style={styles.mensaje} numberOfLines={3}>
                {item.mensaje}
              </Text>
              <Text style={styles.fecha}>{fechaYHora12(item.createdAt)}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: "#fff" },
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  lista: { padding: 12, gap: 8, paddingBottom: 32 },
  fila: { backgroundColor: tema.fondo, borderRadius: 12, padding: 14, gap: 6 },
  filaArriba: { flexDirection: "row", alignItems: "center", gap: 8 },
  titulo: { flex: 1, color: tema.texto, fontWeight: "600" },
  pastilla: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  pendiente: { backgroundColor: "#fff3d6" },
  atendida: { backgroundColor: tema.verde50 },
  pastillaTexto: { fontSize: 12, fontWeight: "600" },
  mensaje: { color: tema.texto2 },
  fecha: { color: tema.texto3, fontSize: 12 },
  vacio: { alignItems: "center", paddingTop: 80 },
  vacioTexto: { color: tema.texto3 },
});
