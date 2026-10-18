import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { HelperText, Text, TextInput } from "react-native-paper";
import { useRouter } from "expo-router";
import { SERVICIO_OTRO } from "@vivero/shared";
import { apiRequest, mensajeDeError } from "@vivero/app-ui/lib/api";
import type { ClienteProfileResponse, PropiedadResumen } from "@vivero/app-ui/lib/types";
import {
  ElegirDireccion,
  camposDeOtra,
  direccionInicial,
  direccionLista,
  type Direccion,
} from "@/components/pedidos/LugarDeTrabajo";
import { EncabezadoDeFormulario } from "@vivero/app-ui/components/ui/EncabezadoDeFormulario";
import { ElegirServicios } from "@/components/solicitudes/ElegirServicios";
import { AdjuntarArchivos } from "@/components/solicitudes/AdjuntarArchivos";
import type { ArchivoLocal } from "@vivero/app-ui/lib/galeria";
import { subirArchivoLocal } from "@vivero/app-ui/lib/subida";
import { tema } from "@vivero/app-ui/lib/tema";

/**
 * Pedirle una visita al vivero: primero **los servicios que necesita** (al
 * menos uno, `ElegirServicios`: los servicios no están en el catálogo, se
 * piden acá), después a qué número llamarlo y los detalles en sus palabras. Les llega a los administradores en el
 * momento. Debajo, **dónde
 * es el trabajo**: una de sus propiedades u otra dirección con su pin, lo
 * mismo que el envío del checkout (`ElegirDireccion`) —quien tiene dos casas
 * dice cuál sin escribirlo en el mensaje—.
 */
