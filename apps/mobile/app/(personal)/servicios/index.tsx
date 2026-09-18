import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { ActivityIndicator, FAB, Searchbar, Text } from "react-native-paper";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { PressableScale } from "@/components/ui/PressableScale";
import type { ServicioListItem, ServiciosListResponse } from "@/lib/types";
import { tema } from "@/lib/tema";

const TIPO_LABEL: Record<string, string> = {
  SERVICIO: "Servicio",
  BIEN: "Bien",
};

/**
 * El renglón chico de la fila: lo que la tabla del portal reparte en columnas,
 * dicho en una línea.
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

type Filtro = { clave: string; etiqueta: string };

/**
 * El catálogo: servicios y bienes.
 *
 * **Uno solo**, con `tipo` como único eje —lo que la cosa *es*—, y por eso el
 * buscador dice "productos" y no "servicios": el nombre viejo era de cuando el
 * catálogo solo tenía servicios, y quien viene a buscar una maceta no busca un
 * servicio.
 *
 * Los filtros son los mismos que en el portal (tipo, estado) y se ven como una
 * fila de pastillas: en un teléfono, un desplegable por filtro son tres toques
 * para algo que acá se elige con uno.
 */
export default function ProductosListScreen() {
  const router = useRouter();
  const [items, setItems] = useState<ServicioListItem[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [tipo, setTipo] = useState("");
  const [estado, setEstado] = useState("");
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (q: string, inicial = false) => {
    if (inicial) setCargando(true);
    else setRefrescando(true);
    try {
      const res = await apiRequest<ServiciosListResponse>(
        "/api/mobile/servicios",
        { query: { search: q || undefined, limit: 200 } }
      );
      setItems(res.items);
      setError(null);
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos cargar el catálogo"));
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar(busqueda, items.length === 0);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cargar])
  );

  // La búsqueda va al servidor —el catálogo puede ser largo— y los filtros se
  // aplican acá, sobre lo que ya vino: son dos valores y no vale un viaje.
  const visibles = useMemo(() => {
    let r = items;
    if (tipo) r = r.filter((p) => p.tipo === tipo);
    if (estado === "ARCHIVADO") r = r.filter((p) => p.archivadoEl !== null);
    else {
      r = r.filter((p) => p.archivadoEl === null);
      if (estado) r = r.filter((p) => p.estado === estado);
    }
    return r;
  }, [items, tipo, estado]);

  const filtrosTipo: Filtro[] = [
    { clave: "", etiqueta: "Todos" },
    { clave: "SERVICIO", etiqueta: "Servicios" },
    { clave: "BIEN", etiqueta: "Bienes" },
  ];
  const filtrosEstado: Filtro[] = [
    { clave: "", etiqueta: "Activos y borradores" },
    { clave: "ACTIVO", etiqueta: "Activos" },
    { clave: "BORRADOR", etiqueta: "Borradores" },
    { clave: "ARCHIVADO", etiqueta: "Archivados" },
  ];

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.contenedor}>
      <FlatList
        data={visibles}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.lista}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={() => cargar(busqueda)}
          />
        }
        ListHeaderComponent={
          <View style={styles.cabecera}>
            <Searchbar
              placeholder="Buscar productos"
              value={busqueda}
              onChangeText={(v) => {
                setBusqueda(v);
                cargar(v);
              }}
              elevation={0}
              style={styles.buscador}
              inputStyle={styles.buscadorTexto}
            />
            <Pastillas
              opciones={filtrosTipo}
              valor={tipo}
              onElegir={setTipo}
            />
            <Pastillas
              opciones={filtrosEstado}
              valor={estado}
              onElegir={setEstado}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
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
        renderItem={({ item }) => (
          <PressableScale
            onPress={() => router.push(`/(personal)/servicios/${item.id}`)}
            style={styles.fila}
          >
            <View style={styles.miniatura}>
              {item.imagenUrl ? (
                <Image source={{ uri: item.imagenUrl }} style={styles.foto} />
              ) : (
                <Ionicons name="image-outline" size={18} color={tema.texto3} />
              )}
            </View>
            <View style={styles.filaTexto}>
              <Text variant="bodyLarge" style={styles.nombre} numberOfLines={1}>
                {item.nombre}
              </Text>
              <Text variant="bodySmall" style={styles.resumen} numberOfLines={1}>
                {resumen(item)}
              </Text>
              {item.categorias.length > 0 ? (
                <Text
                  variant="bodySmall"
                  style={styles.categorias}
                  numberOfLines={1}
                >
                  {item.categorias.map((c) => c.nombre).join(" · ")}
                </Text>
              ) : null}
            </View>
            <Estado item={item} />
          </PressableScale>
        )}
      />

      <FAB
        icon="plus"
        style={styles.fab}
        color="#fff"
        onPress={() => router.push("/(personal)/servicios/nuevo")}
      />
    </View>
  );
}

/** Una fila de pastillas: el filtro de un teléfono. */
function Pastillas({
  opciones,
  valor,
  onElegir,
}: {
  opciones: Filtro[];
  valor: string;
  onElegir: (v: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.pastillas}
    >
      {opciones.map((o) => {
        const elegida = valor === o.clave;
        return (
          <PressableScale
            key={o.clave || "todos"}
            onPress={() => onElegir(o.clave)}
            style={[styles.pastilla, elegida && styles.pastillaElegida]}
          >
            <Text
              style={[
                styles.pastillaTexto,
                elegida && styles.pastillaTextoElegida,
              ]}
            >
              {o.etiqueta}
            </Text>
          </PressableScale>
        );
      })}
    </ScrollView>
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
  contenedor: { flex: 1, backgroundColor: tema.fondo },
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  lista: { padding: 16, paddingBottom: 96 },
  cabecera: { gap: 8, marginBottom: 12 },
  buscador: { backgroundColor: "#fff", borderRadius: 12 },
  buscadorTexto: { fontSize: 15 },

  pastillas: { gap: 8, paddingRight: 8 },
  pastilla: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: tema.linea,
  },
  pastillaElegida: { backgroundColor: tema.verde50, borderColor: tema.verde100 },
  pastillaTexto: { color: tema.texto2, fontSize: 13 },
  pastillaTextoElegida: { color: tema.verde700, fontWeight: "600" },

  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  miniatura: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: tema.lienzo,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  foto: { width: "100%", height: "100%" },
  filaTexto: { flex: 1, gap: 1 },
  nombre: { color: tema.texto, fontWeight: "600" },
  resumen: { color: tema.texto3 },
  categorias: { color: tema.texto3 },

  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeArchivado: { backgroundColor: tema.linea2 },
  badgeBorrador: { backgroundColor: tema.ambar50 },
  badgeTexto: { fontSize: 11, fontWeight: "600" },
  badgeTextoArchivado: { color: tema.texto2 },
  badgeTextoBorrador: { color: tema.ambarTexto },

  vacio: { alignItems: "center", paddingVertical: 48, gap: 6 },
  vacioTitulo: { color: tema.texto },
  vacioTexto: { color: tema.texto3, textAlign: "center" },
  error: { color: tema.rojo, textAlign: "center" },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
    backgroundColor: tema.verde,
    borderRadius: 16,
  },
});
