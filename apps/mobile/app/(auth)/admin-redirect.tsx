import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Text } from "react-native-paper";
import { useAuthStore } from "@/lib/auth-store";
import { apiRequest } from "@/lib/api";

export default function AdminRedirectScreen() {
  const clear = useAuthStore((s) => s.clear);
  const refreshToken = useAuthStore((s) => s.refreshToken);

  async function logout() {
    if (refreshToken) {
      apiRequest("/api/mobile/auth/logout", {
        method: "POST",
        body: { refreshToken },
        authenticated: false,
      }).catch(() => {});
    }
    await clear();
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text variant="headlineSmall" style={styles.title}>
          Esta cuenta usa el portal web
        </Text>
        <Text variant="bodyMedium" style={styles.body}>
          Las cuentas de administrador y staff usan el portal web. Cierra sesión
          para entrar como cliente o como personal de campo.
        </Text>
        <Button mode="contained" onPress={logout} style={styles.button}>
          Cerrar sesión
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { flex: 1, padding: 24, justifyContent: "center" },
  title: { textAlign: "center", marginBottom: 16 },
  body: { textAlign: "center", color: "#555", marginBottom: 32 },
  button: { alignSelf: "center" },
});
