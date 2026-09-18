import { useCallback, useRef, useState } from "react";
import { FlatList, Image, RefreshControl, StyleSheet, View } from "react-native";
import { ActivityIndicator, FAB, Text } from "react-native-paper";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { PressableScale } from "@/components/ui/PressableScale";
import {
  FILA_LISTA,
  PantallaLista,
  PieDeLista,
  type GrupoDeFiltro,
} from "@/components/ui/PantallaLista";
import type { ServicioListItem, ServiciosListResponse } from "@/lib/types";
import { tema } from "@/lib/tema";

const TIPO_LABEL: Record<string, string> = {
  SERVICIO: "Servicio",
  BIEN: "Bien",
};

/** Cuántos se piden por vuelta. Entran unos ocho en pantalla. */
const POR_PAGINA = 25;

/**
 * El renglón chico de la fila: lo que la tabla del portal reparte en columnas.
 *
 * El stock va primero porque es lo que se mira, y **solo cuando existe**: un
 * servicio no lleva y un bien puede no contarlo, así que un "0" ahí mentiría.
 */
function resumen(p: ServicioListItem): string {
  if (p.archivadoEl) return "Archivado";
  const partes: string[] = [];
  if (p.stock !== null) partes.push(`${p.stock} en stock`);
  partes.push(p.variantes === 1 ? "1 variante" : `${p.variantes} variantes`);
  partes.push(TIPO_LABEL[p.tipo] ?? p.tipo);
  return partes.join(" · ");
}

/**
 * El catálogo: servicios y bienes, **de a páginas**.
 *
 * Traía los doscientos de un saque para filtrarlos en el teléfono. La lista
 * pide veinticinco y sigue pidiendo mientras se baja, que es lo que hace el
 * portal: con un catálogo que crece, cargarlo entero es una espera que empeora
 * sola.
 */
