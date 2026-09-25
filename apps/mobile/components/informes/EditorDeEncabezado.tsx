import { useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { primeraLineaPlana } from "@vivero/shared";
import {
  EditorDeTextoRico,
  type EditorDeTextoRicoHandle,
} from "@/components/informes/EditorDeTextoRico";
import { tema } from "@/lib/tema";

/**
 * El encabezado del informe, con el mismo editor que las secciones y
 * centrado, como en el portal: Enter corta la línea, y cada pedazo lleva su
 * tamaño, su fuente, su color y sus marcas. El de siempre entra con sus
 * estilos y sale igual si no se toca.
 */
export function EditorDeEncabezado({
  html,
  onCerrar,
  onGuardar,
}: {
  html: string;
  onCerrar: () => void;
  onGuardar: (html: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const editor = useRef<EditorDeTextoRicoHandle>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function guardar() {
    const nuevo = (await editor.current?.obtener()) ?? "";
    if (!primeraLineaPlana(nuevo)) {
      setAviso("El encabezado necesita al menos una línea.");
      return;
    }
    onGuardar(nuevo);
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onCerrar}>
      <View style={[styles.pantalla, { paddingTop: insets.top + 8 }]}>
        <View style={styles.cabecera}>
          <Pressable onPress={onCerrar} hitSlop={8}>
            <Text style={styles.cancelar}>Cancelar</Text>
          </Pressable>
          <Text style={styles.titulo}>Encabezado</Text>
          <Pressable onPress={() => void guardar()} hitSlop={8}>
            <Text style={styles.listo}>Listo</Text>
          </Pressable>
        </View>
        {aviso ? <Text style={styles.aviso}>{aviso}</Text> : null}
        <EditorDeTextoRico ref={editor} html={html} centrado />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.superficie },
  cabecera: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tema.linea,
  },
  cancelar: { color: tema.verde, fontWeight: "500", fontSize: 16 },
  titulo: { fontWeight: "600", fontSize: 16, color: tema.texto },
  listo: { color: tema.verde, fontWeight: "700", fontSize: 16 },
  aviso: { color: "#c62828", fontSize: 12, paddingHorizontal: 16, paddingTop: 8 },
});
