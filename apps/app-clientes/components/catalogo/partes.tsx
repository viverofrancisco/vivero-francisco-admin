import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import { tema } from "@vivero/app-ui/lib/tema";
import { HojaInferior } from "@vivero/app-ui/components/ui/HojaInferior";
import { TecladoDeCantidad } from "./TecladoDeCantidad";

/** Desde cuántas se avisa *N en stock*: más que eso no le cambia nada a nadie. */
const POCAS = 5;

/** *Agotado* o *N en stock* cuando quedan pocas; nada si sobra o no se cuenta. */
export function Disponibilidad({ disponible }: { disponible: number | null }) {
  if (disponible === null || disponible > POCAS) return null;
  return (
    <Text style={[styles.disponible, disponible === 0 && styles.disponibleAgotado]}>
      {disponible === 0 ? "Agotado" : `${disponible} en stock`}
    </Text>
  );
}

/**
 * La cantidad: − y + a los lados para ir de una en una, y el número en el
 * medio **para tocar**: abre `TecladoDeCantidad`, el teclado numérico de la
 * app, con el producto y su precio arriba —en un drawer propio, o el que lo
 * contiene lo muestra en su lugar (`onTocarNumero`), porque un drawer no se
 * abre sobre otro—.
 */
export function Cantidad({
  valor,
  onCambio,
  maximo,
  compacta = false,
  ancha = false,
  teclado,
  onTocarNumero,
}: {
  valor: number;
  onCambio: (n: number) => void;
  /** `null` sin límite. */
  maximo: number | null;
  /** La de la tarjeta del catálogo: más baja y angosta. */
  compacta?: boolean;
  /**
   * A todo el ancho, con *−* y *+* en los extremos: la de la tarjeta, la
   * ficha y el cajón, donde va encima de *Añadir* y del mismo ancho.
   */
  ancha?: boolean;
  /** Lo que el teclado muestra arriba. Sin esto ni `onTocarNumero`, el número no se toca. */
  teclado?: { titulo: string; detalle: string; precio: number | null };
  /** El drawer que la contiene muestra el teclado él mismo. */
  onTocarNumero?: () => void;
}) {
  const tope = maximo ?? 999;
  const [abierto, setAbierto] = useState(false);
  const alto = compacta ? 34 : 48;
  const ancho = compacta ? 28 : 40;
  const tocable = !!onTocarNumero || !!teclado;

  function fijar(n: number) {
    onCambio(Math.max(1, Math.min(tope, Math.floor(n))));
  }

  return (
    <View
      style={[
        styles.caja,
        { height: alto, borderRadius: compacta ? 10 : 12 },
        ancha && styles.ancha,
      ]}
    >
      <Pressable
        onPress={() => fijar(valor - 1)}
        disabled={valor <= 1}
        hitSlop={4}
        style={[styles.boton, { width: ancho, height: alto }]}
        accessibilityLabel="Menos"
      >
        <Ionicons name="remove" size={compacta ? 16 : 20} color={valor <= 1 ? tema.texto3 : tema.texto} />
      </Pressable>
      <Pressable
        onPress={() => (onTocarNumero ? onTocarNumero() : setAbierto(true))}
        disabled={!tocable}
        hitSlop={4}
        style={({ pressed }) => [
          styles.numeroCaja,
          { minWidth: compacta ? 24 : 32, height: alto },
          ancha && styles.numeroAncho,
          pressed && styles.numeroTocado,
        ]}
        accessibilityLabel={`Cantidad: ${valor}. Toca para escribirla`}
      >
        <Text style={[styles.numero, { fontSize: compacta ? 14 : 16 }]}>{valor}</Text>
      </Pressable>
      <Pressable
        onPress={() => fijar(valor + 1)}
        disabled={valor >= tope}
        hitSlop={4}
        style={[styles.boton, { width: ancho, height: alto }]}
        accessibilityLabel="Más"
      >
        <Ionicons name="add" size={compacta ? 16 : 20} color={valor >= tope ? tema.texto3 : tema.texto} />
      </Pressable>
      {teclado && !onTocarNumero ? (
        <HojaInferior visible={abierto} onCerrar={() => setAbierto(false)}>
          {/* El drawer vive dentro de la tarjeta en el árbol de React: un toque
              en su fondo subiría hasta ella y abriría la ficha. Se queda acá. */}
          {abierto ? (
            <View onStartShouldSetResponder={() => true}>
              <TecladoDeCantidad
                {...teclado}
                valor={valor}
                maximo={maximo}
                onListo={(n) => {
                  onCambio(n);
                  setAbierto(false);
                }}
              />
            </View>
          ) : null}
        </HojaInferior>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  disponible: { fontSize: 12, color: "#8a5a00", fontWeight: "600" },
  disponibleAgotado: { color: tema.texto3 },
  caja: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: tema.linea,
    backgroundColor: "#fff",
  },
  boton: { alignItems: "center", justifyContent: "center" },
  numeroCaja: { alignItems: "center", justifyContent: "center", borderRadius: 6 },
  numeroTocado: { backgroundColor: tema.fondo },
  ancha: { alignSelf: "stretch" },
  numeroAncho: { flex: 1 },
  numero: { textAlign: "center", fontWeight: "600", color: tema.texto },
});
