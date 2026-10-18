import { useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, HelperText, Text, TextInput } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  apellidoDeRegistro,
  contrasenaDeRegistro,
  correoDeRegistro,
  nombreDeRegistro,
  errorDe,
  type AuthSuccessResponse,
} from "@vivero/shared";
import { apiRequest, esApiError, mensajeDeError } from "@vivero/app-ui/lib/api";
import { useAuthStore } from "@vivero/app-ui/lib/auth-store";
import { registerForPushNotifications } from "@vivero/app-ui/lib/push";
import { prepararDatosPara } from "@/lib/datos-de-la-cuenta";
import { tema } from "@vivero/app-ui/lib/tema";
import { LogoDeLaEmpresa } from "@/components/ui/LogoDeLaEmpresa";
import { CampoDeCodigo } from "@vivero/app-ui/components/ui/CampoDeCodigo";
import { EncabezadoDeFormulario } from "@vivero/app-ui/components/ui/EncabezadoDeFormulario";

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
  // Desde el aviso de una solicitud o un pedido de invitado llega con lo que
  // ya escribió ahí, para no pedírselo dos veces.
  const previo = useLocalSearchParams<{ nombre?: string; email?: string; telefono?: string }>();
  const [nombre, setNombre] = useState(previo.nombre ?? "");
  const [apellido, setApellido] = useState("");
  const [email, setEmail] = useState(previo.email ?? "");
  const [telefono, setTelefono] = useState(previo.telefono ?? "");
  const [password, setPassword] = useState("");
  const [codigo, setCodigo] = useState("");
  const [cargando, setCargando] = useState(false);
  // Solo el error **del código** (no coincide, venció, demasiados intentos):
  // va debajo de las casillas. Lo que no es de ningún campo —el correo que no
  // sale, demasiados pedidos, sin conexión— va en una alerta.
  const [errorCodigo, setErrorCodigo] = useState<string | null>(null);
  const [reenviado, setReenviado] = useState(false);

  // El correo se revisa mientras se escribe: primero la forma, acá mismo, y
  // después —medio segundo sin tipear— si ya tiene cuenta, en el servidor. El
  // error va debajo del campo, en rojo; no al pie, donde con el teclado abierto
  // no se ve.
  const [correo, setCorreo] = useState<{
    estado: "vacio" | "revisando" | "libre" | "error";
    mensaje?: string;
  }>({ estado: "vacio" });
  const [correoTocado, setCorreoTocado] = useState(false);
  const [passwordTocada, setPasswordTocada] = useState(false);
  const [nombreTocado, setNombreTocado] = useState(false);
  const [apellidoTocado, setApellidoTocado] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ultimoRevisado = useRef("");

  function cambiarCorreo(valor: string) {
    setEmail(valor);
    if (temporizador.current) clearTimeout(temporizador.current);
    const limpio = valor.trim().toLowerCase();
    if (!limpio) {
      setCorreo({ estado: "vacio" });
      return;
    }
    const formato = errorDe(correoDeRegistro, limpio);
    if (formato) {
      setCorreo({ estado: "error", mensaje: formato });
      return;
    }
    setCorreo({ estado: "revisando" });
    temporizador.current = setTimeout(() => revisarCorreo(limpio), 500);
  }

  async function revisarCorreo(limpio: string) {
    ultimoRevisado.current = limpio;
    try {
      const r = await apiRequest<{ disponible: boolean; motivo?: string }>(
        "/api/mobile/auth/registro/correo",
        { method: "POST", authenticated: false, body: { email: limpio } }
      );
      // Si mientras tanto siguió escribiendo, esta respuesta ya no es de lo
      // que hay en el campo.
      if (ultimoRevisado.current !== limpio) return;
      setCorreo(r.disponible ? { estado: "libre" } : { estado: "error", mensaje: r.motivo });
    } catch {
      // Sin respuesta no se sabe: que lo decida el servidor al continuar.
      if (ultimoRevisado.current === limpio) setCorreo({ estado: "libre" });
    }
  }

  const errorPassword = password ? errorDe(contrasenaDeRegistro, password) : null;
  // Como el correo: se marca al salir del campo, no a mitad de escribirlo.
  const errorNombre = errorDe(nombreDeRegistro, nombre);
  const errorApellido = errorDe(apellidoDeRegistro, apellido);
  // La forma del correo se marca al salir del campo —a mitad de escribirlo
  // siempre está mal—; que ya tiene cuenta, apenas se sabe.
  const errorCorreo =
    correo.estado === "error" &&
    (correoTocado || !errorDe(correoDeRegistro, email.trim().toLowerCase()))
      ? correo.mensaje
      : null;

  const datosCompletos =
    !errorNombre &&
    !errorApellido &&
    correo.estado === "libre" &&
    !!password &&
    !errorPassword;

  async function pedirCodigo(reenvio = false) {
    setErrorCodigo(null);
    setCargando(true);
    try {
      await apiRequest("/api/mobile/auth/registro", {
        method: "POST",
        authenticated: false,
        body: {
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          email: email.trim(),
          telefono: telefono.trim() || undefined,
          password,
        },
      });
      setPaso("codigo");
      setReenviado(reenvio);
      if (reenvio) setCodigo("");
    } catch (e) {
      // Que el correo ya tiene cuenta va debajo del correo, como si se
      // hubiera sabido al escribirlo.
      if (esApiError(e) && e.status === 409 && !reenvio) {
        setCorreoTocado(true);
        setCorreo({ estado: "error", mensaje: e.message });
        return;
      }
      Alert.alert("No pudimos enviarte el código", mensajeDeError(e, "Intenta de nuevo en un momento."));
    } finally {
      setCargando(false);
    }
  }

  async function confirmar(codigo: string) {
    setErrorCodigo(null);
    setCargando(true);
    let res: AuthSuccessResponse;
    try {
      res = await apiRequest<AuthSuccessResponse>(
        "/api/mobile/auth/registro/confirmar",
        {
          method: "POST",
          authenticated: false,
          body: { email: email.trim(), codigo },
        }
      );
    } catch (e) {
      // 400 es del código (no coincide, venció, demasiados intentos); lo demás
      // —el acceso bloqueado, dos fichas con el correo, sin conexión— no se
      // arregla escribiéndolo otra vez.
      if (esApiError(e) && e.status === 400) {
        setErrorCodigo(e.message);
      } else {
        Alert.alert("No pudimos crear tu cuenta", mensajeDeError(e, "Intenta de nuevo en un momento."));
      }
      // Se valida solo al sexto dígito, así que el que falló se borra para
      // escribir el siguiente sin tener que borrarlo a mano.
      setCodigo("");
      setCargando(false);
      return;
    }

    // La cuenta ya existe: de acá en adelante nada dice "no pudimos crearla".
    // No se navega desde acá: al abrir la sesión, `useAuthGate` lleva al
    // cliente a sus visitas, y es el único que decide a dónde va cada rol.
    await prepararDatosPara(res.user.id);
    await setSession(res, res.user);
    registerForPushNotifications().catch(() => {});
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {/* Fijo arriba, como en los formularios: es lo único que no se va con
          el scroll, y con el teclado abierto un botón al pie queda debajo. */}
      {paso === "datos" ? (
        <EncabezadoDeFormulario
          titulo="Crear cuenta"
          textoCancelar="Atrás"
          onCancelar={() => router.back()}
          accion="Continuar"
          onAccion={() => pedirCodigo()}
          cargando={cargando}
          deshabilitado={!datosCompletos}
        />
      ) : (
        <EncabezadoDeFormulario
          titulo="Verifica tu correo"
          textoCancelar="Atrás"
          onCancelar={() => {
            setPaso("datos");
            setCodigo("");
            setErrorCodigo(null);
          }}
          cargando={cargando}
        />
      )}
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <LogoDeLaEmpresa style={styles.logo} />
          {paso === "datos" ? (
            <>
              <TextInput
                mode="outlined"
                label="Nombre"
                value={nombre}
                onChangeText={setNombre}
                onBlur={() => setNombreTocado(true)}
                autoComplete="given-name"
                textContentType="givenName"
                autoCapitalize="words"
                error={nombreTocado && !!errorNombre}
                style={nombreTocado && errorNombre ? styles.inputConAyuda : styles.input}
              />
              {nombreTocado && errorNombre ? (
                <HelperText type="error" visible style={styles.ayuda}>
                  {errorNombre}
                </HelperText>
              ) : null}
              <TextInput
                mode="outlined"
                label="Apellido"
                value={apellido}
                onChangeText={setApellido}
                onBlur={() => setApellidoTocado(true)}
                autoComplete="family-name"
                textContentType="familyName"
                autoCapitalize="words"
                error={apellidoTocado && !!errorApellido}
                style={apellidoTocado && errorApellido ? styles.inputConAyuda : styles.input}
              />
              {apellidoTocado && errorApellido ? (
                <HelperText type="error" visible style={styles.ayuda}>
                  {errorApellido}
                </HelperText>
              ) : null}
              <TextInput
                mode="outlined"
                label="Correo"
                value={email}
                onChangeText={cambiarCorreo}
                onBlur={() => setCorreoTocado(true)}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                error={!!errorCorreo}
                right={
                  correo.estado === "revisando" ? (
                    <TextInput.Icon icon="dots-horizontal" color={tema.texto3} />
                  ) : correo.estado === "libre" ? (
                    <TextInput.Icon icon="check" color={tema.verde} />
                  ) : undefined
                }
                style={errorCorreo ? styles.inputConAyuda : styles.input}
              />
              {errorCorreo ? (
                <HelperText type="error" visible style={styles.ayuda}>
                  {errorCorreo}
                </HelperText>
              ) : null}
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
                onBlur={() => setPasswordTocada(true)}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                error={passwordTocada && !!errorPassword}
                style={styles.inputConAyuda}
              />
              {/* La regla está a la vista desde el principio, y se pone roja
                  si al salir del campo no se cumple. */}
              <HelperText
                type={passwordTocada && errorPassword ? "error" : "info"}
                visible
                style={styles.ayuda}
              >
                {passwordTocada && errorPassword ? errorPassword : "Al menos 8 caracteres."}
              </HelperText>
            </>
          ) : (
            <>
              <Text variant="bodyLarge" style={styles.subtitle}>
                {reenviado ? "Te enviamos un código nuevo a " : "Te enviamos un código de 6 dígitos a "}
                <Text style={styles.correo}>{email.trim()}</Text>.
              </Text>
              <CampoDeCodigo
                valor={codigo}
                onCambiar={(c) => {
                  setCodigo(c);
                  if (errorCodigo) setErrorCodigo(null);
                }}
                alCompletar={confirmar}
                deshabilitado={cargando}
                conError={!!errorCodigo}
              />
              {errorCodigo ? (
                <HelperText type="error" visible style={styles.errorCodigo}>
                  {errorCodigo}
                </HelperText>
              ) : null}
              <Button mode="text" onPress={() => pedirCodigo(true)} disabled={cargando}>
                Enviar otro código
              </Button>
            </>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: 24, justifyContent: "center" },
  logo: { alignSelf: "center", height: 80, width: 220, marginBottom: 24 },
  subtitle: { textAlign: "center", marginBottom: 28, color: "#555" },
  correo: { fontWeight: "700", color: tema.texto },
  input: { marginBottom: 12 },
  inputConAyuda: { marginBottom: 0 },
  ayuda: { marginBottom: 8 },
  errorCodigo: { textAlign: "center", marginTop: -12, marginBottom: 8 },
});
