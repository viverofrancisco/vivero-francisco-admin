import { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import ReorderableList, { reorderItems } from "react-native-reorderable-list";
import { ActivityIndicator, Text } from "react-native-paper";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { PressableScale } from "@/components/ui/PressableScale";
import { HojaInferior } from "@/components/ui/HojaInferior";
import { FILA_LISTA, PantallaLista } from "@/components/ui/PantallaLista";
import { tema } from "@/lib/tema";

interface Tarea {
  id: string;
  nombre: string;
  descripcion: string | null;
}

type Modo = "PERSONALIZADO" | "ALFABETICO_AZ" | "ALFABETICO_ZA";

const MODOS: { clave: Modo; etiqueta: string; detalle: string }[] = [
  {
    clave: "PERSONALIZADO",
    etiqueta: "Personalizado",
    detalle: "El orden que armaste a mano",
  },
  { clave: "ALFABETICO_AZ", etiqueta: "Alfabético A–Z", detalle: "Por nombre" },
  { clave: "ALFABETICO_ZA", etiqueta: "Alfabético Z–A", detalle: "Al revés" },
];

/**
 * El catálogo de tareas: lo que se hace en una visita.
 *
 * **Cómo está ordenado es una configuración, no una vista de esta pantalla.**
 * Vive en `EmpresaConfig` y manda también en las casillas que el jardinero
 * marca al cerrar una visita: ordenar A–Z acá y dejar el teléfono mostrando
 * otra cosa serían dos listas.
 *
 * Elegir el modo se guarda al tocarlo —es una sola decisión y no hay nada que
 * confirmar—, pero **acomodar a mano no**: mover diecisiete filas y que cada
 * movimiento se escriba solo deja sin manera de arrepentirse, así que las
 * flechas tocan estado local y abajo aparece Cancelar / Guardar orden. Es el
 * mismo trato que en el portal, donde se arrastra en vez de tocar flechas.
 */
export default function TareasListScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Tarea[]>([]);
  const [modo, setModo] = useState<Modo>("PERSONALIZADO");
  /** El acomodo sin guardar. `null` = no se tocó nada. */
  const [acomodo, setAcomodo] = useState<Tarea[] | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [eligiendoModo, setEligiendoModo] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (inicial = false) => {
    if (inicial) setCargando(true);
    else setRefrescando(true);
    try {
      const res = await apiRequest<{ items: Tarea[]; orden: Modo }>(
        "/api/mobile/tareas"
      );
      setItems(res.items);
      setModo(res.orden);
      setError(null);
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos cargar las tareas"));
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Volver de crear o editar no puede pisar un acomodo a medio hacer.
      if (acomodo) return;
      cargar(items.length === 0);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cargar, acomodo])
  );

  async function elegirModo(nuevo: Modo) {
    setEligiendoModo(false);
    if (nuevo === modo) return;
    const previo = modo;
    setModo(nuevo);
    try {
      await apiRequest("/api/mobile/tareas/orden", {
        method: "PUT",
        body: { modo: nuevo },
      });
      cargar();
    } catch (e) {
      // Vuelve a lo que estaba: mostrar un orden que el servidor no guardó
      // es prometer algo que la otra pantalla no va a cumplir.
      setModo(previo);
      setError(mensajeDeError(e, "No pudimos cambiar el orden"));
    }
  }

  /**
   * Soltar una fila mueve **solo el estado local**.
   *
   * Es la misma regla que en el portal: acomodar diecisiete filas y que cada
   * movimiento se escriba deja sin manera de arrepentirse. Lo que se guarda lo
   * decide el botón de arriba.
   */
  function alSoltar(desde: number, hasta: number) {
    setAcomodo(reorderItems(acomodo ?? items, desde, hasta));
  }

  async function guardarOrden() {
    if (!acomodo) return;
    setGuardando(true);
    try {
      await apiRequest("/api/mobile/tareas/reordenar", {
        method: "POST",
        body: { ids: acomodo.map((t) => t.id) },
      });
      // Acomodar **es** elegir Personalizado: lo hace el servidor, y acá se
      // refleja para que el selector no diga otra cosa.
      setModo("PERSONALIZADO");
      setItems(acomodo);
      setAcomodo(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos guardar el orden"));
    } finally {
      setGuardando(false);
    }
  }

  const lista = acomodo ?? items;
  const q = busqueda.trim().toLowerCase();
  const visibles = q
    ? lista.filter((t) => t.nombre.toLowerCase().includes(q))
    : lista;

  /*
   * Acomodar solo tiene sentido en Personalizado y sin filtrar: con un
   * alfabético, guardar posiciones que la pantalla no muestra es escribir algo
   * invisible, y buscando, "subir esta" significa pasarla por encima de filas
   * que no están en pantalla.
   */
  const sePuedeAcomodar = modo === "PERSONALIZADO" && !q;
  const nombreDelModo =
    MODOS.find((m) => m.clave === modo)?.etiqueta ?? "Orden";

  return (
    <PantallaLista
      titulo="Tareas"
      barra={
        acomodo ? (
          <View style={styles.barra}>
            <PressableScale
              onPress={() => setAcomodo(null)}
              disabled={guardando}
              style={styles.barraBoton}
            >
              <Text style={styles.cancelarTexto}>Cancelar</Text>
            </PressableScale>
            <PressableScale
              onPress={guardarOrden}
              disabled={guardando}
              style={[styles.barraBoton, styles.guardar]}
            >
              <Text style={styles.guardarTexto}>
                {guardando ? "Guardando…" : "Guardar"}
              </Text>
            </PressableScale>
          </View>
        ) : undefined
      }
      onCrear={acomodo ? undefined : () => router.push("/(personal)/tareas/nueva")}
      etiquetaCrear="Nueva tarea"
      busqueda={busqueda}
      onBuscar={setBusqueda}
      placeholder="Buscar tarea..."
      /* Al lado del buscador y no arriba con el título: el orden es de la
         lista, igual que el filtro en las demás pantallas, y los dos juntos se
         leen como la fila de controles que son. */
      accionBusqueda={
        <PressableScale
          onPress={() => setEligiendoModo(true)}
          disabled={acomodo !== null}
          style={[styles.botonOrden, acomodo !== null && styles.apagado]}
          accessibilityLabel={`Orden: ${nombreDelModo}`}
        >
          <Ionicons name="swap-vertical" size={20} color={tema.texto2} />
        </PressableScale>
      }
    >
      {cargando ? (
        <View style={styles.centro}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <Lista
          arrastrable={sePuedeAcomodar}
          data={visibles}
          keyExtractor={(t: Tarea) => t.id}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={() => cargar()}
            />
          }
          // 300 ms, los mismos que el portal: mantener apretado agarra la
          // fila, que es como reordena el sistema operativo. Menos que eso y
          // un scroll rápido se convierte en un arrastre.
          panActivateAfterLongPress={300}
          onReorder={({ from, to }: { from: number; to: number }) =>
            alSoltar(from, to)
          }
          ListHeaderComponent={
            error ? <Text style={styles.error}>{error}</Text> : null
          }
          ListEmptyComponent={
            <View style={styles.vacio}>
              <Text variant="titleMedium" style={styles.vacioTitulo}>
                {q ? "Sin coincidencias" : "No hay tareas"}
              </Text>
              <Text variant="bodyMedium" style={styles.vacioTexto}>
                {q
                  ? "Probá con otro nombre."
                  : "Agregá la primera con el botón de arriba."}
              </Text>
            </View>
          }
          renderItem={({ item, index }: { item: Tarea; index: number }) => (
            <Fila
              tarea={item}
              posicion={sePuedeAcomodar ? index + 1 : null}
              onAbrir={() => router.push(`/(personal)/tareas/${item.id}`)}
            />
          )}
        />
      )}

      <HojaInferior
        visible={eligiendoModo}
        onCerrar={() => setEligiendoModo(false)}
      >
        <View style={styles.hoja}>
          <Text style={styles.hojaTitulo}>Ordenar por</Text>
          {MODOS.map((m) => {
            const elegido = m.clave === modo;
            return (
              <PressableScale
                key={m.clave}
                onPress={() => elegirModo(m.clave)}
                estiloExterno={styles.ancho}
                style={[styles.opcion, elegido && styles.opcionElegida]}
              >
                <View style={styles.crece}>
                  <Text style={styles.opcionTexto}>{m.etiqueta}</Text>
                  <Text style={styles.opcionDetalle}>{m.detalle}</Text>
                </View>
                {elegido ? (
                  <Ionicons name="checkmark" size={20} color={tema.verde} />
                ) : null}
              </PressableScale>
            );
          })}
          <Text style={styles.hojaNota}>
            Es el orden en que se ven las tareas en todo el sistema, también al
            marcarlas en una visita.
          </Text>
        </View>
      </HojaInferior>
    </PantallaLista>
  );
}

