import { Image, type ImageStyle } from "expo-image";
import type { StyleProp } from "react-native";
import { useBranding } from "@/lib/branding";

const EMPAQUETADO = require("@/assets/images/logo-empresa.png");

/**
 * El logo del vivero, sin saltos: la copia que viene dentro de la app se ve
 * desde el primer cuadro, y el de la configuración —el que se cambia en
 * *Empresa*— la reemplaza sin parpadeo en cuanto está, desde la caché de disco
 * de `expo-image` las veces siguientes. Nunca el nombre en texto: era eso lo
 * que aparecía primero y después saltaba al logo.
 */
export function LogoDeLaEmpresa({ style }: { style: StyleProp<ImageStyle> }) {
  const { logoUrl, nombre } = useBranding();
  return (
    <Image
      source={logoUrl ? { uri: logoUrl } : EMPAQUETADO}
      placeholder={EMPAQUETADO}
      placeholderContentFit="contain"
      contentFit="contain"
      cachePolicy="disk"
      transition={0}
      style={style}
      accessibilityLabel={nombre ?? "Vivero Francisco"}
    />
  );
}