export default function NuevaSolicitudScreen() {
  const router = useRouter();
  const [mensaje, setMensaje] = useState("");
  const [servicioIds, setServicioIds] = useState<string[]>([]);
  const [archivos, setArchivos] = useState<ArchivoLocal[]>([]);
  const [propiedades, setPropiedades] = useState<PropiedadResumen[]>([]);
  const [lugar, setLugar] = useState<Direccion | null>(null);
  /**
   * A qué número llamarlo. Obligatorio —el correo no sirve para coordinar una
   * visita—, y viene puesto con el de su ficha cuando tiene uno.
   */
  const [telefono, setTelefono] = useState("");
  const [cargado, setCargado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  // Al elegir *Otra dirección* sus campos salen debajo, al pie: se sube
  // hasta su tarjeta para que se vean sin tener que adivinar que hay más.
  const scroll = useRef<ScrollView>(null);
  const yDonde = useRef(0);
  const yOtra = useRef(0);
  const irA = (y: number) =>
    setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, y - 12), animated: true }), 60);
  const mostrarOtra = (y: number) => {
    yOtra.current = y;
    irA(yDonde.current + y);
  };
  /**
   * *Enviar* está siempre encendido: apagado no decía qué faltaba, y había
   * que adivinarlo bajando por todo el formulario. Al tocarlo con algo
   * pendiente se marca en rojo lo que falta y la pantalla va al primero.
   */
  const [intentado, setIntentado] = useState(false);
  const yServicios = useRef(0);
  const yTelefono = useRef(0);
  const yMensaje = useRef(0);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<ClienteProfileResponse>("/api/mobile/clientes/me")
      .then((r) => {
        setPropiedades(r.cliente.propiedades);
        setTelefono((t) => t || r.cliente.telefono || "");
        setLugar((l) => l ?? direccionInicial(r.cliente.propiedades));
      })
      .catch(() => setLugar((l) => l ?? direccionInicial([])))
      .finally(() => setCargado(true));
  }, []);

  const digitos = telefono.replace(/\D/g, "").length;
  const faltaServicios = servicioIds.length === 0;
  const faltaTelefono = digitos < 7;
  const faltaMensaje = mensaje.trim().length === 0;
  const faltaDireccion = !direccionLista(lugar, propiedades);
  /**
   * Un teléfono a medias se marca mientras se escribe; uno vacío, recién al
   * tocar *Enviar*, para no recibir a nadie con el formulario en rojo.
   */
  const telefonoMalo = (digitos > 0 || intentado) && faltaTelefono;

  async function enviar() {
    if (faltaServicios || faltaTelefono || faltaMensaje || faltaDireccion) {
      setIntentado(true);
      Keyboard.dismiss();
      irA(
        faltaServicios
          ? yServicios.current
          : faltaTelefono
            ? yTelefono.current
            : faltaMensaje
              ? yMensaje.current
              : yDonde.current + (lugar?.tipo === "OTRA" ? yOtra.current : 0),
      );
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      // Los archivos suben primero, directo a R2 con URLs firmadas; la
      // solicitud lleva solo sus `key`. Si uno falla no se manda nada, y
      // queda todo en pantalla para reintentar.
      let adjuntos: { key: string; contentType: string; nombre: string }[] = [];
      if (archivos.length > 0) {
        const { uploads } = await apiRequest<{
          uploads: { key: string; uploadUrl: string; contentType: string }[];
        }>("/api/mobile/solicitudes/upload-urls", {
          method: "POST",
          body: {
            files: archivos.map((a) => ({ fileName: a.fileName, contentType: a.contentType })),
          },
        });
        await Promise.all(
          uploads.map(async (u, i) => {
            const estado = await subirArchivoLocal(archivos[i].uri, u.uploadUrl, u.contentType);
            if (estado < 200 || estado >= 300) {
              throw new Error("No pudimos subir uno de los archivos. Intenta de nuevo.");
            }
          }),
        );
        adjuntos = uploads.map((u, i) => ({
          key: u.key,
          contentType: u.contentType,
          nombre: archivos[i].fileName,
        }));
      }
      await apiRequest("/api/mobile/solicitudes", {
        method: "POST",
        body: {
          mensaje: mensaje.trim(),
          // *Otros* no es un producto: va aparte.
          servicioIds: servicioIds.some((id) => id !== SERVICIO_OTRO)
            ? servicioIds.filter((id) => id !== SERVICIO_OTRO)
            : undefined,
          otroServicio: servicioIds.includes(SERVICIO_OTRO) || undefined,
          adjuntos: adjuntos.length ? adjuntos : undefined,
          telefono: telefono.trim(),
          ...(lugar?.tipo === "PROPIEDAD"
            ? { propiedadId: lugar.propiedadId }
            : lugar?.tipo === "OTRA"
              ? { ...camposDeOtra(lugar), guardarDireccion: lugar.guardar }
              : {}),
        },
      });
      Alert.alert(
        "Recibimos tu solicitud",
        "Un asesor se pondrá en contacto contigo pronto.",
      );
      router.back();
      // Se termina en Visitas, que es donde queda la solicitud: lo que hay
      // debajo del formulario es Pedidos, y ahí no está.
      router.navigate("/(cliente)/visitas");
    } catch (e) {
      // Un aviso y no una línea al pie: con fotos y mapa el pie queda lejos,
      // y nadie se entera de que no salió.
      const m = mensajeDeError(e, "Revisa tu conexión e intenta de nuevo.");
      setError(m);
      Alert.alert("No pudimos enviar tu solicitud", m);
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
      {!cargado ? (
        // Lo mismo que el checkout: el teléfono y sus propiedades llegan
        // juntos, y mostrarlos a medias hace saltar el formulario.
        <View style={styles.cargando}>
          <ActivityIndicator color={tema.verde} />
        </View>
      ) : (
        <KeyboardAvoidingView behavior="padding" style={styles.flex}>
          <ScrollView
            ref={scroll}
            contentContainerStyle={styles.cuerpo}
            keyboardShouldPersistTaps="handled"
          >
            {/* Primero los servicios —qué trabajo es—, después a qué número
              llamarlo y al final los detalles en sus palabras. */}
            <View onLayout={(e) => (yServicios.current = e.nativeEvent.layout.y)}>
              <ElegirServicios
                elegidos={servicioIds}
                onCambio={setServicioIds}
                error={intentado && faltaServicios}
              />
            </View>

            {/* Obligatorio y puesto de antemano con el de su ficha: puede
              cambiarlo si quiere que lo llamen a otro. Se guarda solo en la
              solicitud; su ficha no se toca. */}
            <View onLayout={(e) => (yTelefono.current = e.nativeEvent.layout.y)}>
              <Text style={styles.rotulo}>NÚMERO DE CONTACTO</Text>
              <TextInput
                mode="outlined"
                label="Teléfono"
                value={telefono}
                onChangeText={setTelefono}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                error={telefonoMalo}
                style={styles.telefono}
              />
              {telefonoMalo ? (
                <HelperText type="error" visible>
                  {digitos === 0
                    ? "Escribe a qué número llamarte."
                    : "Escribe un teléfono válido."}
                </HelperText>
              ) : null}
            </View>

            <View onLayout={(e) => (yMensaje.current = e.nativeEvent.layout.y)}>
              <Text style={styles.rotulo}>DETALLES</Text>
              <TextInput
                mode="outlined"
                label="Cuéntanos qué necesitas"
                placeholder="Tamaño del jardín, cuándo te conviene…"
                value={mensaje}
                onChangeText={setMensaje}
                multiline
                error={intentado && faltaMensaje}
                style={[styles.telefono, styles.mensaje]}
              />
              {intentado && faltaMensaje ? (
                <HelperText type="error" visible>
                  Cuéntanos qué necesitas.
                </HelperText>
              ) : null}
            </View>

            <AdjuntarArchivos archivos={archivos} onCambio={setArchivos} />

            <Text style={styles.rotulo}>¿DÓNDE ES EL TRABAJO?</Text>
            <View onLayout={(e) => (yDonde.current = e.nativeEvent.layout.y)}>
              <ElegirDireccion
                propiedades={propiedades}
                valor={lugar}
                onCambio={setLugar}
                onElegirOtra={mostrarOtra}
                marcarFaltantes={intentado}
              />
            </View>

            {error ? (
              <HelperText type="error" visible>
                {error}
              </HelperText>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cargando: { flex: 1, alignItems: "center", justifyContent: "center" },
  pantalla: { flex: 1, backgroundColor: "#fff" },
  flex: { flex: 1 },
  cuerpo: { padding: 16, gap: 12 },
  mensaje: { minHeight: 120 },
  rotulo: {
    color: tema.texto3,
    fontSize: 11,
    letterSpacing: 0.8,
    paddingLeft: 4,
    marginTop: 8,
  },
  telefono: { marginTop: 8 },
});
