import type { ConfigContext, ExpoConfig } from "@expo/config";

/**
 * Lo que `app.json` no puede decir: las claves de Google Maps.
 *
 * Son una por plataforma —cada una restringida a su app (bundle id en iOS,
 * paquete + SHA-1 en Android) y a su SDK— y viven en `apps/app-admin/.env`, que
 * no se sube al repo. Expo carga ese archivo antes de evaluar esta
 * configuración, así que acá llegan por `process.env`, y el prebuild las
 * hornea en el binario: `ios.config.googleMapsApiKey` va al Info.plist y al
 * AppDelegate, `android.config.googleMaps.apiKey` al AndroidManifest.
 * Cambiarlas pide `npx expo prebuild --clean` y un build nativo nuevo.
 *
 * `react-native-maps` 1.20 no trae plugin propio: es el prebuild de Expo el
 * que lee estos dos campos.
 */
/**
 * `GALERIA_PROPIA_EN_ANDROID=1` saca `READ_MEDIA_IMAGES`/`READ_MEDIA_VIDEO` de
 * `blockedPermissions`, y con eso vuelven la galería propia y las *sacadas
 * durante la visita* en Android. Es para probarlas en un build local mientras
 * Play no apruebe el permiso (ver `.claude/docs/publicacion-de-la-app.md`);
 * el build de la tienda va sin la variable.
 */
const PERMISOS_DE_LA_GALERIA = [
  "android.permission.READ_MEDIA_IMAGES",
  "android.permission.READ_MEDIA_VIDEO",
  "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
  // Android 12 y anteriores no tienen los de arriba: ahí la galería se lee con
  // estos dos. Bloqueados, expo-media-library los pedía sin estar en el
  // manifiesto y el teléfono decía que no sin mostrar nada.
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.WRITE_EXTERNAL_STORAGE",
];
const galeriaPropiaEnAndroid = process.env.GALERIA_PROPIA_EN_ANDROID === "1";

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
    blockedPermissions: galeriaPropiaEnAndroid
      ? config.android?.blockedPermissions?.filter(
          (p) => !PERMISOS_DE_LA_GALERIA.includes(p)
        )
      : config.android?.blockedPermissions,
    config: {
      ...config.android?.config,
      googleMaps: { apiKey: process.env.GOOGLE_MAPS_ANDROID_KEY },
    },
  },
});
