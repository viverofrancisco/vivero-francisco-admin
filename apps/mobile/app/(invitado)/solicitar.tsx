import { useState } from "react";
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet, View } from "react-native";
import { HelperText, Text, TextInput } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { EncabezadoDeFormulario } from "@/components/ui/EncabezadoDeFormulario";
import { tema } from "@/lib/tema";

/**
 * Pedir una visita o una cotización **sin cuenta**. Como no hay cuenta, pide
 * con quién hablar: nombre y teléfono —la mayoría de los clientes no usa
 * correo—, y el correo si quiere. Les llega a los administradores en el
 * momento, igual que la de un cliente.
 */
export default function SolicitarInvitadoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ productoId?: string; producto?: string }>();
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [direccion, setDireccion] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listo =
    nombre.trim().length > 0 &&
    telefono.replace(/\D/g, "").length >= 7 &&
    mensaje.trim().length > 0;

  async function enviar() {
    setError(null);
    setEnviando(true);
    try {
      await apiRequest("/api/mobile/publico/solicitudes", {
        method: "POST",
        authenticated: false,
        body: {
          nombre: nombre.trim(),
          telefono: telefono.trim(),
          email: email.trim() || undefined,
          mensaje: mensaje.trim(),
          productoId: params.productoId || undefined,
          direccion: direccion.trim() || undefined,
        },
      });
      Alert.alert(
        "Recibimos tu solicitud",
        "Te contactaremos pronto al número que nos dejaste."
      );
      router.back();
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos enviar tu solicitud"));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View style={styles.pantalla}>
      <EncabezadoDeFormulario
        titulo={params.productoId ? "Cotización" : "Solicitar visita"}
        accion="Enviar"
        onAccion={enviar}
        onCancelar={() => router.back()}
        cargando={enviando}
        deshabilitado={!listo}
      />
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView contentContainerStyle={styles.cuerpo} keyboardShouldPersistTaps="handled">
          {params.producto ? (
            <View style={styles.producto}>
              <Ionicons name="pricetag-outline" size={18} color={tema.verde700} />
              <Text style={styles.productoTexto} numberOfLines={2}>
                {params.producto}
              </Text>
            </View>
          ) : null}

          <TextInput
            mode="outlined"
            label={params.productoId ? "¿Qué necesitas?" : "¿Qué necesitas que hagamos?"}
            placeholder={
              params.productoId
                ? "Cantidad, medidas, cuándo lo necesitas…"
                : "Mantenimiento del jardín, poda, diseño…"
            }
            value={mensaje}
            onChangeText={setMensaje}
            multiline
            style={styles.mensaje}
          />

          <Text style={styles.rotulo}>TUS DATOS</Text>
          <TextInput
            mode="outlined"
            label="Nombre"
            value={nombre}
            onChangeText={setNombre}
            autoComplete="name"
            textContentType="name"
          />
          <TextInput
            mode="outlined"
            label="Teléfono"
            value={telefono}
            onChangeText={setTelefono}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
          />
          <TextInput
            mode="outlined"
            label="Correo (opcional)"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
          />
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
  producto: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: tema.verde50,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  productoTexto: { color: tema.verde700, fontWeight: "600", flexShrink: 1 },
  mensaje: { minHeight: 120 },
  rotulo: {
    color: tema.texto3,
    fontSize: 11,
    letterSpacing: 0.8,
    paddingLeft: 4,
    marginTop: 8,
  },
  nota: { color: tema.texto3, fontSize: 13, paddingHorizontal: 4 },
});
