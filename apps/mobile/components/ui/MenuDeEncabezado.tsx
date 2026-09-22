import { useRef, useState } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import { PressableScale } from "@/components/ui/PressableScale";
import { tema } from "@/lib/tema";

export interface OpcionDeMenu {
  etiqueta: string;
  onPress: () => void;
}

/**
 * El ⋯ del encabezado: lo que se hace de vez en cuando.
 *
 * **Cuelga del botón**, como el del portal: es un menú de dos renglones, y un
 * cajón desde abajo para eso tapa media pantalla, llega con una animación de
 * hoja y se arrastra para cerrar —todo el peso de una decisión chica—. El cajón
 * queda para lo que necesita renglones grandes y varias opciones con su
 * explicación.
 *
 * **Las opciones van con su nombre a secas, sin icono**, que es lo que hace el
 * ⋯ del portal: en una lista de dos o tres acciones el icono no distingue
 * nada —la palabra ya dice lo que el dibujo repetía— y una columna de iconos
 * empuja el texto sin agregarle nada.
 *
 * La posición sale de medir el botón (`measureInWindow`) y no de un número
 * fijo: el encabezado crece con el safe area del teléfono y con el tamaño de
 * letra del sistema. Va adentro de un `Modal` transparente porque si no lo
 * recorta la cabecera, que es la que lo contiene.
 */
export function MenuDeEncabezado({ opciones }: { opciones: OpcionDeMenu[] }) {
  const ancla = useRef<View>(null);
  const [desde, setDesde] = useState<{ top: number; right: number } | null>(
    null
  );

  if (opciones.length === 0) return null;

  function abrir() {
    ancla.current?.measureInWindow((x, y, ancho, alto) => {
      setDesde({
        top: y + alto + 6,
        // Anclado por la derecha: el botón vive en esa esquina y el menú es más
        // ancho que él, así que crece hacia adentro de la pantalla.
        right: Dimensions.get("window").width - (x + ancho),
      });
    });
  }

  return (
    <>
      {/* `collapsable={false}`: sin esto Android se come la vista por no pintar
          nada, y no hay qué medir. */}
      <View ref={ancla} collapsable={false}>
        <PressableScale
          onPress={abrir}
          style={styles.boton}
          accessibilityLabel="Acciones"
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={tema.texto2} />
        </PressableScale>
      </View>

      <Modal
        visible={desde !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDesde(null)}
      >
        {/* Tocar afuera cierra, que es lo que hace un desplegable. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setDesde(null)}>
          <View
            style={[styles.menu, desde ?? undefined]}
            // El toque adentro del menú no tiene que cerrarlo.
            onStartShouldSetResponder={() => true}
          >
            {opciones.map((o) => (
              <PressableScale
                key={o.etiqueta}
                onPress={() => {
                  setDesde(null);
                  o.onPress();
                }}
                estiloExterno={styles.ancho}
                style={styles.opcion}
                estiloPresionado={styles.presionada}
              >
                <Text style={styles.etiqueta}>{o.etiqueta}</Text>
              </PressableScale>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  boton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tema.linea,
    alignItems: "center",
    justifyContent: "center",
  },
  menu: {
    position: "absolute",
    minWidth: 200,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tema.linea,
    backgroundColor: tema.superficie,
    shadowColor: "#142819",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  ancho: { alignSelf: "stretch" },
  opcion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 10,
  },
  presionada: { backgroundColor: tema.lienzo },
  etiqueta: { color: tema.texto, fontSize: 15, fontWeight: "500" },
});
