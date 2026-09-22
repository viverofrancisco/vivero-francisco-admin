import { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ordenarTareas, type ModoOrdenTareas } from "@vivero/shared";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { PressableScale } from "@/components/ui/PressableScale";
import { FILA_LISTA, PantallaLista } from "@/components/ui/PantallaLista";
import { OrdenarTareas } from "@/components/OrdenarTareas";
import { tema } from "@/lib/tema";

interface Tarea {
  id: string;
  nombre: string;
  descripcion: string | null;
  /** Su lugar en el acomodo a mano, aunque en pantalla haya un alfabético. */
  orden: number;
}

/**
 * El catálogo de tareas: lo que se hace en una visita.
 *
 * **Cómo está ordenado es una configuración, no una vista de esta pantalla.**
 * Vive en `EmpresaConfig` y manda también en las casillas que el jardinero
 * marca al cerrar una visita: ordenar A–Z acá y dejar el portal mostrando otra
 * cosa serían dos listas.
 *
 * Por eso ordenar tiene **pantalla propia** (`OrdenarTareas`, el botón al lado
 * del buscador): el tipo de orden arriba, las tareas con su manija abajo, y un
 * solo Guardar. Acá la lista vuelve a ser una lista —se toca una fila y se abre
 * la tarea—, sin casillas ni barras compitiendo por el encabezado.
 */
export default function TareasListScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Tarea[]>([]);
  const [modo, setModo] = useState<ModoOrdenTareas>("PERSONALIZADO");
  const [ordenando, setOrdenando] = useState(false);
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
      cargar(items.length === 0);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cargar])
  );

  const q = busqueda.trim().toLowerCase();
  const visibles = q
    ? items.filter((t) => t.nombre.toLowerCase().includes(q))
    : items;

  return (
    <PantallaLista
      titulo="Tareas"
      acciones={[
        {
          etiqueta: "Nueva tarea",
          onPress: () => router.push("/(personal)/tareas/nueva"),
        },
      ]}
      busqueda={busqueda}
      onBuscar={setBusqueda}
      placeholder="Buscar tarea..."
      /* Al lado del buscador y no arriba con el título: el orden es de la
         lista, igual que el filtro en las demás pantallas, y los dos juntos se
         leen como la fila de controles que son. */
      accionBusqueda={
        <PressableScale
          onPress={() => setOrdenando(true)}
          style={styles.botonOrden}
          accessibilityLabel="Ordenar tareas"
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
                  ? "Prueba con otro nombre."
                  : "Agrega la primera desde el menú de arriba."}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <PressableScale
              onPress={() => router.push(`/(personal)/tareas/${item.id}`)}
              estiloExterno={styles.ancho}
              style={FILA_LISTA}
            >
              <View style={styles.crece}>
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
              </View>
              <Ionicons name="chevron-forward" size={18} color={tema.texto3} />
            </PressableScale>
          )}
        />
      )}

      {ordenando ? (
        <OrdenarTareas
          // Ordenada a mano de entrada: la pantalla de ordenar muestra el
          // acomodo guardado, no el alfabético con el que se esté viendo acá.
          tareas={ordenarTareas(items, "PERSONALIZADO")}
          modo={modo}
          onCerrar={() => setOrdenando(false)}
          onGuardado={() => {
            setOrdenando(false);
            cargar();
          }}
        />
      ) : null}
    </PantallaLista>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  crece: { flex: 1, gap: 2 },
  ancho: { alignSelf: "stretch" },
  nombre: { color: tema.texto, fontWeight: "500" },
  descripcion: { color: tema.texto3 },
  botonOrden: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tema.linea,
    alignItems: "center",
    justifyContent: "center",
  },
  vacio: { alignItems: "center", paddingVertical: 48, gap: 6 },
  vacioTitulo: { color: tema.texto },
  vacioTexto: { color: tema.texto3, textAlign: "center" },
  error: { color: tema.rojo, textAlign: "center", padding: 16 },
});
