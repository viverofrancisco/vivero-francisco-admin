import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Text, TextInput } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PressableScale } from "@/components/ui/PressableScale";
import { tema } from "@/lib/tema";

/**
 * Las piezas de un formulario de la app, en un solo lugar.
 *
 * Los campos, los rótulos y la barra de guardar estaban copiados en cada
 * pantalla con sus propios colores de borde y sus propios márgenes: cinco
 * formularios y cinco grises distintos. Acá no hay lógica, solo la forma.
 */
export function Titulo({ children }: { children: React.ReactNode }) {
  return (
    <Text variant="labelMedium" style={estilos.titulo}>
      {String(children).toUpperCase()}
    </Text>
  );
}

export function Campo({
  label,
  required,
  value,
  onChangeText,
  keyboardType,
  autoCapitalize,
  multiline,
  placeholder,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: "default" | "email-address" | "phone-pad" | "decimal-pad" | "number-pad";
  autoCapitalize?: "none" | "sentences" | "words";
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <TextInput
      mode="outlined"
      label={required ? `${label} *` : label}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      multiline={multiline}
      numberOfLines={multiline ? 4 : undefined}
      placeholder={placeholder}
      outlineColor={tema.linea}
      activeOutlineColor={tema.verde}
      outlineStyle={estilos.borde}
      style={[estilos.campo, multiline && estilos.campoAlto]}
      contentStyle={multiline ? estilos.campoAltoContenido : undefined}
    />
  );
}

/**
 * La barra de guardar, pegada abajo.
 *
 * Fija y no al final del scroll: en un formulario largo, el botón que hay que
 * apretar no debería estar a seis gestos de distancia de lo último que se
 * escribió.
 */
export function PieDeFormulario({
  etiqueta,
  onPress,
  cargando,
  deshabilitado,
}: {
  etiqueta: string;
  onPress: () => void;
  cargando?: boolean;
  deshabilitado?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const apagado = cargando || deshabilitado;
  return (
    <View
      style={[estilos.pie, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}
    >
      <PressableScale
        onPress={onPress}
        disabled={apagado}
        estiloExterno={estilos.ancho}
        style={[estilos.guardar, apagado && estilos.guardarApagado]}
      >
        {cargando ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={estilos.guardarTexto}>{etiqueta}</Text>
        )}
      </PressableScale>
    </View>
  );
}

/** La acción destructiva de una ficha: al final, y en rojo suave. */
export function BotonEliminar({
  etiqueta,
  onPress,
  cargando,
}: {
  etiqueta: string;
  onPress: () => void;
  cargando?: boolean;
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={cargando}
      estiloExterno={estilos.eliminarExterno}
      style={estilos.eliminar}
    >
      <Text style={estilos.eliminarTexto}>
        {cargando ? "Un momento…" : etiqueta}
      </Text>
    </PressableScale>
  );
}

const estilos = StyleSheet.create({
  titulo: {
    color: tema.texto3,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingLeft: 4,
    marginTop: 18,
    marginBottom: 8,
  },
  campo: { marginBottom: 8, backgroundColor: "#fff" },
  campoAlto: { minHeight: 100 },
  campoAltoContenido: { paddingTop: 12, paddingBottom: 12 },
  borde: { borderRadius: 12 },

  pie: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tema.linea,
  },
  ancho: { alignSelf: "stretch" },
  guardar: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    borderRadius: 14,
    backgroundColor: tema.verde,
  },
  guardarApagado: { backgroundColor: tema.linea },
  guardarTexto: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.2,
  },

  eliminarExterno: { marginTop: 24 },
  eliminar: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: tema.rojo50,
  },
  eliminarTexto: { color: tema.rojo, fontWeight: "600", fontSize: 15 },
});
