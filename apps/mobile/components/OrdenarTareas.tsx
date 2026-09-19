import { useMemo, useState } from "react";
import { FlatList, Modal, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import ReorderableList, { reorderItems } from "react-native-reorderable-list";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import {
  ALTO_BARRA_SELECCION,
  BarraSeleccion,
} from "@/components/ui/BarraSeleccion";
import { MoverTareas } from "@/components/MoverTareas";
import { tema } from "@/lib/tema";

export interface TareaOrdenable {
  id: string;
  nombre: string;
  orden: number;
}

const mismosIds = (a: TareaOrdenable[], b: TareaOrdenable[]) =>
  a.length === b.length && a.every((t, i) => t.id === b[i].id);

/**
 * Ordenar el catálogo: **una pantalla propia**, no un modo de la lista.
 *
 * Es la forma de Shopify: el tipo de orden arriba —siempre a la vista, para
 * poder volver a cambiarlo—, abajo las tareas con su manija y su casilla
 * mientras el orden es Personalizado, y la barra de selección flotando cuando
 * hay algo marcado.
 *
 * Estaba todo metido en la lista, y ahí cada cosa le pisaba el lugar a otra: la
 * barra de Cancelar/Guardar ocupaba el encabezado —que es donde vivía el menú
 * para marcar—, así que había que guardar para poder seguir acomodando. Acá no
 * compite con nada: la lista de atrás vuelve a ser una lista que se toca para
 * abrir una tarea.
 *
 * **Nada se guarda solo.** El tipo de orden y el acomodo se tocan cuantas veces
 * haga falta y salen juntos en un solo request: el servidor guarda los dos en
 * la misma transacción, así que o quedan las dos cosas o no queda ninguna. Y
 * acomodar a mano y después mostrar A–Z no se contradice: `Tarea.orden` guarda
 * el acomodo igual, y volver a Personalizado lo muestra intacto.
 */
export function OrdenarTareas({
  tareas,
  modo: modoGuardado,
  onCerrar,
  onGuardado,
}: {
  tareas: TareaOrdenable[];
  modo: ModoOrdenTareas;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const insets = useSafeAreaInsets();
  const ordenGuardado = useMemo(
    () => ordenarTareas(tareas, "PERSONALIZADO"),
    [tareas]
  );
  const [personalizado, setPersonalizado] = useState(ordenGuardado);
  const [modo, setModo] = useState(modoGuardado);
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [eligiendoModo, setEligiendoModo] = useState(false);
  const [moviendo, setMoviendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lista = useMemo(
    () =>
      modo === "PERSONALIZADO" ? personalizado : ordenarTareas(tareas, modo),
    [modo, personalizado, tareas]
  );
  const hayCambios =
    modo !== modoGuardado || !mismosIds(personalizado, ordenGuardado);
  const acomodable = modo === "PERSONALIZADO";
  const nombreDelModo =
    OPCIONES_ORDEN_TAREAS.find((m) => m.value === modo)?.label ?? "Orden";

  function elegirModo(nuevo: ModoOrdenTareas) {
    setEligiendoModo(false);
    setModo(nuevo);
    // Marcar sirve para mover, y mover solo existe en Personalizado.
    if (nuevo !== "PERSONALIZADO") setMarcadas([]);
  }

  function alternar(id: string) {
    Haptics.selectionAsync();
    setMarcadas((actuales) =>
      actuales.includes(id)
        ? actuales.filter((x) => x !== id)
        : [...actuales, id]
    );
  }

  function moverMarcadas(destino: DestinoDeOrden) {
    setPersonalizado((actual) => moverEnOrden(actual, marcadas, destino));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  async function guardar() {
    setGuardando(true);
    try {
      // Un solo request con las dos cosas. Si lo único que cambió es el tipo de
      // orden no hace falta mandar la lista entera.
      if (!mismosIds(personalizado, ordenGuardado)) {
        await apiRequest("/api/mobile/tareas/reordenar", {
          method: "POST",
          body: { ids: personalizado.map((t) => t.id), modo },
        });
      } else {
        await apiRequest("/api/mobile/tareas/orden", {
          method: "PUT",
          body: { modo },
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onGuardado();
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos guardar el orden"));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCerrar}
    >
      {/* Adentro de un `Modal` los gestos necesitan su propia raíz, o la fila no
          se despega del dedo. */}
      <GestureHandlerRootView style={styles.pantalla}>
        <View style={styles.cabecera}>
          <PressableScale
            onPress={onCerrar}
            disabled={guardando}
            style={styles.cerrar}
            accessibilityLabel="Cerrar"
          >
            <Ionicons name="close" size={22} color={tema.texto2} />
          </PressableScale>
          <Text style={styles.titulo}>Ordenar tareas</Text>
          <PressableScale
            onPress={guardar}
            disabled={!hayCambios || guardando}
            style={[styles.guardar, !hayCambios && styles.apagado]}
          >
            <Text style={styles.guardarTexto}>
              {guardando ? "Guardando…" : "Guardar"}
            </Text>
          </PressableScale>
        </View>

        {/* El tipo de orden, arriba y siempre a la vista: se cambia, se mira
            cómo queda y se vuelve a cambiar sin salir de acá. */}
        <PressableScale
          onPress={() => setEligiendoModo(true)}
          estiloExterno={styles.ancho}
          style={styles.filaModo}
        >
          <View style={styles.crece}>
            <Text style={styles.modoEtiqueta}>Orden de la lista</Text>
            <Text style={styles.modoValor}>{nombreDelModo}</Text>
          </View>
          <Ionicons name="chevron-down" size={18} color={tema.texto3} />
        </PressableScale>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Lista
          arrastrable={acomodable}
          data={lista}
          keyExtractor={(t: TareaOrdenable) => t.id}
          panActivateAfterLongPress={300}
          onReorder={({ from, to }: { from: number; to: number }) =>
            setPersonalizado((actual) => reorderItems(actual, from, to))
          }
          ListFooterComponent={
            <View
              style={{
                height:
                  (marcadas.length > 0 ? ALTO_BARRA_SELECCION : 0) +
                  Math.max(insets.bottom, 12),
              }}
            />
          }
          ListEmptyComponent={
            <Text style={styles.vacio}>Todavía no hay tareas.</Text>
          }
          renderItem={({
            item,
            index,
          }: {
            item: TareaOrdenable;
            index: number;
          }) => (
            <Fila
              tarea={item}
              posicion={index + 1}
              acomodable={acomodable}
              marcada={marcadas.includes(item.id)}
              onAlternar={() => alternar(item.id)}
            />
          )}
        />

        {marcadas.length > 0 ? (
          <BarraSeleccion cuantas={marcadas.length} onSalir={() => setMarcadas([])}>
            <PressableScale
              onPress={() => setMoviendo(true)}
              style={styles.accionBarra}
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
              marcarlas en una visita.
            </Text>
          </View>
        </HojaInferior>
      </GestureHandlerRootView>
    </Modal>
  );
}

/** La lista, arrastrable solo con el orden personalizado puesto. */
function Lista({
  arrastrable,
  onReorder,
  panActivateAfterLongPress,
  ...props
}: {
  arrastrable: boolean;
  onReorder: (e: { from: number; to: number }) => void;
  panActivateAfterLongPress: number;
} & React.ComponentProps<typeof FlatList<TareaOrdenable>>) {
  if (!arrastrable) return <FlatList<TareaOrdenable> {...props} />;
  return (
    <ReorderableList<TareaOrdenable>
      {...props}
      data={props.data as TareaOrdenable[]}
      renderItem={props.renderItem as never}
      onReorder={onReorder}
      panActivateAfterLongPress={panActivateAfterLongPress}
    />
  );
}

/**
 * Una fila de acá **no abre la tarea**: esta pantalla es para ordenar. Tocarla
 * la marca, mantenerla apretada la levanta para moverla.
 */
function Fila({
  tarea,
  posicion,
  acomodable,
  marcada,
  onAlternar,
}: {
  tarea: TareaOrdenable;
  posicion: number;
  acomodable: boolean;
  marcada: boolean;
  onAlternar: () => void;
}) {
  if (!acomodable) {
    return (
      <View style={styles.fila}>
        <Text style={styles.posicion}>{posicion}</Text>
        <Text style={styles.nombre}>{tarea.nombre}</Text>
      </View>
    );
  }
  return (
    <PressableScale
      onPress={onAlternar}
      estiloExterno={styles.ancho}
      style={[styles.fila, marcada && styles.filaMarcada]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcada }}
    >
      <Ionicons
        name={marcada ? "checkbox" : "square-outline"}
        size={22}
        color={marcada ? tema.verde : tema.texto3}
      />
      <Text style={styles.posicion}>{posicion}</Text>
      <Text style={styles.nombre}>{tarea.nombre}</Text>
      <Ionicons name="reorder-three" size={22} color={tema.texto3} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.superficie },
  crece: { flex: 1 },
  ancho: { alignSelf: "stretch" },

  cabecera: {
    height: 60,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tema.linea,
  },
  cerrar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  titulo: { flex: 1, fontSize: 17, fontWeight: "700", color: tema.texto },
  guardar: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: tema.verde,
  },
  guardarTexto: { color: "#fff", fontWeight: "600", fontSize: 15 },
  apagado: { opacity: 0.4 },

  filaModo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tema.linea,
    backgroundColor: tema.fondo,
  },
  modoEtiqueta: { color: tema.texto3, fontSize: 12 },
  modoValor: { color: tema.texto, fontSize: 15, fontWeight: "600" },

  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tema.linea,
    backgroundColor: tema.superficie,
  },
  filaMarcada: { backgroundColor: tema.verde50 },
  posicion: {
    width: 22,
    color: tema.texto3,
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  nombre: { flex: 1, color: tema.texto, fontSize: 15, fontWeight: "500" },
  vacio: { color: tema.texto3, textAlign: "center", padding: 24 },
  error: { color: tema.rojo, textAlign: "center", padding: 12 },

  accionBarra: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  accionBarraTexto: { color: "#fff", fontWeight: "600", fontSize: 15 },

  hoja: { paddingHorizontal: 4, paddingBottom: 12, gap: 8 },
  hojaTitulo: {
    fontSize: 18,
    fontWeight: "700",
    color: tema.texto,
    paddingHorizontal: 10,
  },
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
});
