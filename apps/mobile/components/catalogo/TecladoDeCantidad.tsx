import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { textoDePrecio } from "@vivero/shared";
import { tema } from "@/lib/tema";

type Tecla = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "0" | "" | "borrar";

/** Cuatro filas de tres, como el teclado de un teléfono. */
const FILAS: Tecla[][] = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["", "0", "borrar"],
];

/**
 * Escribir la cantidad con un teclado numérico **nuestro**, no el del
 * sistema: arriba el producto y la variante elegida con su precio, el número
 * grande con el total, y debajo las teclas y *Listo*. El del sistema no tiene
 * tecla para cerrarse en iOS, tapaba medio drawer y en el simulador ni
 * aparecía.
 *
 * Arranca vacío —el valor de antes queda de guía, en gris— y no deja pasar de
 * lo que queda: escribir 20 con 9 en el estante deja 9 y lo dice.
 */
export function TecladoDeCantidad({
  titulo,
  detalle,
  precio,
  valor,
  maximo,
  onListo,
}: {
  /** El producto. */
  titulo: string;
  /** La variante elegida ("80 cm / Blanca"); vacío sin opciones. */
  detalle: string;
  /** Con IVA, de una unidad; `null` si no se sabe (no se muestra). */
  precio: number | null;
  valor: number;
  /** `null` sin límite. */
  maximo: number | null;
  onListo: (cantidad: number) => void;
}) {
  const [texto, setTexto] = useState("");
  const [topado, setTopado] = useState(false);
  const tope = maximo ?? 999;
  const numero = texto ? Number(texto) : valor;

  function tocar(tecla: Tecla) {
    if (!tecla) return;
    void Haptics.selectionAsync();
    if (tecla === "borrar") {
      setTexto((t) => t.slice(0, -1));
      setTopado(false);
      return;
    }
    const siguiente = (texto + tecla).replace(/^0+/, "");
    if (!siguiente) return;
    if (Number(siguiente) > tope) {
      setTexto(String(tope));
      setTopado(true);
      return;
    }
    setTexto(siguiente.slice(0, 3));
    setTopado(false);
  }

  return (
    <View style={styles.contenido}>
      <View style={styles.cabeza}>
        <Text style={styles.titulo} numberOfLines={1}>
          {titulo}
        </Text>
        <Text style={styles.detalle} numberOfLines={1}>
          {[detalle, precio === null ? null : `${textoDePrecio(precio)} c/u`]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>

      <View style={styles.visor}>
        <Text style={[styles.numero, !texto && styles.numeroGuia]}>{numero}</Text>
        {precio ? (
          <Text style={styles.total}>Total {textoDePrecio(Math.round(precio * Math.max(1, numero) * 100) / 100)}</Text>
        ) : null}
        <Text style={[styles.aviso, topado && styles.avisoTopado]}>
          {maximo !== null ? `${maximo} en stock` : " "}
        </Text>
      </View>

      <View style={styles.teclas}>
        {FILAS.map((fila, i) => (
          <View key={i} style={styles.fila}>
            {fila.map((t, j) =>
              t ? (
                <Pressable
                  key={j}
                  onPress={() => tocar(t)}
                  style={({ pressed }) => [
                    styles.tecla,
                    t === "borrar" && styles.teclaBorrar,
                    pressed && styles.teclaTocada,
                  ]}
                  accessibilityLabel={t === "borrar" ? "Borrar" : t}
                >
                  {t === "borrar" ? (
                    <Ionicons name="backspace-outline" size={24} color={tema.texto} />
                  ) : (
                    <Text style={styles.teclaTexto}>{t}</Text>
                  )}
                </Pressable>
              ) : (
                <View key={j} style={styles.hueco} />
              )
            )}
          </View>
        ))}
      </View>

      <Button
        mode="contained"
        onPress={() => onListo(Math.max(1, Math.min(tope, numero)))}
        contentStyle={styles.botonContenido}
        style={styles.boton}
      >
        Listo
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  contenido: { paddingHorizontal: 16, paddingTop: 4, gap: 12 },
  cabeza: { gap: 2 },
  titulo: { color: tema.texto, fontSize: 16, fontWeight: "600" },
  detalle: { color: tema.texto2, fontSize: 14 },
  visor: { alignItems: "center", paddingVertical: 4 },
  numero: { color: tema.texto, fontSize: 44, fontWeight: "700", lineHeight: 52 },
  numeroGuia: { color: tema.texto3 },
  total: { color: tema.texto2, fontSize: 15 },
  aviso: { color: tema.texto3, fontSize: 13, marginTop: 2 },
  avisoTopado: { color: "#8a5a00", fontWeight: "600" },
  // Cada tecla una tarjeta blanca con sombra: se ve que se aprieta.
  teclas: { gap: 8 },
  fila: { flexDirection: "row", gap: 8 },
  tecla: {
    flex: 1,
    height: 54,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 1.5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  teclaBorrar: { backgroundColor: "transparent", shadowOpacity: 0, elevation: 0 },
  teclaTocada: { backgroundColor: tema.linea, transform: [{ scale: 0.97 }] },
  hueco: { flex: 1 },
  teclaTexto: { color: tema.texto, fontSize: 26, fontWeight: "500" },
  boton: { borderRadius: 12 },
  botonContenido: { paddingVertical: 6 },
});
