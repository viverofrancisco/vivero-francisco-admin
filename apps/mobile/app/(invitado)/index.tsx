import { StyleSheet } from "react-native";
import { Text } from "react-native-paper";
import { useRouter } from "expo-router";
import { ListaDelCatalogo } from "@/components/catalogo/ListaDelCatalogo";
import { PressableScale } from "@/components/ui/PressableScale";
import { tema } from "@/lib/tema";

export default function CatalogoInvitadoScreen() {
  const router = useRouter();
  return (
    <ListaDelCatalogo
      publico
      onAbrir={(id) => router.push(`/(invitado)/producto/${id}`)}
      acciones={[
        {
          etiqueta: "Solicitar una visita",
          onPress: () => router.push("/(invitado)/solicitar"),
        },
      ]}
      accion={
        <PressableScale
          onPress={() => router.replace("/(auth)/login")}
          style={styles.entrar}
          accessibilityLabel="Iniciar sesión"
        >
          <Text style={styles.entrarTexto}>Iniciar sesión</Text>
        </PressableScale>
      }
    />
  );
}

const styles = StyleSheet.create({
  entrar: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: tema.verde50,
    justifyContent: "center",
  },
  entrarTexto: { color: tema.verde700, fontSize: 13, fontWeight: "600" },
});
