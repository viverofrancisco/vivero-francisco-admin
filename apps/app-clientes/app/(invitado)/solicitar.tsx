import { useRef, useState } from "react";
import { Alert, Keyboard, KeyboardAvoidingView, ScrollView, StyleSheet, View } from "react-native";
import { HelperText, Text, TextInput } from "react-native-paper";
import { useRouter } from "expo-router";
import { SERVICIO_OTRO } from "@vivero/shared";
import { apiRequest, mensajeDeError } from "@vivero/app-ui/lib/api";
import { EncabezadoDeFormulario } from "@vivero/app-ui/components/ui/EncabezadoDeFormulario";
import { ElegirServicios } from "@/components/solicitudes/ElegirServicios";
import { tema } from "@vivero/app-ui/lib/tema";

/**
 * Pedir una visita **sin cuenta**: los servicios que necesita (al menos
 * uno), con quién hablar y los detalles. Como no hay cuenta, pide
 * con quién hablar: nombre y teléfono —la mayoría de los clientes no usa
 * correo—, y el correo si quiere. Les llega a los administradores en el
 * momento, igual que la de un cliente.
 */
export default function SolicitarInvitadoScreen() {
  const router = useRouter();
  const [servicioIds, setServicioIds] = useState<string[]>([]);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [direccion, setDireccion] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const digitos = telefono.replace(/\D/g, "").length;
  const faltaServicios = servicioIds.length === 0;
  const faltaNombre = nombre.trim().length === 0;
  const faltaTelefono = digitos < 7;
  const faltaMensaje = mensaje.trim().length === 0;
  // Obligatorio: es lo que le deja crear su cuenta después y seguir la
  // solicitud desde la app (`confirmarRegistro` se la pasa por el correo).
  const faltaEmail = email.trim().length === 0;
  const emailMalo = faltaEmail || !/^\S+@\S+\.\S+$/.test(email.trim());
  /**
   * *Enviar* siempre encendido, como el del cliente: al tocarlo con algo
   * pendiente se marca en rojo y la pantalla va al primero que falta.
   */
  const [intentado, setIntentado] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const yServicios = useRef(0);
  const yDatos = useRef(0);
  const yMensaje = useRef(0);

  async function enviar() {
    if (faltaServicios || faltaNombre || faltaTelefono || emailMalo || faltaMensaje) {
      setIntentado(true);
      Keyboard.dismiss();
      const y = faltaServicios
        ? yServicios.current
        : faltaNombre || faltaTelefono || emailMalo
          ? yDatos.current
          : yMensaje.current;
      setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, y - 12), animated: true }), 60);
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await apiRequest("/api/mobile/publico/solicitudes", {
        method: "POST",
        authenticated: false,
        body: {
          nombre: nombre.trim(),
          telefono: telefono.trim(),
          email: email.trim(),
          mensaje: mensaje.trim(),
          // *Otros* no es un producto: va aparte.
          servicioIds: servicioIds.some((id) => id !== SERVICIO_OTRO)
            ? servicioIds.filter((id) => id !== SERVICIO_OTRO)
            : undefined,
          otroServicio: servicioIds.includes(SERVICIO_OTRO) || undefined,
          direccion: direccion.trim() || undefined,
        },
      });
      router.back();
      // Sin cuenta no hay dónde verla después: se le ofrece crear una con lo
      // que acaba de escribir. Con el mismo correo, al registrarse la
      // solicitud pasa a su cuenta (`confirmarRegistro`) y la sigue en Visitas.
      Alert.alert(
        "Recibimos tu solicitud",
        "Un asesor se pondrá en contacto contigo pronto. Crea tu cuenta para seguirla desde la app.",
        [
          { text: "Ahora no", style: "cancel" },
          {
            text: "Crear cuenta",
            onPress: () =>
              router.push({
                pathname: "/(auth)/registro",
                params: { nombre: nombre.trim(), email: email.trim(), telefono: telefono.trim() },
              }),
          },
        ]
      );
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos enviar tu solicitud"));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View style={styles.pantalla}>
      <EncabezadoDeFormulario
        titulo="Solicitar visita"
        accion="Enviar"
        onAccion={enviar}
        onCancelar={() => router.back()}
        cargando={enviando}
      />
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView
          ref={scroll}
          contentContainerStyle={styles.cuerpo}
          keyboardShouldPersistTaps="handled"
        >
          {/* El mismo orden que el del cliente: servicios, con quién hablar y
              los detalles en sus palabras. */}
          <View onLayout={(e) => (yServicios.current = e.nativeEvent.layout.y)}>
            <ElegirServicios
              elegidos={servicioIds}
              onCambio={setServicioIds}
              error={intentado && faltaServicios}
            />
          </View>

          <View style={styles.grupo} onLayout={(e) => (yDatos.current = e.nativeEvent.layout.y)}>
            <Text style={styles.rotulo}>TUS DATOS</Text>
            <TextInput
              mode="outlined"
              label="Nombre *"
              value={nombre}
              onChangeText={setNombre}
              autoComplete="name"
              textContentType="name"
              error={intentado && faltaNombre}
            />
            {intentado && faltaNombre ? (
              <HelperText type="error" visible style={styles.ayuda}>
                Escribe tu nombre.
              </HelperText>
            ) : null}
            <TextInput
              mode="outlined"
              label="Teléfono *"
              value={telefono}
              onChangeText={setTelefono}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              error={(digitos > 0 || intentado) && faltaTelefono}
            />
            {(digitos > 0 || intentado) && faltaTelefono ? (
              <HelperText type="error" visible style={styles.ayuda}>
                {digitos === 0 ? "Campo obligatorio." : "Escribe un teléfono válido."}
              </HelperText>
            ) : null}
            <TextInput
              mode="outlined"
              label="Correo *"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              error={intentado && emailMalo}
            />
            {intentado && emailMalo ? (
              <HelperText type="error" visible style={styles.ayuda}>
                {faltaEmail ? "Escribe tu correo." : "Escribe un correo válido."}
              </HelperText>
            ) : null}
          </View>

          <View style={styles.grupo} onLayout={(e) => (yMensaje.current = e.nativeEvent.layout.y)}>
            <Text style={styles.rotulo}>DETALLES</Text>
            <TextInput
              mode="outlined"
              label="Cuéntanos qué necesitas"
              placeholder="Tamaño del jardín, cuándo te conviene…"
              value={mensaje}
              onChangeText={setMensaje}
              multiline
              style={styles.mensaje}
              error={intentado && faltaMensaje}
            />
            {intentado && faltaMensaje ? (
              <HelperText type="error" visible style={styles.ayuda}>
                Cuéntanos qué necesitas.
              </HelperText>
            ) : null}
          </View>
          <TextInput
            mode="outlined"
            label="Dirección (opcional)"
            placeholder="Urbanización, calle, número de casa"
            value={direccion}
            onChangeText={setDireccion}
          />

          <Text style={styles.nota}>
            Te contactaremos por teléfono o WhatsApp para coordinar.
          </Text>

          {error ? (
            <HelperText type="error" visible>
              {error}
            </HelperText>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: "#fff" },
  flex: { flex: 1 },
  cuerpo: { padding: 16, gap: 12, paddingBottom: 40 },
  mensaje: { minHeight: 120 },
  /** Un bloque con su rótulo, con el mismo aire que el resto del formulario. */
  grupo: { gap: 12 },
  /** El aviso pegado al campo que señala, no a medio camino del siguiente. */
  ayuda: { marginTop: -10 },
  rotulo: {
    color: tema.texto3,
    fontSize: 11,
    letterSpacing: 0.8,
    paddingLeft: 4,
    marginTop: 8,
  },
  nota: { color: tema.texto3, fontSize: 13, paddingHorizontal: 4 },
});
