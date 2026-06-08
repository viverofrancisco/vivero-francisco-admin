import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, HelperText, Text, TextInput } from "react-native-paper";
import { useRouter } from "expo-router";
import { apiRequest, ApiError } from "@/lib/api";

interface RequestInviteResponse {
  ok: true;
  message: string;
}

export default function SolicitarAccesoScreen() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function requestInvite() {
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<RequestInviteResponse>(
        "/api/mobile/auth/cliente/request-invite",
        {
          method: "POST",
          body: { identifier: identifier.trim() },
          authenticated: false,
        }
      );
      setMessage(res.message);
      setSent(true);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "No pudimos enviar el enlace"
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
          <Text variant="headlineSmall" style={styles.title}>
            Crear o recuperar contraseña
          </Text>

          {sent ? (
            <>
              <Text variant="bodyLarge" style={styles.subtitle}>
                {message ??
                  "Si tu cuenta existe, te enviamos un enlace por correo o WhatsApp para crear tu contraseña."}
              </Text>
              <Button
                mode="contained"
                onPress={() => router.back()}
                style={styles.button}
              >
                Volver a iniciar sesión
              </Button>
            </>
          ) : (
            <>
              <Text variant="bodyLarge" style={styles.subtitle}>
                Ingresa tu teléfono o correo y te enviaremos un enlace para
                crear tu contraseña.
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
              <Button
                mode="contained"
                onPress={requestInvite}
                loading={loading}
                disabled={loading || identifier.trim().length < 5}
                style={styles.button}
              >
                Enviar enlace
              </Button>
              <Button mode="text" onPress={() => router.back()} disabled={loading}>
                Cancelar
              </Button>

              {error ? (
                <HelperText type="error" visible style={styles.error}>
                  {error}
                </HelperText>
              ) : null}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  flex: { flex: 1 },
  content: { flex: 1, padding: 24, justifyContent: "center" },
  title: { textAlign: "center", marginBottom: 12 },
  subtitle: { textAlign: "center", marginBottom: 32, color: "#555" },
  input: { marginBottom: 16 },
  button: { marginBottom: 8 },
  error: { textAlign: "center" },
});
