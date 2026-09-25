import { useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { tema } from "@/lib/tema";

/**
 * Un PDF en una ventana de la app —la vista previa del informe, el informe
 * mismo— en lugar de en el navegador del sistema, que se abre como otra
 * pestaña y hace sentir que uno salió. Es un WebView: en iOS dibuja PDFs
 * solo; Android no, así que ahí se pide a través del visor de Google, que
 * funciona porque la URL es pública. Solo la ✕: es para mirar, y el
 * informe archivado se comparte desde su ficha.
 */
export function VisorDePdf({
  url,
  titulo,
  onCerrar,
}: {
  url: string;
  titulo: string;
  onCerrar: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [cargando, setCargando] = useState(true);
  const fuente = fuenteDePdf(url);

  return (
    <Modal visible animationType="slide" onRequestClose={onCerrar}>
      <View style={[styles.pantalla, { paddingTop: insets.top + 8 }]}>
        <View style={styles.encabezado}>
          <Pressable
            onPress={onCerrar}
            style={({ pressed }) => [styles.redondo, pressed && styles.tocado]}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          >
            <Ionicons name="close" size={22} color={tema.texto} />
          </Pressable>
          <Text style={styles.titulo} numberOfLines={1}>
            {titulo}
          </Text>
          {/* Un hueco del ancho de la ✕, para que el título quede centrado. */}
          <View style={styles.hueco} pointerEvents="none" />
        </View>
        <View style={styles.cuerpo}>
          <WebView
            source={{ uri: fuente }}
            originWhitelist={["*"]}
            onLoadEnd={() => setCargando(false)}
            style={styles.visor}
          />
          {cargando ? (
            <View style={styles.cargando} pointerEvents="none">
              <ActivityIndicator color={tema.verde} />
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

/** La dirección que dibuja un PDF en el WebView: la de siempre en iOS, la del visor de Google en Android. */
export function fuenteDePdf(url: string): string {
  return Platform.OS === "android"
    ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`
    : url;
}

/**
 * La primera página del PDF en chico, como una miniatura: el mismo WebView,
 * angosto, que dibuja la hoja ajustada al ancho. No recibe toques —la
 * tarjeta de alrededor es la que abre el visor—, así el dedo no scrollea
 * dentro de un cuadro de doce centímetros.
 */
export function MiniaturaDePdf({ url, ancho = 110, alto = 150 }: { url: string; ancho?: number; alto?: number }) {
  return (
    <View style={[styles.miniatura, { width: ancho, height: alto }]} pointerEvents="none">
      <WebView
        source={{ uri: fuenteDePdf(url) }}
        originWhitelist={["*"]}
        scrollEnabled={false}
        style={styles.miniaturaVisor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  miniatura: {
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tema.linea,
    backgroundColor: "#fff",
  },
  miniaturaVisor: { flex: 1, backgroundColor: "#fff" },
  pantalla: { flex: 1, backgroundColor: tema.superficie },
  encabezado: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  titulo: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: tema.texto,
  },
  redondo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tema.lienzo,
  },
  hueco: { width: 40, height: 40 },
  tocado: { opacity: 0.6 },
  cuerpo: { flex: 1, backgroundColor: "#e9ebe9" },
  visor: { flex: 1, backgroundColor: "#e9ebe9" },
  cargando: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
});
