import { Pressable, StyleSheet, TextInput as TextInputNativo, View } from "react-native";
import { Text, TextInput } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import { PressableScale } from "@/components/ui/PressableScale";
import { tema } from "@/lib/tema";
import { Conmutador } from "./Conmutador";

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
  prefijo,
  autoFocus,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: "default" | "email-address" | "phone-pad" | "decimal-pad" | "number-pad";
  autoCapitalize?: "none" | "sentences" | "words";
  multiline?: boolean;
  placeholder?: string;
  /** Un signo pegado al valor: "$" en un precio. */
  prefijo?: string;
  autoFocus?: boolean;
}) {
  return (
    <TextInput
      mode="outlined"
      label={required ? `${label} *` : label}
      left={prefijo ? <TextInput.Affix text={prefijo} /> : undefined}
      autoFocus={autoFocus}
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
 * El campo de las hojas de Shopify: el rótulo chico y gris **adentro** de la
 * caja, el valor debajo con su prefijo (`$`), y a la derecha un ⊗ que lo
 * vacía mientras tiene algo. Es para las hojas que copian a Shopify —precio,
 * inventario, opción—; el resto de los formularios sigue con `Campo`.
 */
export function CampoEnCaja({
  label,
  value,
  onChangeText,
  prefijo,
  keyboardType,
  placeholder,
  autoFocus,
  autoCapitalize,
  limpiable = true,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  prefijo?: string;
  keyboardType?: "default" | "decimal-pad" | "number-pad";
  placeholder?: string;
  autoFocus?: boolean;
  autoCapitalize?: "none" | "sentences" | "words";
  /** El ⊗ que vacía el campo. Apagado para lo que no tiene sentido vaciar. */
  limpiable?: boolean;
}) {
  return (
    <View style={estilos.caja}>
      <Text style={estilos.cajaRotulo}>{label}</Text>
      <View style={estilos.cajaFila}>
        {prefijo ? <Text style={estilos.cajaPrefijo}>{prefijo}</Text> : null}
        <TextInputNativo
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor={tema.texto3}
          autoFocus={autoFocus}
          autoCapitalize={autoCapitalize}
          returnKeyType="done"
          style={estilos.cajaTexto}
        />
        {limpiable && value !== "" ? (
          <Pressable
            onPress={() => onChangeText("")}
            hitSlop={8}
            style={({ pressed }) => [estilos.cajaLimpiar, pressed && estilos.tocado]}
            accessibilityLabel={`Vaciar ${label}`}
          >
            <Ionicons name="close-circle-outline" size={20} color={tema.texto2} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Una casilla con su rótulo, la de Shopify: el cuadrado relleno con el tilde
 * cuando está marcada, vacío con borde cuando no. Para lo que se decide con
 * un sí o un no dentro de una hoja; el interruptor queda para los ajustes.
 */
export function Casilla({
  label,
  nota,
  value,
  onValueChange,
}: {
  label: string;
  nota?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      style={({ pressed }) => [estilos.casillaFila, pressed && estilos.tocado]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
    >
      <View style={[estilos.casilla, value && estilos.casillaMarcada]}>
        {value ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}
      </View>
      <View style={estilos.interruptorTexto}>
        <Text variant="bodyLarge" style={estilos.interruptorLabel}>
          {label}
        </Text>
        {nota ? (
          <Text variant="bodySmall" style={estilos.interruptorNota}>
            {nota}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Una fila con un interruptor: el rótulo, una nota debajo y el switch. */
export function Interruptor({
  label,
  nota,
  value,
  onValueChange,
}: {
  label: string;
  nota?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={estilos.interruptor}>
      <View style={estilos.interruptorTexto}>
        <Text variant="bodyLarge" style={estilos.interruptorLabel}>
          {label}
        </Text>
        {nota ? (
          <Text variant="bodySmall" style={estilos.interruptorNota}>
            {nota}
          </Text>
        ) : null}
      </View>
      <Conmutador value={value} onValueChange={onValueChange} />
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


  caja: {
    borderWidth: 1,
    borderColor: tema.linea,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingTop: 7,
    paddingBottom: 5,
    marginBottom: 10,
    backgroundColor: tema.superficie,
  },
  cajaRotulo: { fontSize: 12, color: tema.texto3 },
  cajaFila: { flexDirection: "row", alignItems: "center", gap: 6 },
  cajaPrefijo: { fontSize: 16, color: tema.texto },
  cajaTexto: { flex: 1, fontSize: 16, color: tema.texto, paddingVertical: 5 },
  cajaLimpiar: { padding: 2 },
  tocado: { opacity: 0.6 },

  casillaFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  casilla: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: tema.linea,
    backgroundColor: tema.superficie,
    alignItems: "center",
    justifyContent: "center",
  },
  casillaMarcada: { backgroundColor: tema.verde, borderColor: tema.verde },

  interruptor: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  interruptorTexto: { flex: 1, gap: 2 },
  interruptorLabel: { color: tema.texto, fontWeight: "500" },
  interruptorNota: { color: tema.texto3 },

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
