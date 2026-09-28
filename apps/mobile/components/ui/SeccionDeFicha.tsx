import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import { PressableScale } from "@/components/ui/PressableScale";
import { tema } from "@/lib/tema";

/**
 * Las piezas de una ficha de la app: la sección con su rótulo en versalitas
 * y su cuerpo redondeado, y la fila rótulo / valor.
 *
 * Estaban copiadas en cada ficha con sus propios grises. Acá no hay lógica,
 * solo la forma; la ficha del producto y la de la variante las comparten.
 */
export function Seccion({
  titulo,
  accion,
  children,
}: {
  titulo: string;
  /** Un enlace a la derecha del rótulo: *Editar*, *Agregar*. */
  accion?: { etiqueta: string; onPress: () => void } | null;
  children: React.ReactNode;
}) {
  const items = React.Children.toArray(children).filter(Boolean);
  if (items.length === 0) return null;
  return (
    <View style={estilosDeFicha.section}>
      <View style={estilosDeFicha.sectionHeader}>
        <Text variant="labelMedium" style={estilosDeFicha.sectionLabel}>
          {titulo.toUpperCase()}
        </Text>
        {accion ? (
          <PressableScale onPress={accion.onPress} hitSlop={8}>
            <Text style={estilosDeFicha.sectionAction}>{accion.etiqueta}</Text>
          </PressableScale>
        ) : null}
      </View>
      <View style={estilosDeFicha.sectionContent}>
        {items.map((child, i) => (
          <View key={i}>
            {child}
            {i < items.length - 1 ? <View style={estilosDeFicha.rowDivider} /> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Una fila de la ficha. Con `onPress` se vuelve un renglón que abre algo, y
 * lo dice con el chevron, como las filas de Shopify.
 */
export function Fila({
  label,
  value,
  onPress,
}: {
  label: string;
  value: React.ReactNode;
  onPress?: () => void;
}) {
  const cuerpo = (
    <>
      <Text variant="bodyMedium" style={estilosDeFicha.rowLabel}>
        {label}
      </Text>
      <View style={estilosDeFicha.rowRight}>
        {typeof value === "string" ? (
          <Text variant="bodyMedium" style={estilosDeFicha.rowValue}>
            {value}
          </Text>
        ) : (
          value
        )}
        {onPress ? (
          <Ionicons name="chevron-forward" size={16} color={tema.texto3} />
        ) : null}
      </View>
    </>
  );
  if (!onPress) return <View style={estilosDeFicha.row}>{cuerpo}</View>;
  return (
    <PressableScale
      onPress={onPress}
      estiloExterno={estilosDeFicha.ancho}
      style={estilosDeFicha.row}
      accessibilityRole="button"
    >
      {cuerpo}
    </PressableScale>
  );
}

export const estilosDeFicha = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  ancho: { alignSelf: "stretch" },
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },
  section: { marginTop: 20, gap: 6 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionLabel: {
    color: "#888",
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingLeft: 4,
  },
  sectionAction: { color: tema.verde, fontWeight: "600", fontSize: 14, paddingRight: 4 },
  sectionContent: {
    backgroundColor: "#fafafa",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  rowLabel: { color: "#888", flexShrink: 0 },
  rowValue: { color: "#111", textAlign: "right", flexShrink: 1 },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#eaeaea",
  },
  muted: { color: "#888" },
  vacio: { paddingVertical: 10, color: "#888" },
  ambar: { color: tema.ambarTexto, fontWeight: "600" },
});