/**
 * La lista, arrastrable o no.
 *
 * `ReorderableList` solo cuando se puede acomodar: fuera de Personalizado —o
 * con una búsqueda puesta— mantener apretado no tiene que despegar nada, y una
 * lista que a veces se mueve y a veces no confunde más que una que nunca lo
 * hace.
 */
function Lista({
  arrastrable,
  onReorder,
  panActivateAfterLongPress,
  ...props
}: {
  arrastrable: boolean;
  onReorder: (e: { from: number; to: number }) => void;
  panActivateAfterLongPress: number;
} & React.ComponentProps<typeof FlatList<Tarea>>) {
  if (!arrastrable) return <FlatList<Tarea> {...props} />;
  return (
    <ReorderableList<Tarea>
      {...props}
      data={props.data as Tarea[]}
      renderItem={props.renderItem as never}
      onReorder={onReorder}
      panActivateAfterLongPress={panActivateAfterLongPress}
    />
  );
}

/**
 * Una fila. Tocarla abre la tarea; mantenerla apretada la levanta para
 * moverla, cuando la lista lo permite.
 *
 * El gesto largo lo maneja la lista: `panActivateAfterLongPress` levanta la
 * fila que está bajo el dedo, así que acá no hay nada que enganchar. Cuando la
 * lista no es arrastrable, mantener apretado no hace nada.
 */
