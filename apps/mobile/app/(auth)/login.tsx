import { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, HelperText, Text, TextInput } from "react-native-paper";
import { useRouter } from "expo-router";
import type { AuthSuccessResponse } from "@vivero/shared";
import { apiRequest, ApiError } from "@/lib/api";
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
      setError(e instanceof ApiError ? e.message : "No pudimos iniciar sesión");
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
            Inicia sesión con tu usuario o tu correo
          </Text>

          {/* Un solo campo para las dos cosas: la oficina entra con su correo y
              quien trabaja en el jardín con el usuario que le dictaron, porque
              no tiene correo. El servidor mira si hay arroba y busca por donde
              corresponde, así que no hay nada que elegir acá. */}
          <TextInput
            mode="outlined"
            label="Usuario o correo"
            placeholder="jperez o tu@correo.com"
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

          {error ? (
            <HelperText type="error" visible style={styles.error}>
              {error}
            </HelperText>
          ) : null}
        </View>

        <View style={styles.footer}>
          <Button mode="text" onPress={() => router.back()}>
            ¿Eres cliente? Volver
          </Button>
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
