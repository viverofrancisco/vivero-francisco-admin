import { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { precioDelCatalogo, type ProductoDelCatalogo } from "@vivero/shared";
import { lineaDeLaTarjeta, type LineaDelCarrito } from "@/lib/carrito";
import { tema } from "@/lib/tema";
import { Cantidad, Disponibilidad } from "./partes";

/**
 * Un producto del catálogo, como Amazon: la foto a la izquierda, a todo el
 * alto, y a la derecha el nombre, el precio y al pie lo que se puede hacer:
 *
 * - **una sola variante**: la cantidad y, debajo, *Añadir*;
 * - **varias** (con una opción o con más): el rango de precios y *Elegir
 *   opciones*, que abre el drawer —en la tarjeta no caben y no se leen bien—;
 * - **agotado**: un *Agotado* apagado en el lugar del botón, así todo producto
 *   dice lo suyo en el mismo sitio.
 */
export function TarjetaDelCatalogo({
  item,
  onAbrir,
  onAnadir,
  onElegirOpciones,
}: {
  item: ProductoDelCatalogo;
  onAbrir: () => void;
  /** Sin esto (no debería pasar) la tarjeta solo informa. */
  onAnadir?: (linea: LineaDelCarrito) => boolean;
  onElegirOpciones: () => void;
}) {
  const [cantidad, setCantidad] = useState(1);
  const [recien, setRecien] = useState(false);
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unica = item.varianteUnicaId !== null;

  function anadir() {
    const linea = lineaDeLaTarjeta(item);
    if (!onAnadir || item.agotado || !linea) return;
    if (!onAnadir({ ...linea, cantidad })) return;
    setCantidad(1);
    setRecien(true);
    if (reloj.current) clearTimeout(reloj.current);
    reloj.current = setTimeout(() => setRecien(false), 1200);
  }

  return (
    <Pressable
      onPress={onAbrir}
      style={({ pressed }) => [styles.tarjeta, pressed && styles.tocada]}
    >
      <View style={styles.foto}>
        {item.imagenUrl ? (
          <Image
            source={item.imagenUrl}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="disk"
            transition={150}
          />
        ) : (
          <Ionicons
            name="leaf-outline"
            size={32}
            color={tema.texto3}
          />
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.nombre} numberOfLines={2}>
          {item.nombre}
        </Text>
        {item.resumen ? (
          <Text style={styles.resumen} numberOfLines={2}>
            {item.resumen}
          </Text>
        ) : null}
        <Text style={styles.precio}>
          {precioDelCatalogo(item)}
        </Text>
        {unica && !item.agotado ? <Disponibilidad disponible={item.disponibleUnica} /> : null}

        {onAnadir ? (
          <View style={styles.acciones}>
            {item.agotado ? (
              <View style={[styles.boton, styles.apagado]}>
                <Text style={styles.apagadoTexto}>Agotado</Text>
              </View>
            ) : unica ? (
              <>
                <Cantidad
                  ancha
                  compacta
                  valor={cantidad}
                  onCambio={setCantidad}
                  maximo={item.disponibleUnica}
                  teclado={{ titulo: item.nombre, detalle: "", precio: item.precioDesde }}
                />
                <Pressable
                  onPress={anadir}
                  style={({ pressed }) => [
                    styles.boton,
                    styles.anadir,
                    (pressed || recien) && styles.anadirTocado,
                  ]}
                  accessibilityLabel={`Añadir ${item.nombre} al carrito`}
                >
                  {recien ? (
                    <Ionicons name="checkmark" size={18} color="#fff" />
                  ) : (
                    <Text style={styles.anadirTexto}>Añadir</Text>
                  )}
                </Pressable>
              </>
            ) : (
              <Pressable
                onPress={onElegirOpciones}
                style={({ pressed }) => [styles.boton, styles.opciones, pressed && styles.tocada]}
                accessibilityLabel={`Elegir opciones de ${item.nombre}`}
              >
                <Text style={styles.opcionesTexto}>Elegir opciones</Text>
              </Pressable>
            )}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tema.linea,
    backgroundColor: "#fff",
    overflow: "hidden",
    minHeight: 150,
  },
  tocada: { opacity: 0.7 },
  foto: {
    width: "38%",
    backgroundColor: tema.lienzo,
    alignItems: "center",
    justifyContent: "center",
  },
  info: { flex: 1, padding: 12, gap: 3 },
  nombre: { color: tema.texto, fontSize: 15, fontWeight: "600" },
  resumen: { color: tema.texto3, fontSize: 13 },
  precio: { color: tema.texto, fontSize: 18, fontWeight: "700", marginTop: 4 },
  // Al pie, aunque el nombre ocupe uno o dos renglones: la cantidad arriba y
  // *Añadir* debajo, a todo el ancho, que es el que se toca.
  acciones: { marginTop: "auto", paddingTop: 10, gap: 8 },
  boton: { alignSelf: "stretch", height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  anadir: { backgroundColor: tema.verde },
  anadirTocado: { opacity: 0.85 },
  anadirTexto: { color: "#fff", fontSize: 14, fontWeight: "600" },
  opciones: { borderWidth: 1, borderColor: tema.verde },
  opcionesTexto: { color: tema.verde, fontSize: 14, fontWeight: "600" },
  apagado: { backgroundColor: tema.lienzo },
  apagadoTexto: { color: tema.texto3, fontSize: 14, fontWeight: "600" },
});