function Fila({
  tarea,
  posicion,
  onAbrir,
}: {
  tarea: Tarea;
  posicion: number | null;
  onAbrir: () => void;
}) {
  return (
    <View style={FILA_LISTA}>
      {posicion !== null ? (
        <Text style={styles.posicion}>{posicion}</Text>
      ) : null}
      <PressableScale
        onPress={onAbrir}
        estiloExterno={styles.crece}
        style={styles.filaTexto}
      >
        <Text variant="bodyLarge" style={styles.nombre}>
          {tarea.nombre}
        </Text>
        {tarea.descripcion ? (
          <Text variant="bodySmall" style={styles.descripcion} numberOfLines={1}>
            {tarea.descripcion}
          </Text>
        ) : null}
      </PressableScale>
      {posicion !== null ? (
        <Ionicons name="reorder-three" size={22} color={tema.texto3} />
      ) : (
        <Ionicons name="chevron-forward" size={18} color={tema.texto3} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  crece: { flex: 1 },
  filaTexto: { flex: 1, gap: 2 },
  nombre: { color: tema.texto, fontWeight: "500" },
  descripcion: { color: tema.texto3 },
  posicion: {
    width: 22,
    color: tema.texto3,
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },

  botonOrden: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tema.linea,
    alignItems: "center",
    justifyContent: "center",
  },
  /* Mientras hay un acomodo sin guardar, cambiar el modo lo tiraría a la
     basura sin avisar: el botón se queda a la vista, apagado. */
  apagado: { opacity: 0.4 },

  /* La barra ocupa el lugar del título: Cancelar a la izquierda y Guardar a la
     derecha, que es donde el pulgar espera cada uno. */
  barra: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 36,
  },
  barraBoton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  cancelarTexto: { color: tema.texto2, fontWeight: "600", fontSize: 15 },
  guardar: { backgroundColor: tema.verde },
  guardarTexto: { color: "#fff", fontWeight: "600", fontSize: 15 },

  hoja: { paddingHorizontal: 20, paddingBottom: 12, gap: 8 },
  hojaTitulo: { fontSize: 18, fontWeight: "700", color: tema.texto },
  ancho: { alignSelf: "stretch" },
  opcion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#fafafa",
  },
  opcionElegida: { backgroundColor: tema.verde50 },
  opcionTexto: { color: tema.texto, fontSize: 15, fontWeight: "600" },
  opcionDetalle: { color: tema.texto3, fontSize: 13 },
  hojaNota: { color: tema.texto3, fontSize: 13, marginTop: 4 },

  vacio: { alignItems: "center", paddingVertical: 48, gap: 6 },
  vacioTitulo: { color: tema.texto },
  vacioTexto: { color: tema.texto3, textAlign: "center" },
  error: { color: tema.rojo, textAlign: "center", padding: 16 },
});
