import { useEffect, useState } from "react";
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActivityIndicator, Button, HelperText, Text, TextInput } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { tema } from "@/lib/tema";
import { LogoDeLaEmpresa } from "@/components/ui/LogoDeLaEmpresa";

/**
 * El enlace de acceso —invitación o restablecer contraseña— abierto **en la
 * app**. Es la misma URL que la página del portal
 * (`/establecer-contrasena?token=…`): con la app instalada, iOS y Android la
 * entregan acá (Universal Links / App Links, declarados en `app.json`) y
 * expo-router la enruta por el camino; sin la app, el navegador muestra la
 * página de siempre. Las dos hablan con las mismas rutas públicas, así que el
 * enlace vale igual desde cualquiera de los dos lados.
 *
 * Vive fuera de `(auth)` y de los grupos por rol porque puede abrirse con o
 * sin sesión: quien pide restablecer suele estar afuera, y un administrador
 * puede tocar el enlace de un jardinero desde su propio teléfono para
 * probarlo. `useAuthGate` la deja en paz por eso.
 */
type Estado = "cargando" | "valido" | "invalido" | "listo";
type Destino = "portal" | "app";
type Motivo = "vencido" | "usado" | "anulado" | "desconocido";

interface InfoDeEnlace {
  valid: boolean;
  nombre?: string;
  destino?: Destino;
  motivo?: Motivo;
}

export default function EstablecerContrasenaScreen() {
  const router = useRouter();
  const { token: crudo } = useLocalSearchParams<{ token?: string | string[] }>();
  const token = Array.isArray(crudo) ? crudo[0] : crudo;
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);

  const [estado, setEstado] = useState<Estado>(() => (token ? "cargando" : "invalido"));
  const [nombre, setNombre] = useState<string | null>(null);
  const [destino, setDestino] = useState<Destino | null>(null);
  const [motivo, setMotivo] = useState<Motivo>("desconocido");
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!token) return;
    let vivo = true;
    apiRequest<InfoDeEnlace>("/api/auth/set-password", {
      query: { token },
      authenticated: false,
    })
      .then((info) => {
        if (!vivo) return;
        setNombre(info.nombre ?? null);
        setDestino(info.destino ?? null);
        if (info.valid) {
          setEstado("valido");
        } else {
          setMotivo(info.motivo ?? "desconocido");
          setEstado("invalido");
        }
      })
      .catch(() => {
        if (vivo) setEstado("invalido");
      });
    return () => {
      vivo = false;
    };
  }, [token]);

  async function guardar() {
    setError(null);
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setGuardando(true);
    try {
      await apiRequest("/api/auth/set-password", {
        method: "POST",
        body: { token, password },
        authenticated: false,
      });
      setEstado("listo");
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos guardar la contraseña"));
    } finally {
      setGuardando(false);
    }
  }

  /**
   * A la pantalla de entrar. Si había una sesión abierta —otra persona, o la
   * misma con la contraseña vieja— se cierra primero: la contraseña que se
   * acaba de elegir es la que tiene que entrar.
   */
  async function irAIniciarSesion() {
    if (user) await clear();
    router.replace("/(auth)/login");
  }

  /**
   * Salir sin tocar nada. Abierta desde un enlace no hay atrás: la pantalla
   * era la única de la pila y no tenía por dónde cerrarse. Al login, y si hay
   * sesión la puerta de `_layout` lo devuelve a su pantalla de siempre.
   */
  function salir() {
    if (router.canGoBack()) router.back();
    else router.replace("/(auth)/login");
  }

  const titulo =
    estado === "listo"
      ? "Contraseña creada"
      : estado === "invalido"
        ? "Enlace de acceso"
        : destino === "portal"
          ? "Crea tu contraseña para entrar al portal"
          : "Crea tu contraseña";

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <LogoDeLaEmpresa style={styles.logo} />
          <Text variant="bodyLarge" style={styles.subtitulo}>
            {titulo}
          </Text>

          {estado === "cargando" ? <ActivityIndicator color={tema.verde} /> : null}

          {/* Sin rojo: que un enlace haya caducado o lo hayan reemplazado no es
              un error de quien lo abre. */}
          {estado === "invalido" ? (
            <View style={styles.bloque}>
              <Text variant="bodyMedium" style={styles.texto}>
                {motivo === "vencido"
                  ? destino === "portal"
                    ? "Este enlace caducó. Pídele uno nuevo a un administrador."
                    : "Este enlace caducó. Pide uno nuevo desde la app o a un administrador."
                  : motivo === "usado"
                    ? "Este enlace ya se usó. Si ya elegiste tu contraseña, entra con ella; si no fuiste tú, avisa a un administrador."
                    : motivo === "anulado"
                      ? "Este enlace fue reemplazado por uno más nuevo. Busca el último que te enviaron, o pide uno nuevo desde la app o a un administrador."
                      : "El enlace no es válido. Revisa que lo hayas abierto completo, o pide uno nuevo a quien te lo envió."}
              </Text>
              <Button mode="contained" onPress={irAIniciarSesion} style={styles.boton}>
                {motivo === "usado" ? "Ir a iniciar sesión" : "Volver"}
              </Button>
            </View>
          ) : null}

          {estado === "listo" ? (
            <View style={styles.bloque}>
              <Text variant="bodyMedium" style={styles.texto}>
                {destino === "portal"
                  ? "¡Listo! Ya puedes entrar al portal con tu correo y tu nueva contraseña. En la app también."
                  : "¡Listo! Ya puedes iniciar sesión con tu nueva contraseña."}
              </Text>
              <Button mode="contained" onPress={irAIniciarSesion} style={styles.boton}>
                Iniciar sesión
              </Button>
            </View>
          ) : null}

          {estado === "valido" ? (
            <View style={styles.bloque}>
              {nombre ? (
                <Text variant="bodyMedium" style={styles.texto}>
                  Hola <Text style={styles.negrita}>{nombre}</Text>, elige tu contraseña.
                </Text>
              ) : null}
              <TextInput
                mode="outlined"
                label="Contraseña"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
                style={styles.campo}
              />
              <TextInput
                mode="outlined"
                label="Repite la contraseña"
                value={confirmar}
                onChangeText={setConfirmar}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
                style={styles.campo}
                onSubmitEditing={guardar}
              />
              <Button
                mode="contained"
                onPress={guardar}
                loading={guardando}
                disabled={guardando || password.length === 0 || confirmar.length === 0}
                style={styles.boton}
              >
                Crear contraseña
              </Button>
              <Button mode="text" onPress={salir} disabled={guardando}>
                Cancelar
              </Button>
              {error ? (
                <HelperText type="error" visible style={styles.error}>
                  {error}
                </HelperText>
              ) : null}
            </View>
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
  logo: { alignSelf: "center", height: 80, width: 220, marginBottom: 12 },
  subtitulo: { textAlign: "center", marginBottom: 28, color: "#555" },
  bloque: { gap: 4 },
  texto: { textAlign: "center", color: "#555", marginBottom: 16 },
  negrita: { fontWeight: "700", color: "#222" },
  campo: { marginBottom: 12 },
  boton: { marginTop: 8 },
  error: { textAlign: "center" },
});
