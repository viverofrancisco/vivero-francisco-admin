import { useState } from "react";
import { KeyboardAvoidingView, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, HelperText, Text, TextInput } from "react-native-paper";
import { useRouter } from "expo-router";
import type { AuthSuccessResponse } from "@vivero/shared";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { registerForPushNotifications } from "@/lib/push";
import { prepararDatosPara } from "@/lib/datos-de-la-cuenta";
import { tema } from "@/lib/tema";

/**
 * Crear una cuenta de cliente, en dos pasos: los datos, y el código de seis
 * dígitos que llega al correo. Con el código correcto la sesión queda abierta
 * —pedirle que inicie sesión con lo que acaba de escribir no prueba nada—.
 *
 * Si el correo ya estaba en la ficha de un cliente del vivero, la cuenta se
 * vincula a esa ficha y entra viendo sus visitas: eso lo resuelve el servidor,
 * y por eso el código es obligatorio.
 */
export default function RegistroScreen() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [paso, setPaso] = useState<"datos" | "codigo">("datos");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [password, setPassword] = useState("");
  const [codigo, setCodigo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reenviado, setReenviado] = useState(false);

  const datosCompletos =
    nombre.trim().length > 0 && /\S+@\S+\.\S+/.test(email.trim()) && password.length >= 8;

  async function pedirCodigo(reenvio = false) {
    setError(null);
    setCargando(true);
    try {
      await apiRequest("/api/mobile/auth/registro", {
        method: "POST",
        authenticated: false,
        body: {
          nombre: nombre.trim(),
          apellido: apellido.trim() || undefined,
          email: email.trim(),
          telefono: telefono.trim() || undefined,
          password,
        },
      });
      setPaso("codigo");
      setReenviado(reenvio);
      if (reenvio) setCodigo("");
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos enviarte el código"));
    } finally {
      setCargando(false);
    }
  }

  async function confirmar() {
    setError(null);
    setCargando(true);
    try {
      const res = await apiRequest<AuthSuccessResponse>(
        "/api/mobile/auth/registro/confirmar",
        {
          method: "POST",
          authenticated: false,
          body: { email: email.trim(), codigo: codigo.trim() },
        }
      );
      await prepararDatosPara(res.user.id);
      await setSession(res, res.user);
      registerForPushNotifications().catch(() => {});
      router.replace("/(cliente)/visitas");
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos crear tu cuenta"));
    } finally {
      setCargando(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {paso === "datos" ? (
            <>
              <Text variant="headlineSmall" style={styles.title}>
                Crea tu cuenta
              </Text>
              <Text variant="bodyLarge" style={styles.subtitle}>
                Mira el catálogo, pide una visita o una cotización y sigue
                tus visitas desde aquí.
              </Text>
              <TextInput
                mode="outlined"
                label="Nombre"
                value={nombre}
                onChangeText={setNombre}
                autoComplete="given-name"
                textContentType="givenName"
                style={styles.input}
              />
              <TextInput
                mode="outlined"
                label="Apellido"
                value={apellido}
                onChangeText={setApellido}
                autoComplete="family-name"
                textContentType="familyName"
                style={styles.input}
              />
              <TextInput
                mode="outlined"
                label="Correo"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                style={styles.input}
              />
              <TextInput
                mode="outlined"
                label="Teléfono (opcional)"
                value={telefono}
                onChangeText={setTelefono}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                style={styles.input}
              />
              <TextInput
                mode="outlined"
                label="Contraseña"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                style={styles.input}
              />
              <Text variant="bodySmall" style={styles.nota}>
                Al menos 8 caracteres.
              </Text>
              <Button
                mode="contained"
                onPress={() => pedirCodigo()}
                loading={cargando}
                disabled={cargando || !datosCompletos}
                style={styles.button}
              >
                Continuar
              </Button>
              <Button mode="text" onPress={() => router.back()} disabled={cargando}>
                Ya tengo cuenta
              </Button>
            </>
          ) : (
            <>
              <Text variant="headlineSmall" style={styles.title}>
                Revisa tu correo
              </Text>
              <Text variant="bodyLarge" style={styles.subtitle}>
                {reenviado ? "Te enviamos un código nuevo a " : "Te enviamos un código de 6 dígitos a "}
                <Text style={styles.correo}>{email.trim()}</Text>.
              </Text>
              <TextInput
                mode="outlined"
                label="Código"
                value={codigo}
                onChangeText={(t) => setCodigo(t.replace(/\D/g, "").slice(0, 6))}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                autoFocus
                style={[styles.input, styles.inputCodigo]}
              />
              <Button
                mode="contained"
                onPress={confirmar}
                loading={cargando}
                disabled={cargando || codigo.length !== 6}
                style={styles.button}
              >
                Crear cuenta
              </Button>
              <Button mode="text" onPress={() => pedirCodigo(true)} disabled={cargando}>
                Enviar otro código
              </Button>
              <Button
                mode="text"
                onPress={() => {
                  setPaso("datos");
                  setError(null);
                }}
                disabled={cargando}
              >
                Cambiar el correo
              </Button>
            </>
          )}

          {error ? (
            <HelperText type="error" visible style={styles.error}>
              {error}
            </HelperText>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: 24, justifyContent: "center" },
  title: { textAlign: "center", marginBottom: 12, color: tema.texto },
  subtitle: { textAlign: "center", marginBottom: 28, color: "#555" },
  correo: { fontWeight: "700", color: tema.texto },
  input: { marginBottom: 12 },
  inputCodigo: { fontSize: 24, letterSpacing: 8, textAlign: "center" },
  nota: { color: tema.texto3, marginTop: -6, marginBottom: 16, paddingLeft: 4 },
  button: { marginTop: 4, marginBottom: 8 },
  error: { textAlign: "center" },
});
