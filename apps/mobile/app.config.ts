import type { ConfigContext, ExpoConfig } from "@expo/config";

/**
 * Lo que `app.json` no puede decir: las claves de Google Maps.
 *
 * Son una por plataforma —cada una restringida a su app (bundle id en iOS,
 * paquete + SHA-1 en Android) y a su SDK— y viven en `apps/mobile/.env`, que
 * no se sube al repo. Expo carga ese archivo antes de evaluar esta
 * configuración, así que acá llegan por `process.env`, y el prebuild las
 * hornea en el binario: `ios.config.googleMapsApiKey` va al Info.plist y al
 * AppDelegate, `android.config.googleMaps.apiKey` al AndroidManifest.
 * Cambiarlas pide `npx expo prebuild --clean` y un build nativo nuevo.
 *
 * `react-native-maps` 1.20 no trae plugin propio: es el prebuild de Expo el
 * que lee estos dos campos.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? "Vivero Francisco",
  slug: config.slug ?? "vivero-francisco",
  ios: {
    ...config.ios,
    config: {
      ...config.ios?.config,
      googleMapsApiKey: process.env.GOOGLE_MAPS_IOS_KEY,
    },
  },
  android: {
    ...config.android,
    config: {
      ...config.android?.config,
      googleMaps: { apiKey: process.env.GOOGLE_MAPS_ANDROID_KEY },
    },
  },
});