export default function ProductosListScreen() {
  const router = useRouter();
  const [items, setItems] = useState<ServicioListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [tipo, setTipo] = useState("");
  const [estado, setEstado] = useState("");
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** El último pedido que salió: lo que llega de uno viejo se descarta. */
  const pedido = useRef(0);

  const traer = useCallback(
    async (q: string, desde: string | null, modo: "inicial" | "mas" | "refrescar") => {
      const mio = ++pedido.current;
      if (modo === "inicial") setCargando(true);
      if (modo === "mas") setCargandoMas(true);
      if (modo === "refrescar") setRefrescando(true);
      try {
        const res = await apiRequest<ServiciosListResponse>(
          "/api/mobile/servicios",
          {
            query: {
              search: q || undefined,
              limit: POR_PAGINA,
              cursor: desde ?? undefined,
            },
          }
        );
        if (mio !== pedido.current) return;
        setItems((antes) => (desde ? [...antes, ...res.items] : res.items));
        setCursor(res.nextCursor);
        setError(null);
      } catch (e) {
        if (mio !== pedido.current) return;
        setError(mensajeDeError(e, "No pudimos cargar el catálogo"));
      } finally {
        if (mio === pedido.current) {
          setCargando(false);
          setCargandoMas(false);
          setRefrescando(false);
        }
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      traer(busqueda, null, items.length === 0 ? "inicial" : "refrescar");
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [traer])
  );

  function buscar(v: string) {
    setBusqueda(v);
    traer(v, null, "refrescar");
  }

  // Tipo y estado se aplican sobre lo que ya llegó: son dos valores y el
  // servidor no los conoce. La búsqueda sí viaja, que es la que puede dejar
  // afuera cientos.
  const visibles = items.filter((p) => {
    if (tipo && p.tipo !== tipo) return false;
    if (estado === "ARCHIVADO") return p.archivadoEl !== null;
    if (p.archivadoEl !== null) return false;
    return !estado || p.estado === estado;
  });

  const grupos: GrupoDeFiltro[] = [
    {
      id: "tipo",
      titulo: "Tipo",
      valor: tipo,
      onElegir: setTipo,
      opciones: [
        { clave: "", etiqueta: "Todos" },
        { clave: "SERVICIO", etiqueta: "Servicios" },
        { clave: "BIEN", etiqueta: "Bienes" },
      ],
    },
    {
      id: "estado",
      titulo: "Estado",
      valor: estado,
      onElegir: setEstado,
      opciones: [
        { clave: "", etiqueta: "Activos y borradores" },
        { clave: "ACTIVO", etiqueta: "Activos" },
        { clave: "BORRADOR", etiqueta: "Borradores" },
        { clave: "ARCHIVADO", etiqueta: "Archivados" },
      ],
    },
  ];

  return (
    <PantallaLista
      titulo="Productos"
      busqueda={busqueda}
      onBuscar={buscar}
      placeholder="Buscar producto..."
      grupos={grupos}
    >
      {cargando ? (
        <View style={styles.centro}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={visibles}
          keyExtractor={(p) => p.id}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={() => traer(busqueda, null, "refrescar")}
            />
          }
          ListHeaderComponent={
            error ? <Text style={styles.error}>{error}</Text> : null
          }
          ListEmptyComponent={
            <View style={styles.vacio}>
              <Text variant="titleMedium" style={styles.vacioTitulo}>
                {busqueda || tipo || estado
                  ? "Sin coincidencias"
                  : "No hay productos"}
              </Text>
              <Text variant="bodyMedium" style={styles.vacioTexto}>
                {busqueda || tipo || estado
                  ? "Probá con otro nombre o quitá los filtros."
                  : "Agregá el primero con el botón de abajo."}
              </Text>
            </View>
          }
          ListFooterComponent={
            <PieDeLista cargando={cargandoMas} hayMas={cursor !== null} />
          }
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (cursor && !cargandoMas) traer(busqueda, cursor, "mas");
          }}
          renderItem={({ item }) => (
            <PressableScale
              onPress={() => router.push(`/(personal)/servicios/${item.id}`)}
              style={FILA_LISTA}
            >
              <View style={styles.miniatura}>
                {item.imagenUrl ? (
                  <Image source={{ uri: item.imagenUrl }} style={styles.foto} />
                ) : (
                  <Ionicons name="image-outline" size={18} color={tema.texto3} />
                )}
              </View>
              <View style={styles.texto}>
                <Text variant="bodyLarge" style={styles.nombre} numberOfLines={1}>
                  {item.nombre}
                </Text>
                <Text variant="bodySmall" style={styles.resumen} numberOfLines={1}>
                  {resumen(item)}
                </Text>
                {item.categorias.length > 0 ? (
                  <Text variant="bodySmall" style={styles.resumen} numberOfLines={1}>
                    {item.categorias.map((c) => c.nombre).join(" · ")}
                  </Text>
                ) : null}
              </View>
              <Estado item={item} />
            </PressableScale>
          )}
        />
      )}

      <FAB
        icon="plus"
        style={styles.fab}
        color="#fff"
        onPress={() => router.push("/(personal)/servicios/nuevo")}
      />
    </PantallaLista>
  );
}

/** Archivado, borrador o nada: activo es el caso normal y no se rotula. */
function Estado({ item }: { item: ServicioListItem }) {
  if (item.archivadoEl) {
    return (
      <View style={[styles.badge, styles.badgeArchivado]}>
        <Text style={[styles.badgeTexto, styles.badgeTextoArchivado]}>
          Archivado
        </Text>
      </View>
    );
  }
  if (item.estado === "BORRADOR") {
    return (
      <View style={[styles.badge, styles.badgeBorrador]}>
        <Text style={[styles.badgeTexto, styles.badgeTextoBorrador]}>
          Borrador
        </Text>
      </View>
    );
  }
  return <Ionicons name="chevron-forward" size={18} color={tema.texto3} />;
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  miniatura: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: tema.lienzo,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  foto: { width: "100%", height: "100%" },
  texto: { flex: 1, gap: 1 },
  nombre: { color: tema.texto, fontWeight: "600" },
  resumen: { color: tema.texto3 },

  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeArchivado: { backgroundColor: tema.linea2 },
  badgeBorrador: { backgroundColor: tema.ambar50 },
  badgeTexto: { fontSize: 11, fontWeight: "600" },
  badgeTextoArchivado: { color: tema.texto2 },
  badgeTextoBorrador: { color: tema.ambarTexto },

  vacio: { alignItems: "center", paddingVertical: 48, gap: 6 },
  vacioTitulo: { color: tema.texto },
  vacioTexto: { color: tema.texto3, textAlign: "center" },
  error: { color: tema.rojo, textAlign: "center", padding: 16 },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
    backgroundColor: tema.verde,
    borderRadius: 16,
  },
});
