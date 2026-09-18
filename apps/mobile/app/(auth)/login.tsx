import { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, HelperText, Text, TextInput } from "react-native-paper";
import { useRouter } from "expo-router";
import type { AuthSuccessResponse } from "@vivero/shared";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useBranding } from "@/lib/branding";
import { registerForPushNotifications } from "@/lib/push";

export default function LoginScreen() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const branding = useBranding();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function login() {
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<AuthSuccessResponse>(
        "/api/mobile/auth/login",
        {
          method: "POST",
          body: { email, password },
          authenticated: false,
        }
      );
      await setSession(res, res.user);
      registerForPushNotifications().catch(() => {});
      // Oficina y jardineros van al mismo lugar: la lista de visitas. Lo que
      // cambia es qué ven —el jardinero, solo las suyas— y eso lo decide el
      // servidor, no esta pantalla.
      router.replace(
        res.user.role === "CLIENTE"
          ? "/(cliente)/visitas"
          : "/(personal)/visitas"
      );
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos iniciar sesión"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <View style={styles.content}>
          {branding.logoUrl ? (
            <Image
              source={{ uri: branding.logoUrl }}
              style={styles.logo}
              resizeMode="contain"
            />
          ) : (
            <Text variant="headlineMedium" style={styles.title}>
              {branding.nombre ?? "Vivero Francisco"}
            </Text>
          )}
          <Text variant="bodyLarge" style={styles.subtitle}>
            Inicia sesión con tu usuario, tu correo o tu teléfono
          </Text>

          {/* Un solo campo para los cuatro roles. La oficina entra con su
              correo, quien trabaja en el jardín con el usuario que le dictaron
              —no tiene correo— y el cliente con su teléfono. Quién es cada uno
              lo resuelve el servidor, que es el único que puede: preguntárselo
              a la persona es hacerle una pregunta nuestra. */}
          <TextInput
            mode="outlined"
            label="Usuario, correo o teléfono"
            placeholder="jperez, tu@correo.com o 0991234567"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            style={styles.input}
          />
          <TextInput
            mode="outlined"
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
          />

          <Button
            mode="contained"
            onPress={login}
            loading={loading}
            disabled={loading || !email || !password}
            style={styles.button}
          >
            Iniciar sesión
          </Button>

          {/* El enlace de un solo uso es del cliente: se le manda a su correo
              o a su WhatsApp. Para el equipo no hay autoservicio y la pantalla
              lo dice ahí, que es donde alguien lo va a leer. */}
          <Button
            mode="text"
            onPress={() => router.push("/(auth)/solicitar-acceso")}
            disabled={loading}
          >
            ¿Primera vez o olvidaste tu contraseña?
          </Button>

          {error ? (
            <HelperText type="error" visible style={styles.error}>
              {error}
            </HelperText>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  flex: { flex: 1 },
  content: { flex: 1, padding: 24, justifyContent: "center" },
  title: { textAlign: "center", marginBottom: 8 },
  logo: { alignSelf: "center", height: 80, width: 220, marginBottom: 16 },
  subtitle: { textAlign: "center", marginBottom: 32, color: "#555" },
  input: { marginBottom: 16 },
  button: { marginBottom: 8 },
  error: { textAlign: "center" },
  footer: { padding: 24 },
});
