import { Linking, Platform, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import {
  direccionDePropiedad,
  enlaceParaLlegar,
  zonaDePropiedad,
  type PropiedadMostrable,
} from "@vivero/shared";
import { PressableScale } from "@/components/ui/PressableScale";
import { tema } from "@/lib/tema";

/**
 * Dónde queda la propiedad de esta visita, y cómo llegar.
 *
 * **El panel de arriba no es un mapa, y no pretende serlo.** Un mapa de verdad
 * acá es `react-native-maps`: un módulo nativo, otra clave de Google para
 * Android y una reconstrucción del dev build, todo para dibujar una postal de
 * 150 px que nadie va a explorar con el pulgar. Lo que se necesita parado en la
 * camioneta es otra cosa —la dirección y que arranque la navegación— y eso lo
 * hace *Llegar*, que abre la app de mapas del teléfono en el punto exacto.
 *
 * Por coordenadas y no por dirección escrita: "Blue Bay" son doscientas casas,
 * y el pin existe justamente para no depender de eso.
 */
export function UbicacionPropiedad({
  propiedad,
}: {
  propiedad: PropiedadMostrable;
}) {
  const { lat, lng } = propiedad;
  const tienePunto = lat !== null && lat !== undefined && lng !== null && lng !== undefined;
  const direccion = direccionDePropiedad(propiedad);
  const zona = zonaDePropiedad(propiedad);

  // Sin punto y sin dirección no hay nada que decir; la tarjeta sería un
  // rectángulo vacío con un rótulo.
  if (!tienePunto && !direccion && !zona) return null;

  async function llegar() {
    if (!tienePunto) return;
    const etiqueta = encodeURIComponent(propiedad.nombre ?? "Propiedad");
    // La app nativa primero: en iOS, Apple Maps; en Android, la navegación de
    // Google. Si ninguna atiende el esquema queda el enlace web, que abre la
    // app de Google Maps si está instalada y el navegador si no.
    const nativo = Platform.select({
      ios: `maps://?daddr=${lat},${lng}&dirflg=d`,
      android: `geo:${lat},${lng}?q=${lat},${lng}(${etiqueta})`,
      default: "",
    });
    try {
      if (nativo && (await Linking.canOpenURL(nativo))) {
        await Linking.openURL(nativo);
        return;
      }
    } catch {
      // Cae al enlace web.
    }
    await Linking.openURL(enlaceParaLlegar(lat as number, lng as number));
  }

  return (
    <View style={styles.tarjeta}>
      {tienePunto ? <Lienzo /> : null}

      <View style={styles.pie}>
        <View style={styles.texto}>
          <Text variant="bodyLarge" style={styles.direccion} numberOfLines={2}>
            {direccion || propiedad.nombre || "Sin dirección"}
          </Text>
          {zona ? (
            <Text variant="bodySmall" style={styles.zona} numberOfLines={1}>
              {zona}
            </Text>
          ) : null}
          {!tienePunto ? (
            <Text variant="bodySmall" style={styles.sinPunto}>
              Sin ubicación en el mapa.
            </Text>
          ) : null}
        </View>

        {tienePunto ? (
          <PressableScale onPress={llegar} style={styles.accion}>
            <View style={styles.accionIcono}>
              <Ionicons name="navigate" size={20} color={tema.verde700} />
            </View>
            <Text style={styles.accionTexto}>Llegar</Text>
          </PressableScale>
        ) : null}
      </View>
    </View>
  );
}

/**
 * El fondo del panel: franjas diagonales, como el papel de un plano.
 *
 * Con vistas y no con una imagen para que no dependa de la red —la visita se
 * abre en un jardín, muchas veces sin señal— y para que siga el verde del
 * sistema en vez de traer el suyo.
 */
function Lienzo() {
  return (
    <View style={styles.lienzo}>
      {Array.from({ length: 14 }).map((_, i) => (
        <View key={i} style={[styles.franja, { left: i * 26 - 60 }]} />
      ))}
      <View style={styles.pin}>
        <Ionicons name="location" size={44} color={tema.verde} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.linea,
  },

  lienzo: {
    height: 150,
    backgroundColor: tema.verde50,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  franja: {
    position: "absolute",
    top: -40,
    width: 10,
    height: 260,
    backgroundColor: "#ffffff",
    opacity: 0.55,
    transform: [{ rotate: "24deg" }],
  },
  pin: {
    // La sombra despega el pin del fondo, que si no se lee como un dibujo más
    // de las franjas.
    shadowColor: "#142819",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },

  pie: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  texto: { flex: 1, gap: 2 },
  direccion: { color: tema.texto, fontWeight: "600" },
  zona: { color: tema.texto3 },
  sinPunto: { color: tema.texto3, marginTop: 2 },

  accion: { alignItems: "center", gap: 4 },
  accionIcono: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: tema.verde50,
    alignItems: "center",
    justifyContent: "center",
  },
  accionTexto: { color: tema.verde700, fontSize: 12, fontWeight: "600" },
});
