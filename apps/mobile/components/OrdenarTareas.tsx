import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, View } from "react-native";
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
  const [desplegado, setDesplegado] = useState(false);
  /** Dónde termina el renglón del tipo de orden: de ahí cuelga el desplegable. */
  const [ancla, setAncla] = useState(0);
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
    setDesplegado(false);
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
      // El botón de atrás cierra primero el desplegable, que es lo último que
      // se abrió; recién después, la pantalla.
      onRequestClose={() => (desplegado ? setDesplegado(false) : onCerrar())}
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
            <Ionicons name="close-outline" size={18} color={tema.texto2} />
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
            cómo queda y se vuelve a cambiar sin salir de acá.
            Es un desplegable anclado a su renglón —el de Shopify— y no un
            cajón desde abajo: un cajón adentro de esta pantalla se apilaba
            sobre lo único que podía cerrarlo, y quedaba sin salida más que
            elegir una opción. */}
        <PressableScale
          onPress={() => setDesplegado((v) => !v)}
          onLayout={(e) =>
            setAncla(e.nativeEvent.layout.y + e.nativeEvent.layout.height)
          }
          estiloExterno={styles.ancho}
          style={styles.filaModo}
          accessibilityRole="button"
          accessibilityState={{ expanded: desplegado }}
        >
          <View style={styles.crece}>
            <Text style={styles.modoEtiqueta}>Orden de la lista</Text>
            <Text style={styles.modoValor}>{nombreDelModo}</Text>
          </View>
          <Ionicons
            name={desplegado ? "chevron-up" : "chevron-down"}
            size={18}
            color={tema.texto3}
          />
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

        {desplegado ? (
          <>
            {/* Tocar afuera cierra, que es lo que hace un desplegable. */}
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setDesplegado(false)}
            />
            <View style={[styles.menu, { top: ancla }]}>
              {OPCIONES_ORDEN_TAREAS.map((m) => {
                const elegido = m.value === modo;
                return (
                  <PressableScale
                    key={m.value}
                    onPress={() => elegirModo(m.value)}
                    estiloExterno={styles.ancho}
                    style={styles.opcion}
                    estiloPresionado={styles.opcionPresionada}
                  >
                    <View style={styles.crece}>
                      <Text style={styles.opcionTexto}>{m.label}</Text>
                      <Text style={styles.opcionDetalle}>{m.detalle}</Text>
                    </View>
                    {elegido ? (
                      <Ionicons name="checkmark" size={18} color={tema.verde} />
                    ) : null}
                  </PressableScale>
                );
              })}
              <Text style={styles.menuNota}>
                Es el orden en que se ven las tareas en todo el sistema, también
                al marcarlas en una visita.
              </Text>
            </View>
          </>
        ) : null}
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
    paddingLeft: 8,
    paddingRight: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tema.linea,
  },
  // La ✕ de toda hoja: 36 de círculo, el ícono en 18 (`CabeceraDeHoja`).
  cerrar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tema.lienzo,
  },
  titulo: { flex: 1, fontSize: 17, fontWeight: "700", color: tema.texto },
  /* Los mismos números que el botón Crear de las listas: 30 de alto, 12 de
     costado, 13 semibold. Era más grande y más alto que todo lo que tiene al
     lado, y quedaba pegado al borde. */
  guardar: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tema.verde,
  },
  guardarTexto: { color: "#fff", fontWeight: "600", fontSize: 13 },
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

  /* Claro sobre oscuro, nunca el rojo de la casa —ver la nota de
     `BarraSeleccion`—, y del alto del botón de guardar: la pastilla flota
     sobre la última fila, así que cada píxel de más tapa lista. */
  accionBarra: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  accionBarraTexto: { color: "#fff", fontWeight: "600", fontSize: 14 },

  /* Colgado del renglón, como el desplegable de Shopify: pegado a su borde de
     abajo y del ancho de la pantalla menos un margen. */
  menu: {
    position: "absolute",
    left: 12,
    right: 12,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tema.linea,
    backgroundColor: tema.superficie,
    shadowColor: "#142819",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  opcion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 10,
  },
  opcionPresionada: { backgroundColor: tema.lienzo },
  opcionTexto: { color: tema.texto, fontSize: 15, fontWeight: "500" },
  opcionDetalle: { color: tema.texto3, fontSize: 13 },
  menuNota: {
    color: tema.texto3,
    fontSize: 12,
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 8,
  },
});
