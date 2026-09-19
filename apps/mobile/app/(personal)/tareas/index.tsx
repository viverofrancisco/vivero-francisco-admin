import { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
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

  function mover(desde: number, hacia: number) {
    const base = acomodo ?? items;
    if (hacia < 0 || hacia >= base.length) return;
    const copia = [...base];
    const [fila] = copia.splice(desde, 1);
    copia.splice(hacia, 0, fila);
    Haptics.selectionAsync();
    setAcomodo(copia);
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
      onCrear={acomodo ? undefined : () => router.push("/(personal)/tareas/nueva")}
      etiquetaCrear="Nueva tarea"
      accion={
        acomodo ? null : (
          <PressableScale
            onPress={() => setEligiendoModo(true)}
            style={styles.botonOrden}
            accessibilityLabel={`Orden: ${nombreDelModo}`}
          >
            <Ionicons name="swap-vertical" size={18} color={tema.texto2} />
          </PressableScale>
        )
      }
      busqueda={busqueda}
      onBuscar={setBusqueda}
      placeholder="Buscar tarea..."
    >
      {cargando ? (
        <View style={styles.centro}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={visibles}
          keyExtractor={(t) => t.id}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={() => cargar()}
            />
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
          renderItem={({ item, index }) => (
            <View style={FILA_LISTA}>
              {sePuedeAcomodar ? (
                <Text style={styles.posicion}>{index + 1}</Text>
              ) : null}
              <PressableScale
                onPress={() => router.push(`/(personal)/tareas/${item.id}`)}
                estiloExterno={styles.crece}
                style={styles.filaTexto}
              >
                <Text variant="bodyLarge" style={styles.nombre}>
                  {item.nombre}
                </Text>
                {item.descripcion ? (
                  <Text
                    variant="bodySmall"
                    style={styles.descripcion}
                    numberOfLines={1}
                  >
                    {item.descripcion}
                  </Text>
                ) : null}
              </PressableScale>

              {sePuedeAcomodar ? (
                <View style={styles.flechas}>
                  <PressableScale
                    onPress={() => mover(index, index - 1)}
                    disabled={index === 0}
                    style={[styles.flecha, index === 0 && styles.flechaApagada]}
                    accessibilityLabel="Subir"
                  >
                    <Ionicons name="chevron-up" size={18} color={tema.texto2} />
                  </PressableScale>
                  <PressableScale
                    onPress={() => mover(index, index + 1)}
                    disabled={index === visibles.length - 1}
                    style={[
                      styles.flecha,
                      index === visibles.length - 1 && styles.flechaApagada,
                    ]}
                    accessibilityLabel="Bajar"
                  >
                    <Ionicons name="chevron-down" size={18} color={tema.texto2} />
                  </PressableScale>
                </View>
              ) : (
                <Ionicons name="chevron-forward" size={18} color={tema.texto3} />
              )}
            </View>
          )}
        />
      )}

      {/* Mientras hay un acomodo sin guardar, la barra es lo único que importa:
          se queda abajo, tapando la lista lo mínimo, hasta que se decida. */}
      {acomodo ? (
        <View style={styles.barra}>
          <PressableScale
            onPress={() => setAcomodo(null)}
            disabled={guardando}
            estiloExterno={styles.mitad}
            style={styles.cancelar}
          >
            <Text style={styles.cancelarTexto}>Cancelar</Text>
          </PressableScale>
          <PressableScale
            onPress={guardarOrden}
            disabled={guardando}
            estiloExterno={styles.mitad}
            style={styles.guardar}
          >
            <Text style={styles.guardarTexto}>
              {guardando ? "Guardando…" : "Guardar orden"}
            </Text>
          </PressableScale>
        </View>
      ) : null}

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
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tema.linea,
    alignItems: "center",
    justifyContent: "center",
  },

  flechas: { flexDirection: "row", gap: 2 },
  flecha: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tema.lienzo,
  },
  flechaApagada: { opacity: 0.35 },

  barra: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: 12,
    padding: 12,
    backgroundColor: tema.superficie,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tema.linea,
  },
  mitad: { flex: 1 },
  cancelar: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tema.linea,
  },
  cancelarTexto: { color: tema.texto2, fontWeight: "600" },
  guardar: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: tema.verde,
  },
  guardarTexto: { color: "#fff", fontWeight: "600" },

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
