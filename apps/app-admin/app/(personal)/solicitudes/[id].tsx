import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Button, Text } from "react-native-paper";
import { MenuDeEncabezado } from "@vivero/app-ui/components/ui/MenuDeEncabezado";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { fechaSola, nombresDeServicios, type SolicitudItem } from "@vivero/shared";
import { apiRequest, mensajeDeError } from "@vivero/app-ui/lib/api";
import { fechaYHora12 } from "@vivero/app-ui/lib/hora";
import { EncabezadoDeFicha } from "@vivero/app-ui/components/ui/EncabezadoDeFicha";
import { MiniaturasDeAdjuntos } from "@vivero/app-ui/components/MiniaturasDeAdjuntos";
import { tema } from "@vivero/app-ui/lib/tema";

/**
 * Una solicitud, en su pantalla: quién la mandó —con su número para llamar—,
 * y en el orden del formulario del cliente los servicios, los detalles, las
 * fotos o videos (que se abren en la app) y dónde; luego las visitas que
 * salieron de ella y si ya se atendió. *Marcar atendida* y *Crear visita*
 * van en el ⋯ del encabezado. Era una hoja que subía sobre la lista, y con fotos y cuatro
 * botones no entraba.
 */
export default function SolicitudScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [s, setS] = useState<SolicitudItem | null>(null);
  const [error, setError] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setS(await apiRequest<SolicitudItem>(`/api/mobile/solicitudes/${id}`));
      setError(false);
    } catch {
      setError(true);
    } finally {
      setRefrescando(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void cargar();
    }, [cargar])
  );

  async function marcar(atendida: boolean) {
    setGuardando(true);
    try {
      await apiRequest(`/api/mobile/solicitudes/${id}`, { method: "PATCH", body: { atendida } });
      await cargar();
    } catch (e) {
      Alert.alert("No se pudo guardar", mensajeDeError(e, "Intenta de nuevo."));
    } finally {
      setGuardando(false);
    }
  }

  if (!s) {
    return (
      <View style={styles.pantalla}>
        <EncabezadoDeFicha titulo="Solicitud" />
        <View style={styles.centro}>
          {error ? (
            <>
              <Text style={styles.texto2}>No pudimos cargar la solicitud.</Text>
              <Button onPress={() => void cargar()}>Reintentar</Button>
            </>
          ) : (
            <ActivityIndicator color={tema.verde} />
          )}
        </View>
      </View>
    );
  }

  const servicios = nombresDeServicios(s);
  const donde = [s.propiedad?.nombre, s.direccion].filter(Boolean).join(" · ");
  const clienteId = s.cliente?.id;

  return (
    <View style={styles.pantalla}>
      <EncabezadoDeFicha
        titulo={`Solicitud #${s.numero}`}
        derecha={
          guardando ? (
            <ActivityIndicator color={tema.verde} />
          ) : (
            <MenuDeEncabezado
              opciones={[
                {
                  etiqueta: s.atendidaEl ? "Volver a pendiente" : "Marcar atendida",
                  onPress: () => void marcar(!s.atendidaEl),
                },
                // El asistente con su cliente y su propiedad puestos; la de
                // un invitado arranca en *Cliente nuevo* con sus datos.
                {
                  etiqueta: "Crear visita",
                  onPress: () =>
                    router.push({
                      pathname: "/(personal)/visitas/nueva",
                      params: { solicitud: s.id, cliente: s.cliente?.id ?? "", propiedad: s.propiedad?.id ?? "" },
                    }),
                },
              ]}
            />
          )
        }
      />
      <ScrollView
        contentContainerStyle={styles.cuerpo}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={() => {
              setRefrescando(true);
              void cargar();
            }}
          />
        }
      >
        <View style={styles.estadoFila}>
          <Text style={styles.fecha}>Enviada {fechaYHora12(s.createdAt)}</Text>
          <View style={[styles.pastilla, s.atendidaEl ? styles.atendida : styles.pendiente]}>
            <Text style={[styles.pastillaTexto, { color: s.atendidaEl ? tema.verde700 : tema.ambarTexto }]}>
              {s.atendidaEl ? "Atendida" : "Pendiente"}
            </Text>
          </View>
        </View>

        <Text style={styles.rotulo}>CLIENTE</Text>
        <View style={styles.caja}>
          <Pressable
            disabled={!clienteId}
            onPress={() => clienteId && router.push(`/(personal)/clientes/${clienteId}`)}
            style={({ pressed }) => [styles.linea, pressed && styles.tocada]}
          >
            <View style={styles.flex}>
              <Text style={[styles.lineaTexto, styles.negrita]}>{s.contacto.nombre}</Text>
              {clienteId ? null : (
                <Text style={styles.texto3}>
                  Sin cuenta: al crear la visita se le crea su ficha con estos datos
                </Text>
              )}
            </View>
            {clienteId ? <Ionicons name="chevron-forward" size={16} color={tema.texto3} /> : null}
          </Pressable>
          {s.contacto.telefono ? (
            <Pressable
              onPress={() => Linking.openURL(`tel:${s.contacto.telefono}`)}
              style={({ pressed }) => [styles.linea, styles.divisor, pressed && styles.tocada]}
            >
              <Ionicons name="call-outline" size={18} color={tema.verde700} />
              <Text style={[styles.lineaTexto, styles.enlace]}>{s.contacto.telefono}</Text>
            </Pressable>
          ) : null}
          {s.contacto.email ? (
            <Pressable
              onPress={() => Linking.openURL(`mailto:${s.contacto.email}`)}
              style={({ pressed }) => [styles.linea, styles.divisor, pressed && styles.tocada]}
            >
              <Ionicons name="mail-outline" size={18} color={tema.texto2} />
              <Text style={styles.lineaTexto}>{s.contacto.email}</Text>
            </Pressable>
          ) : null}
        </View>

        {servicios.length ? (
          <>
            <Text style={styles.rotulo}>SERVICIOS</Text>
            <View style={styles.caja}>
              {servicios.map((nombre, i) => (
                <View key={nombre} style={[styles.linea, i > 0 && styles.divisor]}>
                  <Text style={[styles.lineaTexto, styles.negrita]}>{nombre}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <Text style={styles.rotulo}>DETALLES</Text>
        <View style={styles.caja}>
          <View style={styles.linea}>
            <Text style={styles.lineaTexto}>{s.mensaje}</Text>
          </View>
        </View>

        {s.adjuntos.length ? (
          <>
            <Text style={styles.rotulo}>FOTOS O VIDEOS</Text>
            <MiniaturasDeAdjuntos adjuntos={s.adjuntos} />
          </>
        ) : null}

        {donde ? (
          <>
            <Text style={styles.rotulo}>DÓNDE</Text>
            <View style={styles.caja}>
              <View style={styles.linea}>
                <Text style={styles.lineaTexto}>{donde}</Text>
              </View>
              {s.lat !== null && s.lng !== null ? (
                <Pressable
                  onPress={() =>
                    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`)
                  }
                  style={({ pressed }) => [styles.linea, styles.divisor, pressed && styles.tocada]}
                >
                  <Text style={styles.enlace}>Ver en el mapa</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : null}

        {s.visitas.length > 0 ? (
          <>
            <Text style={styles.rotulo}>{s.visitas.length === 1 ? "VISITA" : "VISITAS"}</Text>
            <View style={styles.caja}>
              {s.visitas.map((v, i) => (
                <Pressable
                  key={v.id}
                  onPress={() => router.push(`/(personal)/visitas/${v.id}`)}
                  style={({ pressed }) => [styles.linea, i > 0 && styles.divisor, pressed && styles.tocada]}
                >
                  <Text style={styles.lineaTexto}>
                    #{v.numero} · {fechaSola(v.fechaProgramada)}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={tema.texto3} />
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {s.atendidaEl ? (
          <Text style={[styles.texto3, styles.atendidaTexto]}>
            Atendida {fechaYHora12(s.atendidaEl)}
            {s.atendidaPorNombre ? ` por ${s.atendidaPorNombre}` : ""}
          </Text>
        ) : null}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: "#fff" },
  flex: { flex: 1 },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  cuerpo: { padding: 16, paddingBottom: 40, gap: 6 },
  fecha: { color: tema.texto3, fontSize: 13 },
  rotulo: { color: tema.texto3, fontSize: 11, letterSpacing: 0.8, paddingLeft: 4, marginTop: 12 },
  caja: { backgroundColor: tema.fondo, borderRadius: 12, paddingHorizontal: 14 },
  linea: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  divisor: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tema.linea },
  tocada: { opacity: 0.6 },
  lineaTexto: { color: tema.texto, flex: 1, lineHeight: 21 },
  negrita: { fontWeight: "600" },
  enlace: { color: tema.verde700, fontWeight: "600" },
  texto2: { color: tema.texto2 },
  texto3: { color: tema.texto3, fontSize: 13 },
  atendidaTexto: { marginTop: 12, paddingLeft: 4 },
  estadoFila: { flexDirection: "row", alignItems: "center", gap: 8 },
  pastilla: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  pendiente: { backgroundColor: tema.ambar50 },
  atendida: { backgroundColor: tema.verde50 },
  pastillaTexto: { fontSize: 12, fontWeight: "600" },
});
