import { useState } from "react";
import { Alert, KeyboardAvoidingView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, HelperText, Text, TextInput } from "react-native-paper";
import { useRouter } from "expo-router";
import type { AuthSuccessResponse } from "@vivero/shared";
import { apiRequest, mensajeDeError } from "@vivero/app-ui/lib/api";
import { useAuthStore } from "@vivero/app-ui/lib/auth-store";
import { registerForPushNotifications } from "@vivero/app-ui/lib/push";
import { LogoDeLaEmpresa } from "@/components/ui/LogoDeLaEmpresa";
import { prepararDatosPara } from "@/lib/datos-de-la-cuenta";

export default function LoginScreen() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
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
          // Solo cuentas de este lado (ver `loginSchema`).
          body: { email, password, app: "equipo" },
          authenticated: false,
        }
      );
      // Esta es la app del equipo: un cliente entra en Vivero Francisco, la
      // de las tiendas. Se cierra la sesión que el servidor acaba de abrir y
      // se le dice dónde entrar, sin guardar nada.
      if (res.user.role === "CLIENTE") {
        apiRequest("/api/mobile/auth/logout", {
          method: "POST",
          body: { refreshToken: res.refreshToken },
          authenticated: false,
        }).catch(() => {});
        setError("Esta cuenta no puede entrar en esta app.");
        return;
      }
      // Antes de la sesión: lo guardado de otra cuenta no se pinta ni un instante.
      await prepararDatosPara(res.user.id);
      await setSession(res, res.user);
      registerForPushNotifications().catch(() => {});
      // Oficina y jardineros van al mismo lugar: la lista de visitas. Lo que
      // cambia es qué ven —el jardinero, solo las suyas— y eso lo decide el
      // servidor, no esta pantalla.
      router.replace("/(personal)/visitas");
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos iniciar sesión"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior="padding"
        style={styles.flex}
      >
        <View style={styles.content}>
          <LogoDeLaEmpresa style={styles.logo} />
          <Text variant="bodyLarge" style={styles.subtitle}>
            Inicia sesión con tu usuario o tu correo
          </Text>

          {/* Un solo campo para los cuatro roles. La oficina entra con su
              correo, quien trabaja en el jardín con el usuario que le dictaron
              —no tiene correo— y el cliente con su correo (el teléfono vuelve
              cuando haya cómo probar que es suyo). Quién es cada uno
              lo resuelve el servidor, que es el único que puede: preguntárselo
              a la persona es hacerle una pregunta nuestra. */}
          <TextInput
            mode="outlined"
            label="Usuario o correo"
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

          {/* El equipo no tiene autoservicio: el enlace para elegir una
              contraseña nueva lo emite un administrador desde su ficha. Se
              dice acá, que es donde alguien lo va a buscar. */}
          <Button
            mode="text"
            onPress={() =>
              Alert.alert(
                "¿Olvidaste tu contraseña?",
                "Pídele a un administrador que te mande un enlace para elegir una nueva. Lo emite desde tu ficha, en Personal o en Usuarios."
              )
            }
            disabled={loading}
          >
            ¿Olvidaste tu contraseña?
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
  logo: { alignSelf: "center", height: 80, width: 220, marginBottom: 16 },
  subtitle: { textAlign: "center", marginBottom: 32, color: "#555" },
  input: { marginBottom: 16 },
  button: { marginBottom: 8 },
  error: { textAlign: "center" },
  footer: { paddingHorizontal: 24, paddingBottom: 16, gap: 8 },
  footerTexto: { textAlign: "center", color: "#555" },
});
