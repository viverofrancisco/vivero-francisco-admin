import { useCallback, useRef, useState } from "react";
import { FlatList, Image, RefreshControl, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
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
import {
  ALTO_BARRA_SELECCION,
  BarraSeleccion,
} from "@/components/ui/BarraSeleccion";
import { DialogoConfirmar } from "@/components/ui/DialogoConfirmar";
import { avisoDeLote, eliminarEnLote } from "@/lib/lote";
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
  const [marcados, setMarcados] = useState<string[]>([]);
  /** Marcar es un modo, que prende el ⋯ del encabezado. Igual que el portal. */
  const [seleccionando, setSeleccionando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [archivando, setArchivando] = useState(false);
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

  // Marcar y filtrar después dejaría una cuenta de seleccionados que ya no
  // están en pantalla, y un botón que archiva lo que no se ve.
  const enPantalla = new Set(visibles.map((p) => p.id));
  const elegidos = marcados.filter((id) => enPantalla.has(id));

  function alternar(id: string) {
    setMarcados((actuales) =>
      actuales.includes(id)
        ? actuales.filter((x) => x !== id)
        : [...actuales, id]
    );
  }

  async function archivarMarcados() {
    setArchivando(true);
    try {
      const res = await eliminarEnLote(
        "/api/mobile/servicios/eliminar",
        elegidos
      );
      setError(avisoDeLote(res, "productos"));
      setConfirmando(false);
      setSeleccionando(false);
      setMarcados([]);
      await traer(busqueda, null, "refrescar");
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos eliminar"));
      setConfirmando(false);
    } finally {
      setArchivando(false);
    }
  }

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
      acciones={[
        {
          etiqueta: "Nuevo producto",
          onPress: () => router.push("/(personal)/servicios/nuevo"),
        },
        ...(!seleccionando && visibles.length > 0
          ? [
              {
                etiqueta: "Seleccionar productos",
                onPress: () => setSeleccionando(true),
              },
            ]
          : []),
      ]}
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
            <>
              <PieDeLista cargando={cargandoMas} hayMas={cursor !== null} />
              {seleccionando ? (
                <View style={{ height: ALTO_BARRA_SELECCION }} />
              ) : null}
            </>
          }
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (cursor && !cargandoMas) traer(busqueda, cursor, "mas");
          }}
          renderItem={({ item }) => (
            <PressableScale
              // Marcando **no navega**: una fila que a veces abre la ficha y a
              // veces marca es una trampa.
              onPress={() =>
                seleccionando
                  ? alternar(item.id)
                  : router.push(`/(personal)/servicios/${item.id}`)
              }
              estiloExterno={styles.ancho}
              style={[
                FILA_LISTA,
                marcados.includes(item.id) && styles.filaMarcada,
              ]}
            >
              {seleccionando ? (
                <Ionicons
                  name={
                    marcados.includes(item.id) ? "checkbox" : "square-outline"
                  }
                  size={22}
                  color={marcados.includes(item.id) ? tema.verde : tema.texto3}
                />
              ) : null}
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

      {seleccionando ? (
        <BarraSeleccion
          cuantas={elegidos.length}
          onSalir={() => {
            setSeleccionando(false);
            setMarcados([]);
          }}
        >
          <PressableScale
            onPress={() => setConfirmando(true)}
            disabled={elegidos.length === 0}
            style={[styles.accionBarra, elegidos.length === 0 && styles.apagado]}
          >
            <Text style={styles.accionBarraTexto}>Eliminar</Text>
          </PressableScale>
        </BarraSeleccion>
      ) : null}

      <DialogoConfirmar
        visible={confirmando}
        titulo={
          elegidos.length === 1
            ? "¿Eliminar 1 producto?"
            : `¿Eliminar ${elegidos.length} productos?`
        }
        detalle="Se archivan y dejan de ofrecerse. Lo ya vendido sigue nombrándolos, por eso no se borran; el que esté en el plan de algún cliente no se archiva y se avisa cuál."
        confirmar="Eliminar"
        peligro
        cargando={archivando}
        onConfirmar={archivarMarcados}
        onCancelar={() => setConfirmando(false)}
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
  ancho: { alignSelf: "stretch" },
  texto: { flex: 1, gap: 1 },
  filaMarcada: { backgroundColor: tema.verde50 },
  /* Claro sobre oscuro, nunca el rojo de la casa: sobre la pastilla oscura
     desaparece. El rojo lo pone la confirmación, que es donde se decide. */
  accionBarra: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  accionBarraTexto: { color: "#fff", fontWeight: "600", fontSize: 14 },
  apagado: { opacity: 0.45 },
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
});
