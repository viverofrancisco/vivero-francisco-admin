import { useCallback, useRef, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useFocusEffect, useRouter } from "expo-router";
import { nombreCliente, resumenDeCliente } from "@vivero/shared";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { PressableScale } from "@/components/ui/PressableScale";
import {
  FILA_LISTA,
  PantallaLista,
  PieDeLista,
  type GrupoDeFiltro,
} from "@/components/ui/PantallaLista";
import { useAuthStore } from "@/lib/auth-store";
import type { ClienteListItem, ClientesListResponse } from "@/lib/types";
import { tema } from "@/lib/tema";

const POR_PAGINA = 25;

/**
 * Los clientes, de a páginas.
 *
 * La búsqueda viaja al servidor —con doscientos clientes, filtrar en el
 * teléfono es filtrar adentro de la página que ya se ve— y el sector se aplica
 * sobre lo que llegó, con las opciones sacadas de esos mismos clientes: así no
 * aparece un sector en el que nadie tiene una propiedad.
 */
export default function ClientesListScreen() {
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.role);
  const puedeCrear = rol === "ADMIN" || rol === "STAFF";

  const [items, setItems] = useState<ClienteListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [sector, setSector] = useState("");
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pedido = useRef(0);

  const traer = useCallback(
    async (q: string, desde: string | null, modo: "inicial" | "mas" | "refrescar") => {
      const mio = ++pedido.current;
      if (modo === "inicial") setCargando(true);
      if (modo === "mas") setCargandoMas(true);
      if (modo === "refrescar") setRefrescando(true);
      try {
        const res = await apiRequest<ClientesListResponse>(
          "/api/mobile/clientes",
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
        setError(mensajeDeError(e, "No pudimos cargar los clientes"));
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

  const sectores = [
    ...new Set(
      items
        .map((c) => c.propiedades[0]?.sector?.nombre)
        .filter((n): n is string => Boolean(n))
    ),
  ].sort();

  const visibles = sector
    ? items.filter((c) => c.propiedades[0]?.sector?.nombre === sector)
    : items;

  // Sin sectores cargados el filtro no filtra nada, así que no se ofrece.
  const grupos: GrupoDeFiltro[] =
    sectores.length > 1
      ? [
          {
            id: "sector",
            titulo: "Sector",
            valor: sector,
            onElegir: setSector,
            opciones: [
              { clave: "", etiqueta: "Todos" },
              ...sectores.map((n) => ({ clave: n, etiqueta: n })),
            ],
          },
        ]
      : [];

  return (
    <PantallaLista
      onCrear={puedeCrear ? () => router.push("/(personal)/clientes/nuevo") : undefined}
      etiquetaCrear="Nuevo cliente"
      titulo="Clientes"
      busqueda={busqueda}
      onBuscar={buscar}
      placeholder="Buscar por nombre o teléfono..."
      grupos={grupos}
    >
      {cargando ? (
        <View style={styles.centro}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={visibles}
          keyExtractor={(c) => c.id}
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
                {busqueda || sector ? "Sin coincidencias" : "No hay clientes"}
              </Text>
              <Text variant="bodyMedium" style={styles.vacioTexto}>
                {busqueda || sector
                  ? "Probá con otro nombre o quitá los filtros."
                  : puedeCrear
                    ? "Agregá el primero con el botón de abajo."
                    : "Todavía no hay clientes registrados."}
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
          renderItem={({ item }) => {
            const nombre = nombreCliente(item);
            const iniciales =
              nombre
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((w) => w[0])
                .join("")
                .toUpperCase() || "?";
            return (
              <PressableScale
                onPress={() => router.push(`/(personal)/clientes/${item.id}`)}
                style={FILA_LISTA}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarTexto}>{iniciales}</Text>
                </View>
                <View style={styles.texto}>
                  <Text variant="bodyLarge" style={styles.nombre} numberOfLines={1}>
                    {nombre}
                  </Text>
                  <Text variant="bodySmall" style={styles.resumen} numberOfLines={1}>
                    {resumenDeCliente(item)}
                  </Text>
                </View>
              </PressableScale>
            );
          }}
        />
      )}
    </PantallaLista>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tema.verde50,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTexto: { color: tema.verde700, fontWeight: "700", fontSize: 14 },
  texto: { flex: 1, gap: 1 },
  nombre: { color: tema.texto, fontWeight: "600" },
  resumen: { color: tema.texto3 },
  vacio: { alignItems: "center", paddingVertical: 48, gap: 6 },
  vacioTitulo: { color: tema.texto },
  vacioTexto: { color: tema.texto3, textAlign: "center" },
  error: { color: tema.rojo, textAlign: "center", padding: 16 },
});
