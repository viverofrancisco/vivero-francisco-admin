/**
 * Lo que hace que un enlace del portal abra **en la app** cuando está
 * instalada: la identidad de la app en cada tienda, publicada en dos archivos
 * bajo `/.well-known/` que iOS (Universal Links) y Android (App Links) leen
 * para comprobar que el dominio y la app son del mismo dueño. Sin la app, el
 * mismo enlace abre en el navegador, que es lo que hacía siempre.
 *
 * Hoy el único enlace que se reclama es el de acceso —invitación y
 * restablecer contraseña—, así que la app declara solo esa ruta: reclamar el
 * dominio entero haría que un admin que toque un enlace del portal desde el
 * teléfono cayera en la app, que no tiene esas pantallas.
 */

/** La ruta que la app reclama. Es la que emite `acceso.service.ts`. */
export const RUTA_ENLACE_DE_ACCESO = "/establecer-contrasena";

/** `appleTeamId.bundleIdentifier`, los dos de `eas.json` / `app.json`. */
export const APP_IOS_APP_ID = "9UGV7JZ9JT.com.viverofrancisco.app";

export const APP_ANDROID_PACKAGE = "com.viverofrancisco.app";

/**
 * SHA-256 del certificado con el que está firmado el binario de Android.
 *
 * El primero es el keystore que EAS generó y guarda (sale de
 * `apksigner verify --print-certs` sobre cualquier build de EAS, o de
 * `eas credentials -p android`); el segundo es el de **Play App Signing**
 * —Play refirma el binario con su propia clave, y es esa firma la que ve el
 * teléfono instalado desde la tienda—, en la consola de Play, *Protegido con
 * Play › Protección de Play Store › Firma de apps*. Sin él, los App Links no
 * se verifican en las instalaciones desde Play y el enlace abre en el
 * navegador.
 */
export const APP_ANDROID_SHA256 = [
  // El keystore de EAS: los apk de prueba que se instalan a mano.
  "66:48:66:69:A6:32:CD:B5:E4:56:09:21:D1:A8:62:27:E7:2C:AD:70:3C:E6:45:62:25:CC:56:5A:3B:D8:9B:62",
  // Play App Signing: lo que se instala desde Google Play (Play refirma el
  // .aab con esta clave). Consola de Play › Protegido con Play › Firma de apps.
  "3E:50:B5:AC:35:D1:3C:9C:39:9D:C0:2A:9D:FD:94:3F:A6:DF:2E:6A:17:D0:05:2A:78:A9:91:12:3C:E2:8F:69",
];
