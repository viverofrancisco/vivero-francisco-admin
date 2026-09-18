import { ScrollView, StyleSheet } from "react-native";
import { Text } from "react-native-paper";
import { PressableScale } from "@/components/ui/PressableScale";
import { tema } from "@/lib/tema";

export interface OpcionPastilla {
  clave: string;
  etiqueta: string;
}

/**
 * Los filtros de una lista, en una fila de pastillas que scrollea.
 *
 * En el portal son desplegables, que en un escritorio es lo correcto —hay
 * lugar y el puntero es preciso—. En un teléfono un desplegable son tres
 * toques (abrir, elegir, cerrar) para algo que acá se elige con uno, y la fila
 * además muestra **qué opciones hay** sin tener que abrirla: en una pantalla
 * angosta eso es la mitad de la ayuda.
 */
export function Pastillas({
  opciones,
  valor,
  onElegir,
}: {
  opciones: OpcionPastilla[];
  valor: string;
  onElegir: (v: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={estilos.fila}
    >
      {opciones.map((o) => {
        const elegida = valor === o.clave;
        return (
          <PressableScale
            key={o.clave || "todos"}
            onPress={() => onElegir(o.clave)}
            style={[estilos.pastilla, elegida && estilos.elegida]}
          >
            <Text style={[estilos.texto, elegida && estilos.textoElegido]}>
              {o.etiqueta}
            </Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  fila: { gap: 8, paddingRight: 8 },
  pastilla: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: tema.linea,
  },
  elegida: { backgroundColor: tema.verde50, borderColor: tema.verde100 },
  texto: { color: tema.texto2, fontSize: 13 },
  textoElegido: { color: tema.verde700, fontWeight: "600" },
});
