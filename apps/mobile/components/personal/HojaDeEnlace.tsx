import { useState } from "react";
import { Share, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import { HojaInferior } from "@/components/ui/HojaInferior";
import { PressableScale } from "@/components/ui/PressableScale";
import type { EnlaceGenerado } from "@/lib/types";
import { tema } from "@/lib/tema";

/**
 * El enlace recién emitido, la única vez que se puede ver: para copiarlo o
 * compartirlo por WhatsApp, que es como le llega al personal de campo —no
 * tienen correo—. Dice cuánto dura: una semana la invitación, una hora el
 * restablecimiento.
 */
export function HojaDeEnlace({
  datos,
  nombre,
  tipo,
  onCerrar,
}: {
  datos: EnlaceGenerado | null;
  nombre: string;
  tipo: "invitacion" | "restablecer";
  onCerrar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    if (!datos) return;
    // `expo-clipboard` es nativo: se carga al usarlo, como en el chat.
    const Clipboard = await import("expo-clipboard");
    await Clipboard.setStringAsync(datos.enlace);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  async function compartir() {
    if (!datos) return;
    await Share.share({ message: datos.enlace });
  }

  return (
    <HojaInferior visible={datos !== null} onCerrar={onCerrar}>
      <Text style={styles.titulo}>Enlace para {nombre}</Text>
      <Text style={styles.nota}>
        {tipo === "invitacion"
          ? "Con este enlace elige su contraseña y entra a la app. Dura 7 días y sirve una sola vez."
          : "Con este enlace se pone una contraseña nueva. Dura 1 hora y sirve una sola vez."}
        {datos?.correoIntentado
          ? datos.correoEnviado
            ? " También se lo mandamos por correo."
            : " No pudimos mandárselo por correo."
          : ""}
      </Text>
      <View style={styles.caja}>
        <Text style={styles.enlace} selectable numberOfLines={3}>
          {datos?.enlace ?? ""}
        </Text>
      </View>
      <View style={styles.botones}>
        <PressableScale onPress={copiar} estiloExterno={styles.mitad} style={styles.boton}>
          <Ionicons name={copiado ? "checkmark" : "copy-outline"} size={18} color={tema.texto} />
          <Text style={styles.botonTexto}>{copiado ? "Copiado" : "Copiar"}</Text>
        </PressableScale>
        <PressableScale
          onPress={compartir}
          estiloExterno={styles.mitad}
          style={[styles.boton, styles.botonPrimario]}
        >
          <Ionicons name="share-outline" size={18} color="#fff" />
          <Text style={[styles.botonTexto, styles.botonTextoPrimario]}>Compartir</Text>
        </PressableScale>
      </View>
    </HojaInferior>
  );
}

const styles = StyleSheet.create({
  titulo: { fontSize: 17, fontWeight: "700", color: tema.texto, paddingHorizontal: 4, paddingTop: 4 },
  nota: { fontSize: 14, color: tema.texto2, paddingHorizontal: 4, paddingTop: 6, paddingBottom: 12 },
  caja: {
    borderRadius: 12,
    backgroundColor: tema.lienzo,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  enlace: { fontSize: 13, color: tema.texto, fontFamily: "Menlo" },
  botones: { flexDirection: "row", gap: 10, paddingBottom: 4 },
  mitad: { flex: 1 },
  boton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: tema.lienzo,
  },
  botonPrimario: { backgroundColor: tema.verde },
  botonTexto: { fontSize: 15, fontWeight: "600", color: tema.texto },
  botonTextoPrimario: { color: "#fff" },
});
