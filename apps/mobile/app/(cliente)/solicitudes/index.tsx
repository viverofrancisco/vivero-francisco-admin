import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { Button, Text } from "react-native-paper";
import { useFocusEffect, useRouter } from "expo-router";
import { type PedidoDelCliente } from "@vivero/shared";
import { fechaYHora12 } from "@/lib/hora";
import { apiRequest } from "@/lib/api";
import { PantallaLista } from "@/components/ui/PantallaLista";
import { EstadoPedido } from "@/components/pedidos/EstadoPedido";
import { tema } from "@/lib/tema";

const dinero = (n: number) => `$${n.toFixed(2)}`;

/**
 * **Pedidos**: sus compras del carrito, de la más nueva a la más vieja, con
 * su estado. Es la respuesta a "¿me vieron el pedido?" sin tener que llamar.
 * Las solicitudes de visita —con los servicios que marcó— viven en *Visitas*.
 */
export default function MisPedidosScreen() {
  const router = useRouter();
  const [items, setItems] = useState<PedidoDelCliente[] | null>(null);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const { items: pedidos } = await apiRequest<{ items: PedidoDelCliente[] }>(
        "/api/mobile/pedidos"
      );
      setItems(pedidos);
    } catch {
      setItems((prev) => prev ?? []);
    } finally {
      setRefrescando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  return (
    // La raíz de una pestaña, como Mis visitas: título grande y el ⋯, sin
    // flecha para volver (no hay a dónde).
    <PantallaLista
      titulo="Mis pedidos"
      // Lo que lleva a un pedido es el catálogo. Solicitar una visita no crea
      // un pedido —es una solicitud que el equipo atiende—: vive en Visitas, y
      // la cotización en la ficha de cada servicio.
      acciones={[{ etiqueta: "Ver catálogo", onPress: () => router.navigate("/(cliente)/catalogo") }]}
    >
      {items === null ? (
        <View style={styles.centro}>
          <ActivityIndicator color={tema.verde} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
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
              <Text style={styles.vacioTitulo}>Todavía no tienes pedidos</Text>
              <Text style={styles.vacioTexto}>
                Elige plantas, macetas y más en el catálogo, y tus pedidos aparecen aquí.
              </Text>
              <Button
                mode="contained"
                onPress={() => router.navigate("/(cliente)/catalogo")}
                style={styles.vacioBoton}
              >
                Ver catálogo
              </Button>
            </View>
          }
          renderItem={({ item: p }) => (
            <FilaPedido
              pedido={p}
              onAbrir={() => router.push(`/(cliente)/solicitudes/pedido/${p.id}`)}
            />
          )}
        />
      )}
    </PantallaLista>
  );
}

function FilaPedido({
  pedido,
  onAbrir,
}: {
  pedido: PedidoDelCliente;
  onAbrir: () => void;
}) {
  const unidades = pedido.lineas.reduce((n, l) => n + l.cantidad, 0);
  return (
    <Pressable
      onPress={onAbrir}
      style={({ pressed }) => [styles.fila, pressed && styles.tocada]}
    >
      <View style={styles.filaArriba}>
        <Text style={styles.titulo} numberOfLines={1}>
          Pedido #{pedido.numero}
        </Text>
        <EstadoPedido estado={pedido.estado} />
      </View>
      <Text style={styles.mensaje} numberOfLines={2}>
        {pedido.lineas.map((l) => l.descripcion).join(", ")}
      </Text>
      <Text style={styles.mensaje}>
        {unidades === 1 ? "1 producto" : `${unidades} productos`} ·{" "}
        {dinero(pedido.total)}
        {pedido.porCotizar ? " + por cotizar" : ""}
      </Text>
      <Text style={styles.fecha}>
        {pedido.entrega} · {fechaYHora12(pedido.createdAt)}
      </Text>
    </Pressable>
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
  anulada: { backgroundColor: tema.lienzo },
  tocada: { opacity: 0.7 },
  pastillaTexto: { fontSize: 12, fontWeight: "600" },
  mensaje: { color: tema.texto2 },
  fecha: { color: tema.texto3, fontSize: 12 },
  vacio: { alignItems: "center", paddingTop: 80, paddingHorizontal: 24, gap: 8 },
  vacioTitulo: { color: tema.texto, fontSize: 16, fontWeight: "600" },
  vacioTexto: { color: tema.texto3, textAlign: "center" },
  vacioBoton: { marginTop: 8, borderRadius: 12 },
});
