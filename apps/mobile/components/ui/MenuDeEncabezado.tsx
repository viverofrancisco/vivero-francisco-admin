import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import { HojaInferior } from "@/components/ui/HojaInferior";
import { PressableScale } from "@/components/ui/PressableScale";
import { tema } from "@/lib/tema";

export interface OpcionDeMenu {
  icono: React.ComponentProps<typeof Ionicons>["name"];
  etiqueta: string;
  /** Una línea de ayuda, cuando la acción no se explica sola. */
  detalle?: string;
  onPress: () => void;
}

/**
 * El ⋯ del encabezado: lo que se hace de vez en cuando.
 *
 * Es el mismo lugar que en el portal en móvil —ahí las acciones `soloMovil` de
 * `PageHeader` caen en un ⋯— y por eso prender el modo de selección vive acá:
 * en una pantalla de 375 px no hay dónde poner una casilla en cada fila sin
 * gastar ese ancho para siempre.
 *
 * Las opciones se abren en un cajón desde abajo, donde está el pulgar, y no en
 * un menú colgado del botón, que a 375 px queda en la punta más lejana de la
 * mano.
 */
export function MenuDeEncabezado({ opciones }: { opciones: OpcionDeMenu[] }) {
  const [abierto, setAbierto] = useState(false);

  if (opciones.length === 0) return null;

  return (
    <>
      <PressableScale
        onPress={() => setAbierto(true)}
        style={styles.boton}
        accessibilityLabel="Más acciones"
      >
        <Ionicons name="ellipsis-horizontal" size={20} color={tema.texto2} />
      </PressableScale>

      <HojaInferior visible={abierto} onCerrar={() => setAbierto(false)}>
        <View style={styles.hoja}>
          {opciones.map((o) => (
            <PressableScale
              key={o.etiqueta}
              onPress={() => {
                setAbierto(false);
                o.onPress();
              }}
              estiloExterno={styles.ancho}
              style={styles.opcion}
            >
              <Ionicons name={o.icono} size={20} color={tema.texto2} />
              <View style={styles.crece}>
                <Text style={styles.etiqueta}>{o.etiqueta}</Text>
                {o.detalle ? (
                  <Text style={styles.detalle}>{o.detalle}</Text>
                ) : null}
              </View>
            </PressableScale>
          ))}
        </View>
      </HojaInferior>
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
  hoja: { paddingHorizontal: 4, paddingBottom: 8, gap: 4 },
  ancho: { alignSelf: "stretch" },
  crece: { flex: 1 },
  opcion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 12,
  },
  etiqueta: { color: tema.texto, fontSize: 15, fontWeight: "600" },
  detalle: { color: tema.texto3, fontSize: 13 },
});
