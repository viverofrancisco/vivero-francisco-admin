import { useCallback, useEffect, useRef, useState } from "react";
import { EstadoDelCliente } from "@/components/clientes/EstadoDelCliente";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useFocusEffect, useRouter } from "expo-router";
import { nombreCliente, resumenDeCliente } from "@vivero/shared";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { PressableScale } from "@/components/ui/PressableScale";
import { MenuDeEncabezado } from "@/components/ui/MenuDeEncabezado";
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
import { Ionicons } from "@expo/vector-icons";
import { avisoDeLote, eliminarEnLote } from "@/lib/lote";
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
  /** "" todos, "activos" o "inactivos". Viaja al servidor, como la búsqueda. */
  const [estado, setEstado] = useState("");
  const estadoRef = useRef("");
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marcados, setMarcados] = useState<string[]>([]);
  /** Marcar es un modo, que prende el ⋯ del encabezado. Igual que el portal. */
  const [seleccionando, setSeleccionando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [archivando, setArchivando] = useState(false);
  const pedido = useRef(0);

  const traer = useCallback(
    async (q: string, desde: string | null, modo: "inicial" | "mas" | "refrescar" | "silencioso") => {
      const mio = ++pedido.current;
      if (modo === "inicial") setCargando(true);
      if (modo === "mas") setCargandoMas(true);
      // "silencioso" no prende nada: la lista sigue mostrando lo que tenía y
      // se reemplaza cuando llega la nueva. El de tirar para refrescar es
      // **solo del gesto**: prendido por código al volver de una ficha, iOS
      // lo dejaba clavado arriba de la lista, con la transición de vuelta a
      // medio hacer.
      if (modo === "refrescar") setRefrescando(true);
      try {
        const res = await apiRequest<ClientesListResponse>(
          "/api/mobile/clientes",
          {
            query: {
              search: q || undefined,
              estado: estadoRef.current || undefined,
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

  /*
   * Lo último que se buscó y si ya hay filas, para el foco. El efecto de
   * foco cierra sobre el primer render —`busqueda` vacía, `items` vacío— y
   * ponerlos entre sus dependencias lo dispararía en cada tecla mientras la
   * pantalla tiene el foco. Con esto, volver de una ficha vuelve a pedir
   * **lo que se estaba buscando** y en silencio: la lista quedaba sin filtro
   * con el término todavía en el buscador, y con el spinner encima.
   */
  const busquedaRef = useRef(busqueda);
  const hayFilasRef = useRef(false);
  useEffect(() => {
    busquedaRef.current = busqueda;
    hayFilasRef.current = items.length > 0;
  }, [busqueda, items.length]);

  useFocusEffect(
    useCallback(() => {
      traer(busquedaRef.current, null, hayFilasRef.current ? "silencioso" : "inicial");
    }, [traer])
  );

  function buscar(v: string) {
    setBusqueda(v);
    traer(v, null, "silencioso");
  }

  function filtrarPorEstado(v: string) {
    setEstado(v);
    estadoRef.current = v;
    traer(busqueda, null, "silencioso");
  }

  /** Marcar la selección como inactiva, o reactivarla. Reversible: sin confirmación. */
  async function cambiarEstado(inactivo: boolean) {
    setCambiandoEstado(true);
    try {
      await apiRequest("/api/mobile/clientes/inactivo", {
        method: "POST",
        body: { ids: elegidos, inactivo },
      });
      setSeleccionando(false);
      setMarcados([]);
      await traer(busqueda, null, "silencioso");
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo guardar"));
    } finally {
      setCambiandoEstado(false);
    }
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

  // Marcar y filtrar después dejaría una cuenta de seleccionados que ya no
  // están en pantalla, y un botón que archiva lo que no se ve.
  const enPantalla = new Set(visibles.map((c) => c.id));
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
      const res = await eliminarEnLote("/api/mobile/clientes/eliminar", elegidos);
      setError(avisoDeLote(res, "clientes"));
      setConfirmando(false);
      setSeleccionando(false);
      setMarcados([]);
      await traer(busqueda, null, "silencioso");
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos archivar"));
      setConfirmando(false);
    } finally {
      setArchivando(false);
    }
  }

  // Sin sectores cargados el filtro no filtra nada, así que no se ofrece.
  const grupos: GrupoDeFiltro[] = [
    ...(sectores.length > 1
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
      : []),
    {
      id: "estado",
      titulo: "Estado",
      valor: estado,
      onElegir: filtrarPorEstado,
      opciones: [
        { clave: "", etiqueta: "Todos" },
        { clave: "activos", etiqueta: "Activos" },
        { clave: "inactivos", etiqueta: "Inactivos" },
      ],
    },
  ];

  return (
    <PantallaLista
      acciones={
        puedeCrear
          ? [
              {
                etiqueta: "Nuevo cliente",
                onPress: () => router.push("/(personal)/clientes/nuevo"),
              },
              ...(!seleccionando && visibles.length > 0
                ? [
                    {
                      etiqueta: "Seleccionar clientes",
                      onPress: () => setSeleccionando(true),
                    },
                  ]
                : []),
            ]
          : []
      }
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
                  ? "Prueba con otro nombre o quita los filtros."
                  : puedeCrear
                    ? "Agrega el primero desde el menú de arriba."
                    : "Todavía no hay clientes registrados."}
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
            const marcado = marcados.includes(item.id);
            return (
              <PressableScale
                // Marcando **no navega**: una fila que a veces abre la ficha y
                // a veces marca es una trampa.
                onPress={() =>
                  seleccionando
                    ? alternar(item.id)
                    : router.push(`/(personal)/clientes/${item.id}`)
                }
                estiloExterno={styles.ancho}
                style={[FILA_LISTA, marcado && styles.filaMarcada]}
              >
                {seleccionando ? (
                  <Ionicons
                    name={marcado ? "checkbox" : "square-outline"}
                    size={22}
                    color={marcado ? tema.verde : tema.texto3}
                  />
                ) : null}
                <View style={styles.avatar}>
                  <Text style={styles.avatarTexto}>{iniciales}</Text>
                </View>
                <View style={styles.texto}>
                  <View style={styles.nombreFila}>
                    <Text
                      variant="bodyLarge"
                      style={[styles.nombre, styles.nombreCrece]}
                      numberOfLines={1}
                    >
                      {nombre}
                    </Text>
                    <EstadoDelCliente inactivo={item.inactivoDesde !== null} />
                  </View>
                  <Text variant="bodySmall" style={styles.resumen} numberOfLines={1}>
                    {resumenDeCliente(item)}
                  </Text>
                </View>
              </PressableScale>
            );
          }}
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
            <Text style={styles.accionBarraTexto}>Archivar</Text>
          </PressableScale>
          {/* Con más de una acción, el resto va detrás de un ⋯ al lado. */}
          {elegidos.length > 0 && !cambiandoEstado ? (
            <MenuDeEncabezado
              oscuro
              haciaArriba
              etiqueta="Más acciones"
              opciones={[
                { etiqueta: "Marcar como inactivos", onPress: () => cambiarEstado(true) },
                { etiqueta: "Reactivar", onPress: () => cambiarEstado(false) },
              ]}
            />
          ) : null}
        </BarraSeleccion>
      ) : null}

      <DialogoConfirmar
        visible={confirmando}
        titulo={
          elegidos.length === 1
            ? "¿Archivar 1 cliente?"
            : `¿Archivar ${elegidos.length} clientes?`
        }
        detalle="Salen de las listas y de los selectores. Sus visitas, informes y facturas siguen donde están, y se pueden recuperar."
        confirmar="Archivar"
        peligro
        cargando={archivando}
        onConfirmar={archivarMarcados}
        onCancelar={() => setConfirmando(false)}
      />
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
  ancho: { alignSelf: "stretch" },
  texto: { flex: 1, gap: 1 },
  filaMarcada: { backgroundColor: tema.verde50 },
  nombre: { color: tema.texto, fontWeight: "600" },
  nombreFila: { flexDirection: "row", alignItems: "center", gap: 6 },
  nombreCrece: { flexShrink: 1 },
  resumen: { color: tema.texto3 },
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
  vacio: { alignItems: "center", paddingVertical: 48, gap: 6 },
  vacioTitulo: { color: tema.texto },
  vacioTexto: { color: tema.texto3, textAlign: "center" },
  error: { color: tema.rojo, textAlign: "center", padding: 16 },
});
