import { StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";
import { useRouter } from "expo-router";
import { PantallaLista } from "@vivero/app-ui/components/ui/PantallaLista";

/**
 * *Visitas* para el invitado: sin cuenta no hay visitas que listar —ni
 * solicitudes, que se guardan sin a quién mostrárselas—, así que es la
 * puerta para pedir una. La misma cabecera que *Mis visitas* del cliente,
 * con *Solicitar una visita* en el ⋯ y en el centro.
 */
export default function VisitasInvitadoScreen() {
  const router = useRouter();
  const solicitar = () => router.push("/(invitado)/solicitar");
  return (
    <PantallaLista
      titulo="Visitas"
      acciones={[{ etiqueta: "Solicitar una visita", onPress: solicitar }]}
    >
      <View style={styles.vacio}>
        <Text variant="titleMedium" style={styles.titulo}>
          Pide una visita, sin crear una cuenta
        </Text>
        <Text variant="bodyMedium" style={styles.cuerpo}>
          Cuéntanos qué necesita tu jardín y un asesor te contactará para
          coordinar.
        </Text>
        <Button mode="contained" onPress={solicitar} style={styles.boton}>
          Solicitar una visita
        </Button>
      </View>
    </PantallaLista>
  );
}

const styles = StyleSheet.create({
  vacio: { paddingVertical: 80, alignItems: "center", gap: 8 },
  titulo: { color: "#444", textAlign: "center", paddingHorizontal: 24 },
  cuerpo: { color: "#888", textAlign: "center", paddingHorizontal: 24 },
  boton: { marginTop: 12, borderRadius: 12 },
});
