import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { Button, Text } from "react-native-paper";
import { useFocusEffect, useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import {
  coincideSolicitud,
  fechaSola,
  serviciosEnUnaLinea,
  type SolicitudItem,
} from "@vivero/shared";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { PantallaLista } from "@/components/ui/PantallaLista";
import { HojaInferior } from "@/components/ui/HojaInferior";
import { fechaYHora12 } from "@/lib/hora";
import { tema } from "@/lib/tema";

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
  const [abierta, setAbierta] = useState<SolicitudItem | null>(null);
  const [guardando, setGuardando] = useState(false);

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

  async function marcar(s: SolicitudItem, atendida: boolean) {
    setGuardando(true);
    try {
      await apiRequest(`/api/mobile/solicitudes/${s.id}`, {
        method: "PATCH",
        body: { atendida },
      });
      setAbierta(null);
      cargar(estado);
    } catch (e) {
      Alert.alert("No se pudo guardar", mensajeDeError(e, "Intenta de nuevo."));
    } finally {
      setGuardando(false);
    }
  }

  /** La visita, desde la solicitud: cierra la hoja y abre el asistente con
   *  su cliente y su propiedad puestos. La de un invitado llega sin cliente,
   *  y el asistente arranca en *Cliente nuevo* con sus datos. */
  function abrirAsistente(s: SolicitudItem) {
    setAbierta(null);
    // La hoja se cierra antes de navegar: un modal que se está yendo tapa
    // la pantalla que se abre encima.
    setTimeout(
      () =>
        router.push({
          pathname: "/(personal)/visitas/nueva",
          params: {
            solicitud: s.id,
            cliente: s.cliente?.id ?? "",
            propiedad: s.propiedad?.id ?? "",
          },
        }),
      250
    );
  }

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
              onPress={() => setAbierta(item)}
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

      <HojaInferior visible={abierta !== null} onCerrar={() => setAbierta(null)}>
        {abierta ? (
          <View style={styles.hoja}>
            <Text style={styles.hojaTitulo}>
              Solicitud #{abierta.numero}
            </Text>
            <Text style={styles.hojaCliente}>{abierta.contacto.nombre}</Text>
            {abierta.cliente ? null : (
              <Text style={styles.hojaDato}>Sin cuenta: la mandó desde el modo invitado</Text>
            )}
            <Text style={styles.fecha}>{fechaYHora12(abierta.createdAt)}</Text>
            {/* El orden del formulario del cliente: servicios, número,
                detalles, archivos y dónde. */}
            {abierta.servicios.length ? (
              <Text style={styles.tipo}>{serviciosEnUnaLinea(abierta)}</Text>
            ) : null}
            {abierta.contacto.telefono ? (
              <Text
                style={styles.enlace}
                onPress={() => Linking.openURL(`tel:${abierta.contacto.telefono}`)}
              >
                {abierta.contacto.telefono}
              </Text>
            ) : null}
            {abierta.contacto.email ? (
              <Text
                style={styles.hojaDato}
                onPress={() => Linking.openURL(`mailto:${abierta.contacto.email}`)}
              >
                {abierta.contacto.email}
              </Text>
            ) : null}
            <Text style={styles.hojaMensaje}>{abierta.mensaje}</Text>
            {abierta.adjuntos.length ? (
              <View style={styles.adjuntos}>
                {abierta.adjuntos.map((a) => (
                  <Pressable
                    key={a.id}
                    onPress={() => Linking.openURL(a.url)}
                    style={({ pressed }) => [styles.adjunto, pressed && styles.filaTocada]}
                  >
                    {a.tipo === "video" ? (
                      <View style={[styles.adjuntoImagen, styles.video]}>
                        <Ionicons name="play" size={18} color="#fff" />
                      </View>
                    ) : (
                      <Image source={{ uri: a.url }} style={styles.adjuntoImagen} contentFit="cover" />
                    )}
                  </Pressable>
                ))}
              </View>
            ) : null}
            {abierta.direccion || abierta.propiedad ? (
              <Text style={styles.hojaDato}>
                Dónde: {[abierta.propiedad?.nombre, abierta.direccion].filter(Boolean).join(" · ")}
              </Text>
            ) : null}
            {abierta.lat !== null && abierta.lng !== null ? (
              <Text
                style={styles.enlace}
                onPress={() =>
                  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${abierta.lat},${abierta.lng}`)
                }
              >
                Ver en el mapa
              </Text>
            ) : null}
            {abierta.visitas.length > 0 ? (
              <Text style={styles.hojaDato}>
                {abierta.visitas.length === 1 ? "Visita: " : "Visitas: "}
                {abierta.visitas.map((v, i) => (
                  <Text
                    key={v.id}
                    style={styles.enlace}
                    onPress={() => {
                      setAbierta(null);
                      router.push(`/(personal)/visitas/${v.id}`);
                    }}
                  >
                    {i > 0 ? ", " : ""}#{v.numero} · {fechaSola(v.fechaProgramada)}
                  </Text>
                ))}
              </Text>
            ) : null}
            {abierta.cliente ? null : (
              <Text style={styles.hojaDato}>
                La mandó sin cuenta: al crear la visita se le crea su ficha con estos datos.
              </Text>
            )}
            {abierta.atendidaEl ? (
              <Text style={styles.hojaDato}>
                Atendida {fechaYHora12(abierta.atendidaEl)}
                {abierta.atendidaPorNombre ? ` por ${abierta.atendidaPorNombre}` : ""}
              </Text>
            ) : null}

            <View style={styles.botones}>
              <Button
                mode="contained"
                loading={guardando}
                disabled={guardando}
                onPress={() => marcar(abierta, !abierta.atendidaEl)}
              >
                {abierta.atendidaEl ? "Volver a pendiente" : "Marcar atendida"}
              </Button>
              <Button mode="outlined" onPress={() => abrirAsistente(abierta)}>
                Crear visita
              </Button>
              {abierta.cliente ? (
                <Button
                  mode="outlined"
                  onPress={() => {
                    const id = abierta.cliente?.id;
                    setAbierta(null);
                    if (id) router.push(`/(personal)/clientes/${id}`);
                  }}
                >
                  Ver cliente
                </Button>
              ) : null}
            </View>
          </View>
        ) : null}
      </HojaInferior>
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
  hoja: { padding: 16, gap: 6 },
  hojaTitulo: { color: tema.texto3, fontSize: 13 },
  hojaCliente: { color: tema.texto, fontSize: 20, fontWeight: "700" },
  hojaMensaje: { color: tema.texto, fontSize: 15, lineHeight: 22, marginTop: 6 },
  hojaDato: { color: tema.texto2 },
  enlace: { color: tema.verde700, fontWeight: "600", paddingVertical: 2 },
  botones: { gap: 8, marginTop: 14 },
  adjuntos: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  adjunto: { width: 64, height: 64, borderRadius: 8, overflow: "hidden" },
  adjuntoImagen: { width: "100%", height: "100%", backgroundColor: tema.lienzo },
  video: { backgroundColor: "#222", alignItems: "center", justifyContent: "center" },
});
