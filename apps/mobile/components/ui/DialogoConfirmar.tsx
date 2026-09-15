import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { HojaInferior } from "@/components/ui/HojaInferior";
import { PressableScale } from "@/components/ui/PressableScale";
import { tema } from "@/lib/tema";

/**
 * Una confirmación en una hoja de abajo: una pregunta, dos botones.
 *
 * Era una pantalla completa —modal a página entera— para un título, un renglón
 * y un botón. Ahora es la hoja del sistema, que además se arrastra para cerrar,
 * así que cancelar no obliga a apuntarle a un botón chico con el pulgar.
 */
export function DialogoConfirmar({
  visible,
  titulo,
  detalle,
  /** Lo que se está por sellar. Se muestra grande y en vivo. */
  hora,
  confirmar,
  cargando = false,
  onConfirmar,
  onCancelar,
}: {
  visible: boolean;
  titulo: string;
  detalle?: string;
  hora?: boolean;
  confirmar: string;
  cargando?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  return (
    <HojaInferior visible={visible} onCerrar={() => !cargando && onCancelar()}>
      <View style={styles.cuerpo}>
        <Text style={styles.titulo}>{titulo}</Text>
        {hora ? <RelojEnVivo activo={visible} /> : null}
        {detalle ? <Text style={styles.detalle}>{detalle}</Text> : null}

        <PressableScale
          onPress={onConfirmar}
          disabled={cargando}
          estiloExterno={styles.ancho}
          style={styles.confirmar}
        >
          {cargando ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.confirmarTexto}>{confirmar}</Text>
          )}
        </PressableScale>

        <PressableScale
          onPress={onCancelar}
          disabled={cargando}
          estiloExterno={styles.ancho}
          style={styles.cancelar}
        >
          <Text style={styles.cancelarTexto}>Cancelar</Text>
        </PressableScale>
      </View>
    </HojaInferior>
  );
}

/**
 * La hora que se va a sellar, al segundo.
 *
 * Fija sería mentira: entre que la hoja se abre y el dedo confirma pasa un
 * minuto con facilidad, y lo que se guarda es el instante del toque. Corre cada
 * segundo aunque se muestren solo horas y minutos, porque si no el cambio de
 * minuto llega hasta 59 segundos tarde.
 *
 * Se detiene al cerrarse: un intervalo vivo detrás de una hoja invisible es un
 * render por segundo que no mira nadie.
 */
function RelojEnVivo({ activo }: { activo: boolean }) {
  const [ahora, setAhora] = useState(() => new Date());

  useEffect(() => {
    if (!activo) return;
    setAhora(new Date());
    const id = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(id);
  }, [activo]);

  return (
    <Text style={styles.hora}>
      {ahora.toLocaleTimeString("es-EC", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  cuerpo: { alignItems: "center", gap: 8, paddingTop: 4 },
  titulo: {
    fontSize: 19,
    fontWeight: "800",
    color: tema.texto,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  hora: {
    fontSize: 52,
    fontWeight: "800",
    color: tema.verde,
    letterSpacing: -2,
    fontVariant: ["tabular-nums"],
    marginVertical: 6,
  },
  detalle: {
    fontSize: 14,
    fontWeight: "500",
    color: tema.texto3,
    textAlign: "center",
    lineHeight: 20,
  },
  ancho: { alignSelf: "stretch", marginTop: 8 },
  confirmar: {
    height: 52,
    borderRadius: 14,
    backgroundColor: tema.verde,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmarTexto: { color: "#fff", fontWeight: "800", fontSize: 16 },
  cancelar: { height: 46, alignItems: "center", justifyContent: "center" },
  cancelarTexto: { color: tema.texto3, fontWeight: "700", fontSize: 15 },
});
