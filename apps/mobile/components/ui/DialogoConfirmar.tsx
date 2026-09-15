import { Modal, Pressable, StyleSheet } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { PressableScale } from "@/components/ui/PressableScale";
import { tema } from "@/lib/tema";

/**
 * Una confirmación: una pregunta, dos botones, centrada.
 *
 * Marcar entrada era una pantalla completa —modal a página entera— para un
 * título, un renglón y un botón. Una pantalla es para algo que se llena; una
 * decisión de sí o no es una tarjeta que aparece sobre lo que estabas mirando,
 * y que te deja ver que sigue ahí atrás.
 *
 * Centrada y no como hoja de abajo: una hoja se arrastra y se explora, y acá no
 * hay nada que explorar. Dos líneas se leen mejor en el medio.
 */
export function DialogoConfirmar({
  visible,
  titulo,
  detalle,
  confirmar,
  cargando = false,
  onConfirmar,
  onCancelar,
}: {
  visible: boolean;
  titulo: string;
  /** Una línea, opcional. Si hace falta un párrafo, esto no es un diálogo. */
  detalle?: string;
  confirmar: string;
  cargando?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => !cargando && onCancelar()}
    >
      <Pressable
        style={styles.fondo}
        onPress={() => !cargando && onCancelar()}
      >
        <Pressable style={styles.tarjeta} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.titulo}>{titulo}</Text>
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
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  tarjeta: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: tema.superficie,
    borderRadius: 20,
    padding: 22,
    gap: 10,
  },
  titulo: {
    fontSize: 19,
    fontWeight: "800",
    color: tema.texto,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  detalle: {
    fontSize: 14,
    fontWeight: "500",
    color: tema.texto3,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 4,
  },
  ancho: { alignSelf: "stretch" },
  confirmar: {
    height: 50,
    borderRadius: 14,
    backgroundColor: tema.verde,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmarTexto: { color: "#fff", fontWeight: "800", fontSize: 16 },
  cancelar: { height: 44, alignItems: "center", justifyContent: "center" },
  cancelarTexto: { color: tema.texto3, fontWeight: "700", fontSize: 15 },
});
