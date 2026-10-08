import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { precioDelCatalogo, type ProductoDelCatalogo } from "@vivero/shared";
import { apiRequest } from "@/lib/api";
import { PantallaLista } from "@/components/ui/PantallaLista";
import type { OpcionDeMenu } from "@/components/ui/MenuDeEncabezado";
import { tema } from "@/lib/tema";

interface Respuesta {
  items: ProductoDelCatalogo[];
  hayMas: boolean;
}

const TANDA = 40;

/**
 * El catálogo del vivero: lo que se vende, con su foto y su precio con IVA.
 * Los servicios dicen *Se cotiza*, y su ficha lleva a pedir la cotización. Dos
 * por renglón, como cualquier tienda: lo que distingue una planta de otra es
 * la foto.
 *
 * La misma pantalla para el cliente y para el invitado: lo único que cambia es
 * de dónde se pide (`publico`, sin sesión) y lo que hay al lado del título.
 */
export function ListaDelCatalogo({
  publico = false,
  onAbrir,
  accion,
  acciones,
}: {
  /** Sin sesión: el modo invitado. */
  publico?: boolean;
  onAbrir: (id: string) => void;
  /** Al lado del título: *Iniciar sesión* en el modo invitado. */
  accion?: React.ReactNode;
  /** El ⋯ del encabezado. */
  acciones?: OpcionDeMenu[];
}) {
  const [busqueda, setBusqueda] = useState("");
  const [items, setItems] = useState<ProductoDelCatalogo[]>([]);
  const [hayMas, setHayMas] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState(false);
  const pedido = useRef(0);

  const cargar = useCallback(async (texto: string, desde: number) => {
    const n = ++pedido.current;
    try {
      const res = await apiRequest<Respuesta>(
        publico ? "/api/mobile/publico/catalogo" : "/api/mobile/catalogo",
        {
          query: { search: texto.trim() || undefined, offset: desde, limit: TANDA },
          authenticated: !publico,
        }
      );
      if (n !== pedido.current) return;
      setItems((prev) => (desde === 0 ? res.items : [...prev, ...res.items]));
      setHayMas(res.hayMas);
      setError(false);
    } catch {
      if (n === pedido.current) setError(true);
    } finally {
      if (n === pedido.current) {
        setCargando(false);
        setRefrescando(false);
      }
    }
  }, [publico]);

  // La búsqueda espera a que se deje de escribir.
  useEffect(() => {
    const t = setTimeout(() => cargar(busqueda, 0), busqueda ? 300 : 0);
    return () => clearTimeout(t);
  }, [busqueda, cargar]);

  return (
    <PantallaLista
      titulo="Catálogo"
      accion={accion}
      acciones={acciones}
      busqueda={busqueda}
      onBuscar={setBusqueda}
      placeholder="Buscar plantas, servicios…"
    >
      {cargando ? (
        <View style={styles.centro}>
          <ActivityIndicator color={tema.verde} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          numColumns={2}
          columnWrapperStyle={styles.fila}
          contentContainerStyle={styles.lista}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={() => {
                setRefrescando(true);
                cargar(busqueda, 0);
              }}
            />
          }
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (hayMas) cargar(busqueda, items.length);
          }}
          ListEmptyComponent={
            <View style={styles.vacio}>
              <Ionicons name="leaf-outline" size={36} color={tema.texto3} />
              <Text style={styles.vacioTexto}>
                {error
                  ? "No pudimos cargar el catálogo. Desliza hacia abajo para reintentar."
                  : busqueda
                    ? "No encontramos nada con ese nombre."
                    : "Todavía no hay productos en el catálogo."}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onAbrir(item.id)}
              style={({ pressed }) => [styles.tarjeta, pressed && styles.tarjetaTocada]}
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
                    name={item.tipo === "SERVICIO" ? "construct-outline" : "leaf-outline"}
                    size={32}
                    color={tema.texto3}
                  />
                )}
              </View>
              <Text style={styles.nombre} numberOfLines={2}>
                {item.nombre}
              </Text>
              <Text
                style={[
                  styles.precio,
                  item.precioDesde === null && styles.precioCotiza,
                ]}
              >
                {precioDelCatalogo(item)}
              </Text>
            </Pressable>
          )}
        />
      )}
    </PantallaLista>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  lista: { padding: 12, paddingBottom: 32, gap: 16 },
  fila: { gap: 12 },
  tarjeta: { flex: 1, maxWidth: "50%", gap: 4 },
  tarjetaTocada: { opacity: 0.7 },
  foto: {
    aspectRatio: 1,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: tema.lienzo,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  nombre: { color: tema.texto, fontSize: 14, fontWeight: "600" },
  precio: { color: tema.texto, fontSize: 14 },
  precioCotiza: { color: tema.texto3 },
  vacio: { alignItems: "center", gap: 10, paddingTop: 80, paddingHorizontal: 32 },
  vacioTexto: { color: tema.texto3, textAlign: "center" },
});
