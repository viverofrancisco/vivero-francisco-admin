import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import type { TipoDeReferencia } from "@vivero/shared";
import { HojaInferior } from "@/components/ui/HojaInferior";
import { PressableScale } from "@/components/ui/PressableScale";
import { tema } from "@/lib/tema";

export type OpcionDeAdjuntar = "camara" | "fotos" | "documento" | TipoDeReferencia;

/**
 * El **+** del chat: lo que se puede mandar además de texto, como en WhatsApp.
 *
 * Una grilla de círculos con su nombre debajo —cámara, fotos y videos,
 * documento, y las fichas que se comparten como un contacto— y no una lista
 * de renglones: seis cosas distintas se reconocen por el dibujo y el color
 * antes que por la palabra, y en cuatro por fila entran en una mano. El
 * portal en el teléfono tiene la misma hoja, y en el escritorio la cuelga del
 * botón. Cada color es uno de los del gráfico, para no inventar.
 */
const OPCIONES: {
  clave: OpcionDeAdjuntar;
  etiqueta: string;
  icono: keyof typeof Ionicons.glyphMap;
  color: string;
  /** Un jardinero no ve clientes ni productos. */
  soloOficina?: boolean;
}[] = [
  { clave: "camara", etiqueta: "Cámara", icono: "camera", color: tema.texto2 },
  { clave: "fotos", etiqueta: "Multimedia", icono: "images", color: tema.cielo },
  { clave: "documento", etiqueta: "Documento", icono: "document-text", color: tema.violeta },
  { clave: "visita", etiqueta: "Visita", icono: "calendar", color: tema.verde },
  { clave: "cliente", etiqueta: "Cliente", icono: "people", color: tema.arcilla, soloOficina: true },
  { clave: "producto", etiqueta: "Producto", icono: "pricetag", color: tema.ambar, soloOficina: true },
];

export function PanelAdjuntar({
  visible,
  esOficina,
  onCerrar,
  onElegir,
}: {
  visible: boolean;
  esOficina: boolean;
  onCerrar: () => void;
  onElegir: (opcion: OpcionDeAdjuntar) => void;
}) {
  return (
    <HojaInferior visible={visible} onCerrar={onCerrar}>
      <View style={styles.grilla}>
        {OPCIONES.filter((o) => esOficina || !o.soloOficina).map((o) => (
          <PressableScale
            key={o.clave}
            onPress={() => {
              // Cerrar primero: la elección abre el selector del sistema u
              // otra hoja, y esta no tiene que quedar debajo.
              onCerrar();
              onElegir(o.clave);
            }}
            estiloExterno={styles.celdaExterna}
            style={styles.celda}
            accessibilityLabel={o.etiqueta}
          >
            <View style={styles.circulo}>
              <Ionicons name={o.icono} size={26} color={o.color} />
            </View>
            <Text style={styles.etiqueta} numberOfLines={2}>
              {o.etiqueta}
            </Text>
          </PressableScale>
        ))}
      </View>
    </HojaInferior>
  );
}

const styles = StyleSheet.create({
  grilla: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingTop: 4,
    paddingBottom: 6,
    rowGap: 14,
  },
  // Cuatro por fila: el ancho va en el `Pressable` de afuera, que es el hijo
  // del flex; adentro solo se centra.
  celdaExterna: { width: "25%" },
  celda: { alignItems: "center", gap: 6, paddingVertical: 4, borderRadius: 12 },
  circulo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: tema.lienzo,
    alignItems: "center",
    justifyContent: "center",
  },
  etiqueta: { fontSize: 13, color: tema.texto, textAlign: "center", lineHeight: 16 },
});
