import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import type { ProductoDelCatalogo } from "@vivero/shared";
import { apiRequest } from "@/lib/api";
import { PantallaLista } from "@/components/ui/PantallaLista";
import type { OpcionDeMenu } from "@/components/ui/MenuDeEncabezado";
import type { LineaDelCarrito } from "@/lib/carrito";
import { tema } from "@/lib/tema";
import { TarjetaDelCatalogo } from "./TarjetaDelCatalogo";
import { HojaDeOpciones } from "./HojaDeOpciones";

interface Respuesta {
  items: ProductoDelCatalogo[];
  hayMas: boolean;
}

const TANDA = 40;

/**
 * El catálogo del vivero: lo que se vende, con su foto y su precio con IVA.
 * Solo bienes: los servicios se piden marcándolos en la solicitud de visita.
 * Una tarjeta por renglón, como Amazon: la foto a la izquierda y a la
 * derecha el nombre, el precio y el botón —*Añadir* con la cantidad,
 * *Elegir opciones* o *Agotado* apagado—, así cada producto dice lo mismo en
 * el mismo lugar.
 *
 * La misma pantalla para el cliente y para el invitado: lo único que cambia es
 * de dónde se pide (`publico`, sin sesión) y lo que hay al lado del título.
 */
export function ListaDelCatalogo({
  publico = false,
  onAbrir,
  onAnadir,
  accion,
  acciones,
}: {
  /** Sin sesión: el modo invitado. */
  publico?: boolean;
  onAbrir: (id: string) => void;
  /**
   * Añadir desde la tarjeta: con una sola variante, la cantidad y *Añadir*
   * ahí mismo; con varias, *Elegir opciones* abre un drawer con las variantes.
   * Devuelve si quedó añadido, para el ✓. El invitado también añade: tiene su
   * propio carrito y compra sin cuenta.
   */
  onAnadir?: (linea: LineaDelCarrito) => boolean;
  /** Al lado del título, si una pantalla necesita algo ahí. */
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
  /** El producto cuyas opciones están abiertas en el drawer. */
  const [opcionesDe, setOpcionesDe] = useState<string | null>(null);

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
      placeholder="Buscar plantas, macetas…"
    >
      {cargando ? (
        <View style={styles.centro}>
          <ActivityIndicator color={tema.verde} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
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
            <TarjetaDelCatalogo
              item={item}
              onAbrir={() => onAbrir(item.id)}
              onAnadir={onAnadir}
              onElegirOpciones={() => setOpcionesDe(item.id)}
            />
          )}
        />
      )}
      {onAnadir ? (
        <HojaDeOpciones
          productoId={opcionesDe}
          publico={publico}
          onCerrar={() => setOpcionesDe(null)}
          onAnadir={onAnadir}
        />
      ) : null}
    </PantallaLista>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  lista: { padding: 12, paddingBottom: 32, gap: 10 },
  vacio: { alignItems: "center", gap: 10, paddingTop: 80, paddingHorizontal: 32 },
  vacioTexto: { color: tema.texto3, textAlign: "center" },
});
