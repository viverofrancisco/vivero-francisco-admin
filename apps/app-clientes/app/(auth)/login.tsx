import { useState } from "react";
import { KeyboardAvoidingView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, HelperText, Text, TextInput } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { AuthSuccessResponse } from "@vivero/shared";
import { apiRequest, mensajeDeError } from "@vivero/app-ui/lib/api";
import { useAuthStore } from "@vivero/app-ui/lib/auth-store";
import { registerForPushNotifications } from "@vivero/app-ui/lib/push";
import { LogoDeLaEmpresa } from "@/components/ui/LogoDeLaEmpresa";
import { prepararDatosPara } from "@/lib/datos-de-la-cuenta";

export default function LoginScreen() {
  const router = useRouter();
  // Desde el checkout de invitado (*¿Ya tienes cuenta? Iniciar sesión*): al
  // entrar, o al seguir como invitado, se vuelve a ese checkout, con el
  // carrito que ya tenía.
  const { volver } = useLocalSearchParams<{ volver?: string }>();
  const alCheckout = volver === "checkout";

  /** El carrito de esa sesión y, encima, su checkout: atrás vuelve al carrito. */
  function irAlCheckout(grupo: "(cliente)" | "(invitado)/(tabs)") {
    router.replace(`/${grupo}/carrito` as never);
    setTimeout(() => router.push(`/${grupo}/carrito/confirmar` as never), 50);
  }
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
          body: { email, password, app: "clientes" },
          authenticated: false,
        }
      );
      // Esta es la app de clientes: una cuenta del equipo entra en Vivero
      // Francisco Admin. Se cierra la sesión que el servidor acaba de abrir y
      // se le dice dónde entrar, sin guardar nada.
      if (res.user.role !== "CLIENTE") {
        apiRequest("/api/mobile/auth/logout", {
          method: "POST",
          body: { refreshToken: res.refreshToken },
          authenticated: false,
        }).catch(() => {});
        setError("Esta cuenta es del equipo del vivero: entra con ella en la app Vivero Francisco Admin.");
        return;
      }
      // Antes de la sesión: lo guardado de otra cuenta no se pinta ni un instante.
      await prepararDatosPara(res.user.id);
      await setSession(res, res.user);
      registerForPushNotifications().catch(() => {});
      if (alCheckout) irAlCheckout("(cliente)");
      else router.replace("/(cliente)/visitas");
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
            Inicia sesión con tu correo
          </Text>

          {/* Un solo campo para los cuatro roles. La oficina entra con su
              correo, quien trabaja en el jardín con el usuario que le dictaron
              —no tiene correo— y el cliente con su correo (el teléfono vuelve
              cuando haya cómo probar que es suyo). Quién es cada uno
              lo resuelve el servidor, que es el único que puede: preguntárselo
              a la persona es hacerle una pregunta nuestra. */}
          <TextInput
            mode="outlined"
            label="Correo"
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
            ¿Olvidaste tu contraseña?
          </Button>

          {error ? (
            <HelperText type="error" visible style={styles.error}>
              {error}
            </HelperText>
          ) : null}
        </View>
      </KeyboardAvoidingView>
      {/* Al pie, como en cualquier app: quien no tiene cuenta se la crea con
          su correo —si el correo ya estaba en la ficha de un cliente, queda
          vinculada a ella— o mira el catálogo sin cuenta. */}
      <View style={styles.footer}>
        <Text variant="bodyMedium" style={styles.footerTexto}>
          ¿No tienes una cuenta?
        </Text>
        <Button
          mode="outlined"
          onPress={() => router.push("/(auth)/registro")}
          disabled={loading}
        >
          Crear cuenta
        </Button>
        <Button
          mode="text"
          onPress={() =>
            alCheckout ? irAlCheckout("(invitado)/(tabs)") : router.push("/(invitado)/(tabs)/catalogo")
          }
          disabled={loading}
        >
          Seguir como invitado
        </Button>
      </View>
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
