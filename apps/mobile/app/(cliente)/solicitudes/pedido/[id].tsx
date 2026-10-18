import { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import type { PedidoDelCliente } from "@vivero/shared";
import { apiRequest } from "@/lib/api";
import { fechaYHora12 } from "@/lib/hora";
import { EncabezadoDeFicha } from "@/components/ui/EncabezadoDeFicha";
import { tema } from "@/lib/tema";
import { EstadoPedido } from "@/components/pedidos/EstadoPedido";

const dinero = (n: number) => `$${n.toFixed(2)}`;

/** Un pedido del carrito: qué pidió, cuánto, cómo lo recibe y en qué está. */
export default function PedidoDelClienteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [pedido, setPedido] = useState<PedidoDelCliente | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setPedido(await apiRequest<PedidoDelCliente>(`/api/mobile/pedidos/${id}`));
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setRefrescando(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void cargar();
    }, [cargar])
  );

  if (error && !pedido) {
    return (
      <View style={styles.pantalla}>
        <EncabezadoDeFicha titulo="Pedido" />
        <View style={styles.centro}>
          <Text style={styles.queSigue}>No pudimos cargar el pedido.</Text>
          <Button onPress={() => void cargar()}>Reintentar</Button>
        </View>
      </View>
    );
  }
  if (!pedido) {
    return (
      <View style={styles.pantalla}>
        <EncabezadoDeFicha titulo="" />
        <View style={styles.centro}>
          <ActivityIndicator color={tema.verde} />
        </View>
      </View>
    );
  }

  const queSigue =
    pedido.estado === "BORRADOR"
      ? pedido.porCotizar
        ? "El vivero va a cotizar lo que falta, confirmar tu pedido y coordinar contigo el pago."
        : "El vivero va a confirmar tu pedido y coordinar contigo el pago."
      : pedido.estado === "CONFIRMADA"
        ? "Tu pedido está confirmado. Te contactaremos para coordinar la entrega."
        : "Este pedido se anuló.";

  return (
    <View style={styles.pantalla}>
      <EncabezadoDeFicha titulo={`Pedido #${pedido.numero}`} />
      <ScrollView
        contentContainerStyle={styles.cuerpo}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={() => {
              setRefrescando(true);
              void cargar();
            }}
          />
        }
      >
        <View style={styles.cabecera}>
          <EstadoPedido estado={pedido.estado} />
          <Text style={styles.fecha}>{fechaYHora12(pedido.createdAt)}</Text>
        </View>
        <Text style={styles.queSigue}>{queSigue}</Text>

        <Text style={styles.rotulo}>PRODUCTOS</Text>
        <View style={styles.caja}>
          {pedido.lineas.map((l, i) => (
            <View key={i} style={[styles.linea, i > 0 && styles.divisor]}>
              <Text style={styles.lineaTexto}>
                {l.cantidad} × {l.descripcion}
              </Text>
              <Text style={[styles.lineaTotal, l.total === null && styles.porCotizar]}>
                {l.total === null ? "Por cotizar" : dinero(l.total)}
              </Text>
            </View>
          ))}
          <View style={[styles.linea, styles.divisor]}>
            <Text style={styles.totalTexto}>Total</Text>
            <Text style={styles.totalTexto}>{dinero(pedido.total)}</Text>
          </View>
        </View>

        <Text style={styles.rotulo}>ENTREGA</Text>
        <View style={styles.caja}>
          <View style={styles.linea}>
            <Text style={styles.lineaTexto}>{pedido.entrega}</Text>
          </View>
        </View>

        {pedido.notas ? (
          <>
            <Text style={styles.rotulo}>NOTAS</Text>
            <View style={styles.caja}>
              <View style={styles.linea}>
                <Text style={styles.lineaTexto}>{pedido.notas}</Text>
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: "#fff" },
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  cuerpo: { padding: 16, paddingBottom: 40, gap: 6 },
  cabecera: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  fecha: { color: tema.texto3, fontSize: 13 },
  queSigue: { color: tema.texto2, marginTop: 6, marginBottom: 8 },
  rotulo: { color: tema.texto3, fontSize: 11, letterSpacing: 0.8, paddingLeft: 4, marginTop: 12 },
  caja: { backgroundColor: tema.fondo, borderRadius: 12, paddingHorizontal: 14 },
  linea: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 12 },
  divisor: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tema.linea },
  lineaTexto: { color: tema.texto, flex: 1 },
  lineaTotal: { color: tema.texto, fontWeight: "600" },
  porCotizar: { color: "#8a5a00", fontWeight: "500" },
  totalTexto: { color: tema.texto, fontWeight: "700" },
});
