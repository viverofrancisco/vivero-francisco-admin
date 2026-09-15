import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { HojaInferior } from "@/components/ui/HojaInferior";
import { PressableScale } from "@/components/ui/PressableScale";
import { tema } from "@/lib/tema";
import { hora12De } from "@/lib/hora";

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
          estiloExterno={[styles.ancho, styles.separado]}
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
    <Text style={styles.hora}>{hora12De(ahora)}</Text>
  );
}

const styles = StyleSheet.create({
  cuerpo: { alignItems: "center", gap: 6, paddingTop: 2 },
  titulo: {
    fontSize: 19,
    fontWeight: "800",
    color: tema.texto,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  hora: {
    fontSize: 40,
    fontWeight: "800",
    color: tema.verde,
    letterSpacing: -1.4,
    fontVariant: ["tabular-nums"],
    // Sin margen propio: el `gap` del cuerpo ya separa, y sumarle margen dejaba
    // el número flotando en su propio bloque.
    marginTop: 2,
  },
  detalle: {
    fontSize: 14,
    fontWeight: "500",
    color: tema.texto3,
    textAlign: "center",
    lineHeight: 20,
  },
  ancho: { alignSelf: "stretch" },
  /** Solo el primario despega del contenido; el secundario va pegado a él. */
  separado: { marginTop: 14 },
  confirmar: {
    height: 52,
    borderRadius: 14,
    backgroundColor: tema.verde,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmarTexto: { color: "#fff", fontWeight: "800", fontSize: 16 },
  // Pegado al primario: son el mismo par de opciones, y el aire de por medio
  // lo hacía parecer de otro grupo.
  cancelar: { height: 42, alignItems: "center", justifyContent: "center" },
  cancelarTexto: { color: tema.texto3, fontWeight: "700", fontSize: 15 },
});
