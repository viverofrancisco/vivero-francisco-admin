import { Platform, Switch, StyleSheet } from "react-native";
import { tema } from "@/lib/tema";

/**
 * El interruptor de la app, uno solo.
 *
 * Había cuatro versiones —pista verde clara con el botón verde, pista verde,
 * el de Paper, el del sistema sin color— y en iOS 26 el nativo creció: más
 * ancho y más alto que un renglón de texto, y con la pista clara prendido se
 * leía como apagado. Acá la pista prendida es el verde de la casa, el botón
 * blanco, y en iOS se achica a la medida de un renglón.
 */
export function Conmutador({
  value,
  onValueChange,
  disabled,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ true: tema.verde, false: undefined }}
      thumbColor={Platform.OS === "android" ? "#fff" : undefined}
      ios_backgroundColor={tema.linea2}
      style={Platform.OS === "ios" ? styles.ios : undefined}
    />
  );
}

const styles = StyleSheet.create({
  ios: { transform: [{ scale: 0.8 }] },
});
