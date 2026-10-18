import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Button, Text } from "react-native-paper";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import {
  fechaSolaCapitalizada,
  nombresDeServicios,
  type SolicitudItem,
} from "@vivero/shared";
import { apiRequest } from "@vivero/app-ui/lib/api";
import { fechaYHora12 } from "@vivero/app-ui/lib/hora";
import { estadoLabel } from "@vivero/app-ui/lib/estado-visita";
import { EncabezadoDeFicha } from "@vivero/app-ui/components/ui/EncabezadoDeFicha";
import { tema } from "@vivero/app-ui/lib/tema";

/** *Pendiente* o *Atendida*, la misma pastilla de la lista. */
export function EstadoSolicitud({ atendida }: { atendida: boolean }) {
  return (
    <View style={[styles.pastilla, atendida ? styles.atendida : styles.pendiente]}>
      <Text style={[styles.pastillaTexto, { color: atendida ? tema.verde700 : tema.ambarTexto }]}>
        {atendida ? "Atendida" : "Pendiente"}
      </Text>
    </View>
  );
}

/**
 * Lo que el cliente pidió, tal como lo mandó, y en qué quedó: si un asesor ya
 * lo atendió y qué visitas salieron de ahí, que se abren desde acá. Es la
 * respuesta a "¿me vieron la solicitud?" sin tener que llamar.
 */
export function FichaDeSolicitud({ id }: { id: string }) {
  const router = useRouter();
  const [s, setS] = useState<SolicitudItem | null>(null);
  const [error, setError] = useState(false);
  const [refrescando, setRefrescando] = useState(false);

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

  const queSigue = !s.atendidaEl
    ? "Un asesor se pondrá en contacto contigo pronto para coordinar."
    : s.visitas.length > 0
      ? s.visitas.length === 1
        ? "Ya te agendamos la visita."
        : "Ya te agendamos las visitas."
      : "Un asesor ya atendió tu solicitud.";
  const donde = [s.propiedad?.nombre, s.direccion].filter(Boolean).join(" · ");

  return (
    <View style={styles.pantalla}>
      <EncabezadoDeFicha
        titulo={`Solicitud #${s.numero}`}
        derecha={<EstadoSolicitud atendida={!!s.atendidaEl} />}
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
        <Text style={styles.fecha}>Enviada {fechaYHora12(s.createdAt)}</Text>
        <Text style={styles.queSigue}>{queSigue}</Text>

        {/* El orden del formulario: servicios, número, detalles, archivos y
            dónde; las visitas que salieron de ella, al final. */}
        {nombresDeServicios(s).length ? (
          <>
            <Text style={styles.rotulo}>SERVICIOS</Text>
            <View style={styles.caja}>
              {nombresDeServicios(s).map((nombre, i) => (
                <View key={nombre} style={[styles.linea, i > 0 && styles.divisor]}>
                  <Text style={[styles.lineaTexto, styles.producto]}>{nombre}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {s.contacto.telefono ? (
          <>
            <Text style={styles.rotulo}>NÚMERO DE CONTACTO</Text>
            <View style={styles.caja}>
              <View style={styles.linea}>
                <Text style={styles.lineaTexto}>{s.contacto.telefono}</Text>
              </View>
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
            <View style={styles.adjuntos}>
              {s.adjuntos.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => Linking.openURL(a.url)}
                  style={({ pressed }) => [styles.adjunto, pressed && styles.tocada]}
                >
                  {a.tipo === "video" ? (
                    <View style={[styles.adjuntoImagen, styles.video]}>
                      <Ionicons name="play" size={22} color="#fff" />
                    </View>
                  ) : (
                    <Image source={{ uri: a.url }} style={styles.adjuntoImagen} contentFit="cover" />
                  )}
                </Pressable>
              ))}
            </View>
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
                  style={[styles.linea, styles.divisor]}
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
                  onPress={() => router.push(`/(cliente)/visitas/${v.id}`)}
                  style={({ pressed }) => [styles.linea, i > 0 && styles.divisor, pressed && styles.tocada]}
                >
                  <Text style={styles.lineaTexto}>
                    {fechaSolaCapitalizada(v.fechaProgramada, { weekday: "long", day: "numeric", month: "long" })}
                  </Text>
                  <Text style={styles.texto3}>{estadoLabel(v.estado)}</Text>
                  <Ionicons name="chevron-forward" size={16} color={tema.texto3} />
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: "#fff" },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  cuerpo: { padding: 16, paddingBottom: 40, gap: 6 },
  fecha: { color: tema.texto3, fontSize: 13 },
  queSigue: { color: tema.texto2, marginTop: 4, marginBottom: 8 },
  rotulo: { color: tema.texto3, fontSize: 11, letterSpacing: 0.8, paddingLeft: 4, marginTop: 12 },
  caja: { backgroundColor: tema.fondo, borderRadius: 12, paddingHorizontal: 14 },
  linea: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  divisor: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tema.linea },
  tocada: { opacity: 0.6 },
  lineaTexto: { color: tema.texto, flex: 1, lineHeight: 21 },
  producto: { fontWeight: "600" },
  enlace: { color: tema.verde700, fontWeight: "600" },
  texto2: { color: tema.texto2 },
  texto3: { color: tema.texto3, fontSize: 13 },
  adjuntos: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  adjunto: { width: 84, height: 84, borderRadius: 10, overflow: "hidden" },
  adjuntoImagen: { width: "100%", height: "100%", backgroundColor: tema.lienzo },
  video: { backgroundColor: "#222", alignItems: "center", justifyContent: "center" },
  pastilla: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  pendiente: { backgroundColor: tema.ambar50 },
  atendida: { backgroundColor: tema.verde50 },
  pastillaTexto: { fontSize: 12, fontWeight: "600" },
});
