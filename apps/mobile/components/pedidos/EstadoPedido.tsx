import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { ETIQUETA_ESTADO_PEDIDO, type PedidoDelCliente } from "@vivero/shared";
import { tema } from "@/lib/tema";

/** La pastilla del estado de un pedido: *Recibido*, *Confirmado* o *Anulado*. */
export function EstadoPedido({
  estado,
}: {
  estado: PedidoDelCliente["estado"];
}) {
  const estilo =
    estado === "CONFIRMADA"
      ? styles.confirmado
      : estado === "ANULADA"
        ? styles.anulado
        : styles.recibido;
  const color =
    estado === "CONFIRMADA"
      ? tema.verde700
      : estado === "ANULADA"
        ? tema.texto3
        : "#8a5a00";
  return (
    <View style={[styles.pastilla, estilo]}>
      <Text style={[styles.pastillaTexto, { color }]}>
        {ETIQUETA_ESTADO_PEDIDO[estado]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pastilla: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  recibido: { backgroundColor: "#fff3d6" },
  confirmado: { backgroundColor: tema.verde50 },
  anulado: { backgroundColor: tema.lienzo },
  pastillaTexto: { fontSize: 12, fontWeight: "600" },
});
