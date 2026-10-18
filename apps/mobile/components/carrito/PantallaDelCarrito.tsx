import { useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PantallaLista } from "@/components/ui/PantallaLista";
import { useCarrito, type LineaDelCarrito } from "@/lib/carrito";
import { tema } from "@/lib/tema";
import { HojaInferior } from "@/components/ui/HojaInferior";
import { TecladoDeCantidad } from "@/components/catalogo/TecladoDeCantidad";

const dinero = (n: number) => `$${n.toFixed(2)}`;

/**
 * El carrito: cada línea con su foto, su variante, la cantidad para subir o
 * bajar y el precio con IVA; al pie, fijo, el total y *Continuar*. Solo
 * bienes: los servicios se piden en la solicitud de visita.
 *
 * La misma para el cliente y para el invitado (`invitado`): cambia solo
 * adónde llevan el catálogo, la ficha y *Continuar*.
 */
export function PantallaDelCarrito({ invitado = false }: { invitado?: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const lineas = useCarrito((s) => s.lineas);
  const cambiarCantidad = useCarrito((s) => s.cambiarCantidad);
  const quitar = useCarrito((s) => s.quitar);

  const total = lineas.reduce((n, l) => n + l.precio * l.cantidad, 0);

  return (
    <PantallaLista titulo="Carrito">
      {lineas.length === 0 ? (
        <View style={styles.vacio}>
          <Ionicons name="cart-outline" size={40} color={tema.texto3} />
          <Text style={styles.vacioTexto}>Tu carrito está vacío.</Text>
          <Button
            mode="contained"
            onPress={() => router.push(invitado ? "/(invitado)/(tabs)/catalogo" : "/(cliente)/catalogo")}
          >
            Ver el catálogo
          </Button>
        </View>
      ) : (
        <View style={styles.flex}>
          <FlatList
            data={lineas}
            keyExtractor={(l) => l.varianteId}
            contentContainerStyle={styles.lista}
            ItemSeparatorComponent={() => <View style={styles.divisor} />}
            renderItem={({ item }) => (
              <Fila
                linea={item}
                onAbrir={() =>
                  router.push(
                    invitado
                      ? `/(invitado)/(tabs)/catalogo/producto/${item.productoId}`
                      : `/(cliente)/catalogo/${item.productoId}`
                  )
                }
                onCantidad={(n) => cambiarCantidad(item.varianteId, n)}
                onQuitar={() => quitar(item.varianteId)}
              />
            )}
          />
          <View style={[styles.pie, { paddingBottom: 12 + (insets.bottom > 0 ? 0 : 4) }]}>
            <View style={styles.totalFila}>
              <Text style={styles.totalRotulo}>Total</Text>
              <Text style={styles.total}>{dinero(total)}</Text>
            </View>
            <Text style={styles.nota}>
              Incluye IVA. El pago se coordina con el vivero al confirmar tu pedido.
            </Text>
            <Button
              mode="contained"
              onPress={() =>
                router.push(invitado ? "/(invitado)/(tabs)/carrito/confirmar" : "/(cliente)/carrito/confirmar")
              }
              contentStyle={styles.botonContenido}
              style={styles.boton}
            >
              Continuar
            </Button>
          </View>
        </View>
      )}
    </PantallaLista>
  );
}

function Fila({
  linea,
  onAbrir,
  onCantidad,
  onQuitar,
}: {
  linea: LineaDelCarrito;
  onAbrir: () => void;
  onCantidad: (n: number) => void;
  onQuitar: () => void;
}) {
  const maximo = linea.disponible ?? 999;
  /** Tocar el número abre el teclado numérico de la app, como en el catálogo. */
  const [escribiendo, setEscribiendo] = useState(false);
  return (
    <View style={styles.fila}>
      <Pressable onPress={onAbrir} style={styles.foto}>
        {linea.imagenUrl ? (
          <Image source={linea.imagenUrl} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" />
        ) : (
          <Ionicons name="leaf-outline" size={22} color={tema.texto3} />
        )}
      </Pressable>
      <View style={styles.datos}>
        <Pressable onPress={onAbrir}>
          <Text style={styles.nombre} numberOfLines={2}>
            {linea.nombre}
          </Text>
          {linea.variante ? <Text style={styles.variante}>{linea.variante}</Text> : null}
        </Pressable>
        <Text style={styles.precio}>
          {linea.precio === 0 ? "Gratis" : dinero(linea.precio * linea.cantidad)}
        </Text>
        <View style={styles.abajo}>
          {/* La cantidad —en 1 el − sigue siendo el tacho— y al lado
              *Eliminar*, como Amazon: sacar algo no tiene que obligar a bajarlo
              a uno primero. */}
          <View style={styles.cantidad}>
              <Pressable
                onPress={() => (linea.cantidad <= 1 ? onQuitar() : onCantidad(linea.cantidad - 1))}
                hitSlop={6}
                style={styles.cantidadBoton}
                accessibilityLabel={linea.cantidad <= 1 ? "Quitar" : "Menos"}
              >
                <Ionicons
                  name={linea.cantidad <= 1 ? "trash-outline" : "remove"}
                  size={18}
                  color={tema.texto}
                />
              </Pressable>
              <Pressable
                onPress={() => setEscribiendo(true)}
                hitSlop={4}
                style={({ pressed }) => [styles.cantidadNumero, pressed && styles.cantidadTocada]}
                accessibilityLabel={`Cantidad: ${linea.cantidad}. Toca para escribirla`}
              >
                <Text style={styles.cantidadTexto}>{linea.cantidad}</Text>
              </Pressable>
              <Pressable
                onPress={() => onCantidad(linea.cantidad + 1)}
                disabled={linea.cantidad >= maximo}
                hitSlop={6}
                style={styles.cantidadBoton}
                accessibilityLabel="Más"
              >
                <Ionicons
                  name="add"
                  size={18}
                  color={linea.cantidad >= maximo ? tema.texto3 : tema.texto}
                />
              </Pressable>
          </View>
          <Pressable
            onPress={onQuitar}
            hitSlop={4}
            style={({ pressed }) => [styles.eliminar, pressed && styles.cantidadTocada]}
            accessibilityLabel={`Eliminar ${linea.nombre} del carrito`}
          >
            <Text style={styles.eliminarTexto}>Eliminar</Text>
          </Pressable>
        </View>
      </View>
      <HojaInferior visible={escribiendo} onCerrar={() => setEscribiendo(false)}>
        {escribiendo ? (
          <TecladoDeCantidad
            titulo={linea.nombre}
            detalle={linea.variante}
            precio={linea.precio}
            valor={linea.cantidad}
            maximo={linea.disponible}
            onListo={(n) => {
              onCantidad(n);
              setEscribiendo(false);
            }}
          />
        ) : null}
      </HojaInferior>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  lista: { padding: 12, paddingBottom: 24 },
  divisor: { height: StyleSheet.hairlineWidth, backgroundColor: tema.linea, marginVertical: 10 },
  fila: { flexDirection: "row", gap: 12 },
  foto: {
    width: 72,
    height: 72,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: tema.lienzo,
    alignItems: "center",
    justifyContent: "center",
  },
  datos: { flex: 1, gap: 4 },
  nombre: { color: tema.texto, fontWeight: "600", fontSize: 15 },
  variante: { color: tema.texto2, fontSize: 13, marginTop: 2 },
  abajo: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  cantidad: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: tema.linea,
    borderRadius: 10,
    height: 34,
  },
  eliminar: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: tema.linea,
    alignItems: "center",
    justifyContent: "center",
  },
  eliminarTexto: { color: tema.texto, fontSize: 14, fontWeight: "500" },
  cantidadBoton: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  cantidadNumero: { minWidth: 28, height: 34, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  cantidadTocada: { backgroundColor: tema.lienzo },
  cantidadTexto: { textAlign: "center", fontWeight: "600", color: tema.texto },
  precio: { color: tema.texto, fontWeight: "600" },
  pie: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tema.linea,
    backgroundColor: "#fff",
  },
  totalFila: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  totalRotulo: { color: tema.texto, fontSize: 16, fontWeight: "600" },
  total: { color: tema.texto, fontSize: 20, fontWeight: "700" },
  nota: { color: tema.texto3, fontSize: 12 },
  boton: { borderRadius: 12, marginTop: 6 },
  botonContenido: { paddingVertical: 6 },
  vacio: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  vacioTexto: { color: tema.texto3 },
});
