import { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import ReorderableList, { reorderItems } from "react-native-reorderable-list";
import { ActivityIndicator, Text } from "react-native-paper";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  OPCIONES_ORDEN_TAREAS,
  moverEnOrden,
  ordenarTareas,
  type DestinoDeOrden,
  type ModoOrdenTareas,
} from "@vivero/shared";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { PressableScale } from "@/components/ui/PressableScale";
import { HojaInferior } from "@/components/ui/HojaInferior";
import { FILA_LISTA, PantallaLista } from "@/components/ui/PantallaLista";
import {
  ALTO_BARRA_SELECCION,
  BarraSeleccion,
} from "@/components/ui/BarraSeleccion";
import { MoverTareas } from "@/components/MoverTareas";
import { tema } from "@/lib/tema";

interface Tarea {
  id: string;
  nombre: string;
  descripcion: string | null;
  /** Su lugar en el acomodo a mano, aunque en pantalla haya un alfabético. */
  orden: number;
}

const mismosIds = (a: Tarea[], b: Tarea[]) =>
  a.length === b.length && a.every((t, i) => t.id === b[i].id);

/**
 * El catálogo de tareas: lo que se hace en una visita.
 *
 * **Cómo está ordenado es una configuración, no una vista de esta pantalla.**
 * Vive en `EmpresaConfig` y manda también en las casillas que el jardinero
 * marca al cerrar una visita: ordenar A–Z acá y dejar el portal mostrando otra
 * cosa serían dos listas.
 *
 * Por eso **nada se guarda solo**, ni acomodar a mano ni elegir el modo: las
 * dos cosas cambian lo que ve todo el mundo. Se tocan cuantas veces haga falta
 * y arriba, en el lugar del título, esperan Cancelar y Guardar. El buscador y
 * el botón de orden se quedan donde están —uno de ellos es justamente lo que se
 * está decidiendo—.
 *
 * Acomodar son dos gestos, como en el portal: mantener apretada una fila para
 * levantarla y arrastrarla, o marcar varias y mandarlas al principio, al final
 * o a una posición escrita.
 */
