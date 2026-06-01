import { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, HelperText, Text, TextInput } from "react-native-paper";
import { useRouter } from "expo-router";
import type {
  AuthSuccessResponse,
  OtpRequestResponse,
} from "@vivero/shared";
import { apiRequest, ApiError } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useBranding } from "@/lib/branding";
import { registerForPushNotifications } from "@/lib/push";

type Stage = "phone" | "code";

export default function OnboardingScreen() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const branding = useBranding();
  const [stage, setStage] = useState<Stage>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestCode() {
    setError(null);
    setLoading(true);
    try {
      await apiRequest<OtpRequestResponse>("/api/mobile/auth/otp/request", {
        method: "POST",
        body: { phone },
        authenticated: false,
      });
      setStage("code");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error al solicitar código");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<AuthSuccessResponse>(
        "/api/mobile/auth/otp/verify",
        {
          method: "POST",
          body: { phone, code },
          authenticated: false,
        }
      );
      await setSession(res, res.user);
      registerForPushNotifications().catch(() => {});
      router.replace("/(cliente)/visitas");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Código incorrecto");
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
            {stage === "phone"
              ? "Ingresa tu número de WhatsApp para recibir un código"
              : `Te enviamos un código a ${phone}`}
          </Text>

          {stage === "phone" ? (
            <>
              <TextInput
                mode="outlined"
                label="Teléfono"
                placeholder="809 123 4567"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoComplete="tel"
                style={styles.input}
              />
              <Button
                mode="contained"
                onPress={requestCode}
                loading={loading}
                disabled={loading || phone.length < 7}
                style={styles.button}
              >
                Enviar código
              </Button>
            </>
          ) : (
            <>
              <TextInput
                mode="outlined"
                label="Código"
                placeholder="6 dígitos"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                style={styles.input}
              />
              <Button
                mode="contained"
                onPress={verifyCode}
                loading={loading}
                disabled={loading || code.length !== 6}
                style={styles.button}
              >
                Verificar
              </Button>
              <Button
                mode="text"
                onPress={() => {
                  setCode("");
                  setStage("phone");
                  setError(null);
                }}
                disabled={loading}
              >
                Cambiar número
              </Button>
            </>
          )}

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
