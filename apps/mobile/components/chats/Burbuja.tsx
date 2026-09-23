import { Image, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import { PressableScale } from "@/components/ui/PressableScale";
import {
  etiquetaDeAdjuntos,
  horaDeMensaje,
  type EstadoDeMensaje,
  type MensajeDeChat,
} from "@/lib/chats";
import { tema } from "@/lib/tema";

/**
 * Los vistos de WhatsApp, en la esquina de cada mensaje propio: uno mientras
 * espera, dos cuando el servidor lo tiene, dos azules cuando lo leyeron todos.
 * Y el signo rojo cuando el servidor dijo que no.
 */
export function Vistos({ estado }: { estado: EstadoDeMensaje }) {
  if (estado === "pendiente") {
    return <Ionicons name="checkmark" size={14} color={CLARO} accessibilityLabel="Enviando" />;
  }
  if (estado === "fallido") {
    return (
      <Ionicons name="alert-circle" size={14} color="#ffb4ab" accessibilityLabel="No se envió" />
    );
  }
  return (
    <Ionicons
      name="checkmark-done"
      size={14}
      color={estado === "leido" ? AZUL : CLARO}
      accessibilityLabel={estado === "leido" ? "Leído por todos" : "Enviado"}
    />
  );
}

const CLARO = "rgba(255,255,255,0.75)";
/** El azul de WhatsApp, sobre el verde de la burbuja. */
const AZUL = "#7dd3fc";

/**
 * Un mensaje. Lo mío a la derecha en verde, lo de los demás a la izquierda en
 * blanco: la convención que todo el mundo ya sabe leer. Quien la dibuja decide
 * dónde va —la fila deslizable en la conversación, un `View` alineado en la
 * info—: la burbuja mide lo que mide su contenido.
 */
export function Burbuja({
  mensaje,
  destacado = false,
  conNombre,
  soloLectura = false,
  onMantener,
  onVerFoto,
  onIrACita,
  onReintentar,
  onDescartar,
}: {
  mensaje: MensajeDeChat;
  /** El que se vino a ver desde el buscador. */
  destacado?: boolean;
  conNombre: boolean;
  /** Dibujada en la info del mensaje: sin gestos. */
  soloLectura?: boolean;
  onMantener?: () => void;
  onVerFoto?: (media: { url: string; tipo: string }) => void;
  /** Tocar la cita lleva al mensaje citado, como en WhatsApp. */
  onIrACita?: (id: string) => void;
  onReintentar?: () => void;
  onDescartar?: () => void;
}) {
  const mio = mensaje.mio;
  const enCola = mensaje.estado === "pendiente" || mensaje.estado === "fallido";
  const mantener = soloLectura || mensaje.borrado || enCola ? undefined : onMantener;

  const burbuja = (
    <PressableScale
      onLongPress={mantener}
      delayLongPress={300}
      style={[
        styles.burbuja,
        mio ? styles.mia : styles.ajena,
        destacado && styles.destacada,
        mensaje.estado === "fallido" && styles.fallida,
      ]}
    >
      {conNombre ? (
        <Text style={styles.autor}>{mensaje.autorNombre}</Text>
      ) : null}

      {mensaje.respondeA ? (
        <PressableScale
          onPress={soloLectura ? undefined : () => onIrACita?.(mensaje.respondeA!.id)}
          onLongPress={mantener}
          estiloExterno={styles.ancho}
          style={[styles.cita, mio ? styles.citaMia : styles.citaAjena]}
          accessibilityRole="link"
          accessibilityLabel="Ir al mensaje citado"
        >
          <View style={styles.crece}>
            <Text style={[styles.citaAutor, mio && styles.textoClaro]}>
              {mensaje.respondeA.autorNombre}
            </Text>
            <Text
              style={[styles.citaCuerpo, mio && styles.textoClaro]}
              numberOfLines={2}
            >
              {mensaje.respondeA.borrado
                ? "Mensaje borrado"
                : (mensaje.respondeA.texto ??
                  etiquetaDeAdjuntos(
                    mensaje.respondeA.miniatura?.tipo,
                    mensaje.respondeA.fotos
                  ))}
            </Text>
          </View>
          {/* La miniatura de lo citado, como en WhatsApp: "📷 Foto" no dice
              cuál de todas. */}
          {mensaje.respondeA.miniatura ? (
            <MiniaturaAdjunto
              url={mensaje.respondeA.miniatura.url}
              tipo={mensaje.respondeA.miniatura.tipo}
              lado={36}
            />
          ) : null}
        </PressableScale>
      ) : null}

      {mensaje.borrado ? (
        <Text style={[styles.borrado, mio && styles.textoClaro]}>
          Mensaje borrado
        </Text>
      ) : (
        <>
          {mensaje.fotos.length > 0 ? (
            <View style={styles.fotos}>
              {mensaje.fotos.map((f) => (
                <PressableScale
                  key={f.id}
                  onPress={() => onVerFoto?.({ url: f.url, tipo: f.tipo })}
                  onLongPress={mantener}
                  style={styles.fotoCaja}
                >
                  {/* Medidas fijas y no porcentajes: adentro de una burbuja
                      que se mide por su contenido, un `100%` no tiene contra
                      qué resolverse —quedaba de ancho cero y alto estirado—. */}
                  {f.tipo === "video" ? (
                    <View
                      style={[
                        mensaje.fotos.length > 1 ? styles.fotoChica : styles.fotoSola,
                        styles.videoCaja,
                      ]}
                    >
                      <Ionicons name="play" size={36} color="#fff" />
                    </View>
                  ) : (
                    <Image
                      source={{ uri: f.url }}
                      style={
                        mensaje.fotos.length > 1 ? styles.fotoChica : styles.fotoSola
                      }
                    />
                  )}
                </PressableScale>
              ))}
            </View>
          ) : null}
          {mensaje.texto ? (
            <Text style={[styles.texto, mio && styles.textoClaro]}>
              {mensaje.texto}
            </Text>
          ) : null}
        </>
      )}

      <View style={styles.pie}>
        <Text style={[styles.hora, mio && styles.horaMia]}>
          {horaDeMensaje(mensaje.createdAt)}
        </Text>
        {mio && !mensaje.borrado ? <Vistos estado={mensaje.estado} /> : null}
      </View>
    </PressableScale>
  );

  if (mensaje.estado !== "fallido" || soloLectura) return burbuja;

  // El servidor dijo que no: el motivo y qué hacer, al pie del mensaje.
  return (
    <View style={styles.conFallo}>
      {burbuja}
      <View style={styles.fallo}>
        <Text style={styles.falloTexto} numberOfLines={2}>
          {mensaje.error ?? "No se envió"}
        </Text>
        <PressableScale onPress={onReintentar} style={styles.falloBoton}>
          <Text style={styles.falloAccion}>Reintentar</Text>
        </PressableScale>
        <PressableScale onPress={onDescartar} style={styles.falloBoton}>
          <Text style={styles.falloAccion}>Eliminar</Text>
        </PressableScale>
      </View>
    </View>
  );
}

/** La miniatura chica de una foto o un video, para las citas. */
export function MiniaturaAdjunto({
  url,
  tipo,
  lado,
}: {
  url: string;
  tipo: string;
  lado: number;
}) {
  const caja = { width: lado, height: lado };
  if (tipo === "video") {
    return (
      <View style={[styles.miniaturaCita, styles.videoCaja, caja]}>
        <Ionicons name="play" size={lado / 2} color="#fff" />
      </View>
    );
  }
  return (
    <Image source={{ uri: url }} style={[styles.miniaturaCita, caja]} />
  );
}

const styles = StyleSheet.create({
  crece: { flex: 1 },
  ancho: { alignSelf: "stretch" },

  burbuja: { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  mia: { backgroundColor: tema.verde, borderBottomRightRadius: 4 },
  /* El que se vino a ver: un borde ámbar, que es lo único que lo distingue sin
     taparle el contenido. */
  destacada: { borderWidth: 2, borderColor: tema.ambar },
  fallida: { opacity: 0.8 },
  ajena: {
    backgroundColor: tema.superficie,
    borderBottomLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tema.linea,
  },
  autor: { fontSize: 12, fontWeight: "700", color: tema.verde700, marginBottom: 2 },
  texto: { fontSize: 15, color: tema.texto, lineHeight: 19 },
  textoClaro: { color: "#fff" },
  borrado: { fontSize: 15, fontStyle: "italic", color: tema.texto3 },
  pie: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    gap: 3,
    marginTop: 1,
  },
  hora: { fontSize: 10, color: tema.texto3 },
  horaMia: { color: CLARO },

  cita: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    // Ancho mínimo fijo, por lo mismo que las fotos: adentro de una burbuja
    // que se mide por su contenido, la columna del texto —`flex: 1`— no tiene
    // contra qué resolverse y quedaba de ancho cero, con la cita estirada a lo
    // alto y sin una letra a la vista.
    minWidth: 210,
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 4,
  },
  /* Un video no tiene imagen sin reproducirlo: un recuadro oscuro con el
     triángulo es lo que todo el mundo lee como "esto se reproduce". */
  videoCaja: {
    backgroundColor: "rgba(20,40,25,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  miniaturaCita: { borderRadius: 6, overflow: "hidden", backgroundColor: tema.lienzo },
  citaMia: {
    borderLeftColor: "rgba(255,255,255,0.7)",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  citaAjena: { borderLeftColor: tema.verde, backgroundColor: tema.lienzo },
  citaAutor: { fontSize: 11, fontWeight: "700", color: tema.verde700 },
  citaCuerpo: { fontSize: 12, color: tema.texto2 },

  fotos: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 3,
    marginBottom: 4,
    // Dos por fila cuando hay varias: 105 + 3 + 105.
    maxWidth: 213,
  },
  fotoCaja: { borderRadius: 10, overflow: "hidden" },
  fotoSola: { width: 213, height: 160, backgroundColor: tema.lienzo },
  fotoChica: { width: 105, height: 105, backgroundColor: tema.lienzo },

  conFallo: { alignItems: "flex-end", gap: 2 },
  fallo: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
    maxWidth: 260,
  },
  falloTexto: { fontSize: 11, color: tema.rojo, flexShrink: 1 },
  falloBoton: { paddingVertical: 2 },
  falloAccion: { fontSize: 11, fontWeight: "700", color: tema.rojo, textDecorationLine: "underline" },
});