export default function TareasListScreen() {
  const router = useRouter();
  /** Lo que devolvió el servidor la última vez, y en qué modo estaba. */
  const [items, setItems] = useState<Tarea[]>([]);
  const [modoServidor, setModoServidor] =
    useState<ModoOrdenTareas>("PERSONALIZADO");
  /**
   * El acomodo a mano sin confirmar. Existe **siempre**, haya o no un
   * alfabético en pantalla: volver a Personalizado lo muestra intacto.
   */
  const [personalizado, setPersonalizado] = useState<Tarea[]>([]);
  const [modo, setModo] = useState<ModoOrdenTareas>("PERSONALIZADO");
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [seleccionando, setSeleccionando] = useState(false);
  const [moviendo, setMoviendo] = useState(false);
  const [menu, setMenu] = useState(false);
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
      const res = await apiRequest<{ items: Tarea[]; orden: ModoOrdenTareas }>(
        "/api/mobile/tareas"
      );
      setItems(res.items);
      setModoServidor(res.orden);
      setPersonalizado(ordenarTareas(res.items, "PERSONALIZADO"));
      setModo(res.orden);
      setMarcadas([]);
      setSeleccionando(false);
      setError(null);
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos cargar las tareas"));
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, []);

  const ordenGuardado = useMemo(
    () => ordenarTareas(items, "PERSONALIZADO"),
    [items]
  );

  /** Lo que se ve: el acomodo a mano, o el alfabético del modo elegido. */
  const lista = useMemo(
    () => (modo === "PERSONALIZADO" ? personalizado : ordenarTareas(items, modo)),
    [modo, personalizado, items]
  );

  /*
   * El acomodo cuenta como cambio solo en Personalizado: con un alfabético en
   * pantalla, guardar posiciones que nadie está viendo sería escribir algo
   * invisible. Se queda en estado local igual, por si se vuelve.
   */
  const cambioDeOrden =
    modo === "PERSONALIZADO" && !mismosIds(personalizado, ordenGuardado);
  const hayCambios = modo !== modoServidor || cambioDeOrden;

  useFocusEffect(
    useCallback(() => {
      // Volver de crear o editar no puede pisar algo a medio confirmar.
      if (hayCambios) return;
      cargar(items.length === 0);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cargar, hayCambios])
  );

  /**
   * Elegir el modo **no guarda**, igual que arrastrar.
   *
   * Se guardaba al tocarlo, y así mirar la lista alfabética un momento
   * reescribía la configuración de todo el sistema sin preguntar.
   */
  function elegirModo(nuevo: ModoOrdenTareas) {
    setEligiendoModo(false);
    setModo(nuevo);
    // Marcar sirve para mover, y mover solo existe en Personalizado.
    if (nuevo !== "PERSONALIZADO") {
      setMarcadas([]);
      setSeleccionando(false);
    }
  }

  /** Soltar una fila mueve **solo el estado local**. */
  function alSoltar(desde: number, hasta: number) {
    setPersonalizado((actual) => reorderItems(actual, desde, hasta));
  }

  function moverMarcadas(destino: DestinoDeOrden) {
    setPersonalizado((actual) => moverEnOrden(actual, marcadas, destino));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function alternar(id: string) {
    Haptics.selectionAsync();
    setMarcadas((actuales) =>
      actuales.includes(id)
        ? actuales.filter((x) => x !== id)
        : [...actuales, id]
    );
  }

  function cancelar() {
    setPersonalizado(ordenGuardado);
    setModo(modoServidor);
    setMarcadas([]);
    setSeleccionando(false);
  }

  /**
   * Un solo *Guardar* para las dos cosas, porque son una sola decisión: cómo se
   * ve la lista.
   *
   * Acomodar a mano **es** elegir Personalizado —el servidor pone el modo en el
   * mismo movimiento—, así que cuando hay acomodo alcanza con mandarlo; si lo
   * único que cambió es el modo, va el modo.
   */
  async function guardar() {
    setGuardando(true);
    try {
      if (cambioDeOrden) {
        await apiRequest("/api/mobile/tareas/reordenar", {
          method: "POST",
          body: { ids: personalizado.map((t) => t.id) },
        });
      } else {
        await apiRequest("/api/mobile/tareas/orden", {
          method: "PUT",
          body: { modo },
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await cargar();
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos guardar el orden"));
    } finally {
      setGuardando(false);
    }
  }

  const q = busqueda.trim().toLowerCase();
  const visibles = q
    ? lista.filter((t) => t.nombre.toLowerCase().includes(q))
    : lista;

  /*
   * Acomodar solo tiene sentido en Personalizado y sin filtrar: con un
   * alfabético, guardar posiciones que la pantalla no muestra es escribir algo
   * invisible, y buscando, "llevá esta al 5" significa pasarla por encima de
   * filas que no están en pantalla.
   */
  const sePuedeAcomodar = modo === "PERSONALIZADO" && !q;
  const nombreDelModo =
    OPCIONES_ORDEN_TAREAS.find((m) => m.value === modo)?.label ?? "Orden";

  return (
    <PantallaLista
      titulo="Tareas"
      barra={
        hayCambios ? (
          <View style={styles.barra}>
            <PressableScale
              onPress={cancelar}
              disabled={guardando}
              style={styles.barraBoton}
            >
              <Text style={styles.cancelarTexto}>Cancelar</Text>
            </PressableScale>
            <PressableScale
              onPress={guardar}
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
      /* Seleccionar es un modo, y se prende desde el ⋯ del encabezado: en una
         pantalla de 375 px no hay dónde poner una casilla en cada fila sin
         gastar ese ancho para siempre. */
      accion={
        sePuedeAcomodar && !seleccionando && lista.length > 0 ? (
          <PressableScale
            onPress={() => setMenu(true)}
            style={styles.botonIcono}
            accessibilityLabel="Más acciones"
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={tema.texto2} />
          </PressableScale>
        ) : undefined
      }
      onCrear={
        seleccionando ? undefined : () => router.push("/(personal)/tareas/nueva")
      }
      etiquetaCrear="Nueva tarea"
      busqueda={busqueda}
      onBuscar={(v) => {
        setBusqueda(v);
        // Con un filtro puesto no se puede mover nada, así que una cuenta de
        // marcadas quedaría colgada sin acción.
        setMarcadas([]);
        setSeleccionando(false);
      }}
      placeholder="Buscar tarea..."
      /* Al lado del buscador y no arriba con el título: el orden es de la
         lista, igual que el filtro en las demás pantallas, y los dos juntos se
         leen como la fila de controles que son. */
      accionBusqueda={
        <PressableScale
          onPress={() => setEligiendoModo(true)}
          style={styles.botonIcono}
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
          arrastrable={sePuedeAcomodar && !seleccionando}
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
            <>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {/* El gesto no se ve: hay que decirlo una vez, donde se usa. */}
              {sePuedeAcomodar && !seleccionando && lista.length > 1 ? (
                <Text style={styles.ayuda}>
                  Mantené apretada una tarea para moverla.
                </Text>
              ) : null}
            </>
          }
          // La barra flota sobre la lista: sin esto tapa la última fila, que es
          // justo la que alguien acaba de mandar al final.
          ListFooterComponent={
            seleccionando ? <View style={{ height: ALTO_BARRA_SELECCION }} /> : null
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
              seleccionando={seleccionando}
              marcada={marcadas.includes(item.id)}
              onAlternar={() => alternar(item.id)}
              onAbrir={() => router.push(`/(personal)/tareas/${item.id}`)}
            />
          )}
        />
      )}

      {seleccionando ? (
        <BarraSeleccion
          cuantas={marcadas.length}
          onSalir={() => {
            setSeleccionando(false);
            setMarcadas([]);
          }}
        >
          <PressableScale
            onPress={() => setMoviendo(true)}
            disabled={marcadas.length === 0}
            style={[styles.accionBarra, marcadas.length === 0 && styles.apagado]}
          >
            <Text style={styles.accionBarraTexto}>Mover</Text>
          </PressableScale>
        </BarraSeleccion>
      ) : null}

      <MoverTareas
        visible={moviendo}
        cuantas={marcadas.length}
        total={lista.length}
        onCerrar={() => setMoviendo(false)}
        onMover={moverMarcadas}
      />

      <HojaInferior visible={menu} onCerrar={() => setMenu(false)}>
        <View style={styles.hoja}>
          <PressableScale
            onPress={() => {
              setMenu(false);
              setSeleccionando(true);
            }}
            estiloExterno={styles.ancho}
            style={styles.opcion}
          >
            <Ionicons name="checkbox-outline" size={20} color={tema.texto2} />
            <Text style={styles.opcionTexto}>Seleccionar tareas</Text>
          </PressableScale>
          <Text style={styles.hojaNota}>
            Para mover varias juntas al principio, al final o a una posición.
          </Text>
        </View>
      </HojaInferior>

      <HojaInferior
        visible={eligiendoModo}
        onCerrar={() => setEligiendoModo(false)}
      >
        <View style={styles.hoja}>
          <Text style={styles.hojaTitulo}>Ordenar por</Text>
          {OPCIONES_ORDEN_TAREAS.map((m) => {
            const elegido = m.value === modo;
            return (
              <PressableScale
                key={m.value}
                onPress={() => elegirModo(m.value)}
                estiloExterno={styles.ancho}
                style={[styles.opcion, elegido && styles.opcionElegida]}
              >
                <View style={styles.crece}>
                  <Text style={styles.opcionTexto}>{m.label}</Text>
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
            marcarlas en una visita. Se guarda arriba, con las demás cosas sin
            confirmar.
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
 * con una búsqueda puesta, o marcando de a varias— mantener apretado no tiene
 * que despegar nada, y una lista que a veces se mueve y a veces no confunde más
 * que una que nunca lo hace.
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
 * Una fila. Tocarla abre la tarea —o la marca, si se están eligiendo varias— y
 * mantenerla apretada la levanta para moverla, cuando la lista lo permite.
 *
 * Marcando no se arrastra: el gesto es el mismo —el dedo apoyado— y tocar tiene
 * que marcar, sin que a los 300 ms la fila se despegue sola.
 */
function Fila({
  tarea,
  posicion,
  seleccionando,
  marcada,
  onAlternar,
  onAbrir,
}: {
  tarea: Tarea;
  posicion: number | null;
  seleccionando: boolean;
  marcada: boolean;
  onAlternar: () => void;
  onAbrir: () => void;
}) {
  return (
    <View style={[FILA_LISTA, marcada && styles.filaMarcada]}>
      {seleccionando ? (
        <Ionicons
          name={marcada ? "checkbox" : "square-outline"}
          size={22}
          color={marcada ? tema.verde : tema.texto3}
        />
      ) : null}
      {posicion !== null ? (
        <Text style={styles.posicion}>{posicion}</Text>
      ) : null}
      <PressableScale
        onPress={seleccionando ? onAlternar : onAbrir}
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
      {seleccionando ? null : posicion !== null ? (
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
  filaMarcada: { backgroundColor: tema.verde50 },
  nombre: { color: tema.texto, fontWeight: "500" },
  descripcion: { color: tema.texto3 },
  posicion: {
    width: 22,
    color: tema.texto3,
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  ayuda: {
    color: tema.texto3,
    fontSize: 13,
    paddingHorizontal: 16,
    paddingTop: 10,
  },

  botonIcono: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tema.linea,
    alignItems: "center",
    justifyContent: "center",
  },

  /* La barra ocupa el lugar del título: Cancelar a la izquierda y Guardar a la
     derecha, que es donde el pulgar espera cada uno. El buscador y el botón de
     orden no se van con él. */
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

  /* Sobre la pastilla oscura: claro sobre oscuro, nunca el rojo de la casa.
     Ver la nota de `BarraSeleccion`. */
  accionBarra: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  accionBarraTexto: { color: "#fff", fontWeight: "600", fontSize: 15 },
  apagado: { opacity: 0.45 },

  hoja: { paddingHorizontal: 4, paddingBottom: 12, gap: 8 },
  hojaTitulo: {
    fontSize: 18,
    fontWeight: "700",
    color: tema.texto,
    paddingHorizontal: 10,
  },
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
  hojaNota: {
    color: tema.texto3,
    fontSize: 13,
    marginTop: 4,
    paddingHorizontal: 10,
  },

  vacio: { alignItems: "center", paddingVertical: 48, gap: 6 },
  vacioTitulo: { color: tema.texto },
  vacioTexto: { color: tema.texto3, textAlign: "center" },
  error: { color: tema.rojo, textAlign: "center", padding: 16 },
});
