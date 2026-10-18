import { StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";
import { useRouter } from "expo-router";
import { PantallaLista } from "@vivero/app-ui/components/ui/PantallaLista";

/**
 * *Cuenta* para el invitado: lo que gana creándola y las dos puertas —crearla
 * o entrar con la que ya tiene—, las mismas rutas que el login y la pastilla
 * *Iniciar sesión* del catálogo.
 */
export default function CuentaInvitadoScreen() {
  const router = useRouter();
  return (
    <PantallaLista titulo="Cuenta">
      <View style={styles.cuerpo}>
        <Text variant="bodyMedium" style={styles.texto}>
          Con tu cuenta puedes comprar desde la app y seguir tus visitas y tus
          solicitudes.
        </Text>
        <Button
          mode="contained"
          onPress={() => router.push("/(auth)/registro")}
          style={styles.boton}
        >
          Crear cuenta
        </Button>
        <Button
          mode="outlined"
          onPress={() => router.replace("/(auth)/login")}
          style={styles.boton}
        >
          Iniciar sesión
        </Button>
      </View>
    </PantallaLista>
  );
}

const styles = StyleSheet.create({
  cuerpo: { padding: 16, gap: 12 },
  texto: { color: "#555", marginBottom: 4 },
  boton: { borderRadius: 12 },
});
