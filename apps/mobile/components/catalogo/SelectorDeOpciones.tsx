import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { textoDePrecio, type VarianteDelCatalogo } from "@vivero/shared";
import { tema } from "@/lib/tema";

type Opcion = { nombre: string; valores: string[] };

const igual = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

/** La variante de esa combinación, o la primera si la combinación no existe. */
export function varianteDe(
  variantes: VarianteDelCatalogo[],
  seleccion: string[]
): VarianteDelCatalogo | undefined {
  return variantes.find((v) => igual(v.valores, seleccion)) ?? variantes[0];
}

/** Con qué arranca la ficha o el drawer: la primera variante que se puede pedir. */
export function seleccionInicial(variantes: VarianteDelCatalogo[]): string[] {
  return (variantes.find((v) => v.disponible !== 0) ?? variantes[0])?.valores ?? [];
}

/**
 * Las opciones de un producto como Amazon: **una fila por opción** —*Color:
 * Rojo*— con sus valores en pastillas que se deslizan de lado. Lo que ya se
 * eligió en las otras opciones decide cómo se ve cada pastilla: si esa
 * combinación no existe o no queda, va punteada y tachada. En la **última**
 * opción, debajo de cada valor va el precio de esa combinación cuando no
 * todas cuestan lo mismo.
 *
 * Tocar un valor sin stock no se niega: salta a la primera variante con ese
 * valor que sí quede, y las demás opciones se acomodan a ella. Así *"quiero
 * la terracota"* siempre lleva a una terracota que se puede pedir.
 */
export function SelectorDeOpciones({
  opciones,
  variantes,
  seleccion,
  onElegir,
  compacto = false,
}: {
  opciones: Opcion[];
  variantes: VarianteDelCatalogo[];
  seleccion: string[];
  onElegir: (variante: VarianteDelCatalogo) => void;
  /** El del drawer: pastillas más bajas. */
  compacto?: boolean;
}) {
  /** La variante que resultaría de cambiar la opción `i` a `valor`. */
  function conValor(i: number, valor: string) {
    const buscada = seleccion.map((x, j) => (j === i ? valor : x));
    return variantes.find((v) => igual(v.valores, buscada));
  }

  function elegir(i: number, valor: string) {
    const exacta = conValor(i, valor);
    const v =
      (exacta && exacta.disponible !== 0 ? exacta : undefined) ??
      variantes.find((x) => x.valores[i] === valor && x.disponible !== 0) ??
      exacta ??
      variantes.find((x) => x.valores[i] === valor);
    if (v) onElegir(v);
  }

  return (
    <View style={styles.opciones}>
      {opciones.map((o, i) => {
        const candidatas = o.valores.map((valor) => ({ valor, v: conValor(i, valor) }));
        const precios = new Set(candidatas.map((c) => c.v?.precio ?? null));
        // El precio va solo en la **última** opción: ahí cada pastilla ya es
        // una combinación completa; en las anteriores dependería de lo que se
        // elija después.
        const conPrecio = i === opciones.length - 1 && precios.size > 1;
        return (
          <View key={o.nombre} style={styles.opcion}>
            <Text style={styles.rotulo}>
              {o.nombre}: <Text style={styles.elegido}>{seleccion[i] ?? ""}</Text>
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.valores}
              // Dentro de un drawer que se arrastra: el deslizamiento lateral
              // es de las pastillas.
              nestedScrollEnabled
            >
              {candidatas.map(({ valor, v }) => {
                const activa = seleccion[i] === valor;
                const sinStock = !v || v.disponible === 0;
                return (
                  <Pressable
                    key={valor}
                    onPress={() => elegir(i, valor)}
                    style={[
                      styles.valor,
                      compacto && styles.valorCompacto,
                      activa && styles.valorActivo,
                      sinStock && !activa && styles.valorAgotado,
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: activa }}
                    accessibilityLabel={sinStock ? `${valor}, agotado` : valor}
                  >
                    <Text
                      style={[
                        styles.valorTexto,
                        activa && styles.valorTextoActivo,
                        sinStock && styles.valorTextoAgotado,
                      ]}
                    >
                      {valor}
                    </Text>
                    {conPrecio ? (
                      <Text style={[styles.valorPrecio, sinStock && styles.valorPrecioAgotado]}>
                        {v ? (sinStock ? "Agotado" : textoDePrecio(v.precio)) : "No hay"}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  opciones: { gap: 14 },
  opcion: { gap: 8 },
  rotulo: { color: tema.texto2, fontSize: 15, paddingHorizontal: 16 },
  elegido: { color: tema.texto, fontWeight: "700" },
  valores: { paddingHorizontal: 16, gap: 8 },
  valor: {
    minWidth: 56,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tema.linea,
    alignItems: "center",
    justifyContent: "center",
  },
  valorCompacto: { minHeight: 38 },
  valorActivo: {
    borderColor: tema.verde,
    borderWidth: 2,
    paddingHorizontal: 13,
    backgroundColor: tema.verde50,
  },
  valorAgotado: { borderStyle: "dashed" },
  valorTexto: { color: tema.texto, fontSize: 15 },
  valorTextoActivo: { color: tema.verde700, fontWeight: "700" },
  valorTextoAgotado: { color: tema.texto3, textDecorationLine: "line-through" },
  valorPrecio: { color: tema.texto2, fontSize: 12, marginTop: 1 },
  valorPrecioAgotado: { color: tema.texto3 },
});
