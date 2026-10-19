import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { useFocusEffect, useRouter } from "expo-router";
import {
  coincideSolicitud,
  serviciosEnUnaLinea,
  type SolicitudItem,
} from "@vivero/shared";
import { apiRequest } from "@vivero/app-ui/lib/api";
import { PantallaLista } from "@vivero/app-ui/components/ui/PantallaLista";
import { fechaYHora12 } from "@vivero/app-ui/lib/hora";
import { tema } from "@vivero/app-ui/lib/tema";

type Estado = "pendientes" | "atendidas" | "todas";

interface Respuesta {
  items: SolicitudItem[];
  total: number;
  pendientes: number;
}

/**
 * Lo que los clientes pidieron desde la app: visitas, con los servicios que
 * marcaron. Llegan
 * como notificación en el momento y quedan acá hasta que alguien las marca
 * atendidas, que es lo único que se hace con ellas además de llamar.
 */
export default function SolicitudesScreen() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>("pendientes");
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const cargar = useCallback(async (e: Estado) => {
    try {
      setDatos(await apiRequest<Respuesta>("/api/mobile/solicitudes", { query: { estado: e, limit: 100 } }));
    } catch {
      setDatos((prev) => prev ?? { items: [], total: 0, pendientes: 0 });
    } finally {
      setRefrescando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar(estado);
    }, [cargar, estado])
  );

  return (
    <PantallaLista
      titulo="Solicitudes"
      // Como el portal: por quién la mandó o por lo que pide, palabra por
      // palabra, sobre las que ya están cargadas.
      busqueda={busqueda}
      onBuscar={setBusqueda}
      placeholder="Buscar por cliente o por lo que pide"
      grupos={[
        {
          id: "estado",
          titulo: "Estado",
          opciones: [
            { clave: "pendientes", etiqueta: "Pendientes" },
            { clave: "atendidas", etiqueta: "Atendidas" },
            { clave: "todas", etiqueta: "Todas" },
          ],
          valor: estado === "pendientes" ? "" : estado,
          onElegir: (v) => {
            setDatos(null);
            setEstado((v || "pendientes") as Estado);
          },
        },
      ]}
    >
      {datos === null ? (
        <View style={styles.centro}>
          <ActivityIndicator color={tema.verde} />
        </View>
      ) : (
        <FlatList
          data={datos.items.filter((s) => coincideSolicitud(s, busqueda))}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.lista}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={() => {
                setRefrescando(true);
                cargar(estado);
              }}
            />
          }
          ListEmptyComponent={
            <Text style={styles.vacio}>
              {busqueda.trim()
                ? "Ninguna solicitud coincide con la búsqueda."
                : estado === "pendientes"
                ? "No hay solicitudes pendientes."
                : "No hay solicitudes."}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/(personal)/solicitudes/${item.id}`)}
              style={({ pressed }) => [styles.fila, pressed && styles.filaTocada]}
            >
              <View style={styles.filaArriba}>
                <Text style={styles.cliente} numberOfLines={1}>
                  {item.contacto.nombre}
                  {item.cliente ? "" : " · Sin cuenta"}
                </Text>
                <Text style={styles.fecha}>{fechaYHora12(item.createdAt)}</Text>
              </View>
              <Text style={styles.tipo} numberOfLines={1}>
                {serviciosEnUnaLinea(item) ?? "Solicitud"}
                {item.atendidaEl ? " · Atendida" : ""}
              </Text>
              <Text style={styles.mensaje} numberOfLines={2}>
                {item.mensaje}
              </Text>
            </Pressable>
          )}
        />
      )}

    </PantallaLista>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  lista: { paddingBottom: 32 },
  fila: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tema.linea2,
    backgroundColor: "#fff",
  },
  filaTocada: { backgroundColor: tema.lienzo },
  filaArriba: { flexDirection: "row", alignItems: "center", gap: 8 },
  cliente: { flex: 1, color: tema.texto, fontWeight: "600", fontSize: 15 },
  fecha: { color: tema.texto3, fontSize: 12 },
  tipo: { color: tema.verde700, fontSize: 13 },
  mensaje: { color: tema.texto2 },
  vacio: { color: tema.texto3, textAlign: "center", paddingTop: 80 },
});
