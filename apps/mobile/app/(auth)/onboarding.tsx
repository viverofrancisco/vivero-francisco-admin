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

export default function OnboardingScreen() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const branding = useBranding();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function login() {
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<AuthSuccessResponse>(
        "/api/mobile/auth/cliente/login",
        {
          method: "POST",
          body: { identifier: identifier.trim(), password },
          authenticated: false,
        }
      );
      await setSession(res, res.user);
      registerForPushNotifications().catch(() => {});
      router.replace("/(cliente)/visitas");
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "No pudimos iniciar sesión"
      );
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
            Inicia sesión con tu teléfono o correo
          </Text>

          <TextInput
            mode="outlined"
            label="Teléfono o correo"
            placeholder="0991234567 o tu@correo.com"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
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
            disabled={loading || identifier.trim().length < 5 || !password}
            style={styles.button}
          >
            Iniciar sesión
          </Button>

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

        <View style={styles.footer}>
          <Button mode="text" onPress={() => router.push("/(auth)/login")}>
            ¿Eres del equipo? Inicia sesión
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
