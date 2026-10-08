# Publicar la app en las tiendas

La app (`apps/mobile`) se compila y se sube con **EAS** (Expo Application
Services): `eas build` compila en la nube el binario firmado y `eas submit`
lo sube a App Store Connect o a Google Play. La máquina de desarrollo no
necesita Xcode para eso; sí para `npx expo run:ios --device`, que es cómo se
prueba el dev client en el teléfono propio.

## Identidad

- **Nombre**: *Vivero Francisco*; **slug** `vivero-francisco`; **scheme**
  `viverofrancisco` (`app.json`). Antes eran los del template (`mobile`).
- **Bundle id de iOS y paquete de Android**: `com.viverofrancisco.app`.
  Se eligió el 28 de septiembre de 2026 en lugar del `com.jorgefco95.mobile`
  del template. **No se puede cambiar después de publicar**: es lo que
  identifica la app en las dos tiendas para siempre. Cambiarlo también
  invalida la restricción de las claves de Google Maps (ver más abajo) y pide
  `npx expo prebuild --clean`.
- `ios.supportsTablet` es `false`: es una app de teléfono, y con iPad
  habilitado App Store Connect exige capturas de iPad.
- `ITSAppUsesNonExemptEncryption: false` en el Info.plist, para que cada
  subida a TestFlight no pregunte por el cifrado (la app usa solo HTTPS).

## Los íconos

Salen del logo (`Logo Vivero Francisco.png`, 1024×1338 con transparencia; el
`.ai` es el original). Se generaron con sharp desde el PNG; el script de
aquella vez está descrito acá para rehacerlos si el logo cambia:

- `icon.png` — iOS, 1024×1024 **sin alfa** (App Store rechaza un ícono con
  transparencia), el logo a 760 px de alto centrado sobre blanco. iOS pone
  las esquinas redondeadas.
- `android-icon-foreground.png` — la capa de adelante del ícono adaptativo,
  1024×1024 transparente con el logo a 530 px de alto: Android recorta el
  ícono a un círculo del 66 % del lienzo, y un rectángulo de esa proporción
  entra en ese círculo si mide eso. Se ve chico en el archivo y del tamaño
  correcto en el launcher.
- `android-icon-monochrome.png` — la silueta (el alfa del logo) en blanco;
  Android la tiñe para los íconos temáticos.
- `adaptiveIcon.backgroundColor: "#FFFFFF"`, sin `backgroundImage`.
- `splash-icon.png` — el logo tal cual; Expo lo dibuja a 200 px de ancho sobre
  blanco, también en modo oscuro (el contorno gris del logo se pierde sobre
  negro).
- `favicon.png` — 64×64 desde el ícono, para la web.

## Variables de entorno en EAS

EAS Build **no sube `apps/mobile/.env`** (está en `.gitignore`), así que lo que
`app.config.ts` y el bundle leen de ahí tiene que estar cargado como variable
de entorno del proyecto en EAS, en el ambiente que el perfil de `eas.json`
declara (`environment: "production"`):

- `EXPO_PUBLIC_API_BASE_URL` — la URL pública del portal:
  **`https://admin.viverofrancisco.com`** (el proyecto de Vercel también
  responde en `vivero-francisco-admin.vercel.app`; `/api/mobile/ping`
  contesta `{"ok":true}` en los dos). Las
  `EXPO_PUBLIC_*` se **hornean en el JS al compilar**: sin ella la app de
  producción apunta a `localhost` y nada carga. En desarrollo no hace falta
  (`lib/config.ts` la deduce de Metro).
- `GOOGLE_MAPS_IOS_KEY` y `GOOGLE_MAPS_ANDROID_KEY` — `app.config.ts` las mete
  en el binario. Sin la de iOS, `react-native-maps` con `PROVIDER_GOOGLE`
  **aborta al abrir un mapa** ("GMSServices must be initialized"). La de iOS
  está restringida al bundle id en Google Cloud, así que con el bundle id
  nuevo hay que editar esa restricción; la de Android se restringe con el
  paquete **más el SHA-1** del certificado de firma, que en EAS sale de
  `eas credentials -p android` (y el de Play App Signing, de la consola de
  Play).

Se cargan con `eas env:create --environment production --name … --value …`
(visibilidad *sensitive* para las claves) o de un tirón con
`eas env:push --environment production --path apps/mobile/.env` — ojo, ese
`.env` tiene las líneas de `EXPO_PUBLIC_API_BASE_URL` comentadas.

## Perfiles (`eas.json`)

`development` (dev client, distribución interna), `preview` (para probar
sin tienda: en Android un **`.apk`** instalable a mano —en un teléfono, desde
el enlace o el QR que EAS da al terminar, o en el emulador con
`eas build:run -p android --latest`— y en iOS un build de **simulador**, que
no necesita cuenta de Apple e instala `eas build:run -p ios --latest`) y
`production` (`autoIncrement: true` con `appVersionSource: "remote"`: EAS
lleva el build number, así no hay que tocar `app.json` en cada subida). Cada
perfil lee **su** ambiente de variables, así que `EXPO_PUBLIC_API_BASE_URL` y
las claves van en `preview` y en `production` por igual; sin ellas el build
compila y la app apunta a localhost. El primer build de Android se corre
**interactivo** (en la terminal, no con `--non-interactive`): es cuando EAS
pregunta si genera el keystore. La máquina tiene el SDK de Android en
`~/Library/Android/sdk` pero sin `ANDROID_HOME`, sin `adb` en el PATH y sin
Java, y el único emulador creado es uno de TV: para `expo run:android` local
faltan las tres cosas; para instalar un `.apk` de EAS no hace falta ninguna. `version` en
`app.json` es la versión que la gente ve (`1.0.0`).

Es un monorepo con npm workspaces: `eas build` se corre **desde
`apps/mobile`**, y EAS sube el repo entero (lo que git no ignora) e instala
desde la raíz, que es donde vive `packages/shared`.

## Un solo `expo` en el monorepo

El primer `.apk` de EAS **se cerraba al abrir** con
`NoClassDefFoundError: expo.modules.kotlin.types.AnyTypeCache` desde
`DomWebViewModule`. La causa no estaba en la app sino en `node_modules`: la
raíz tenía `expo-router` como devDependency (un resto del template) y npm,
al resolver los peers `expo@"*"` de los paquetes izados, instaló **expo 57**
en la raíz mientras `apps/mobile` quedaba con su expo 54 anidado. Desde
`apps/mobile`, `require("expo")` daba 54 y `require("expo-modules-core")`
daba el 57 de la raíz, y el build de Android compiló el módulo de uno contra
el core del otro. iOS no se quejó porque CocoaPods resuelve cada pod desde
el paquete que lo declara.

Por eso la raíz lleva **`overrides.expo = "~54.0.33"`** (el mismo rango que
`apps/mobile`, hay que moverlos juntos al subir de SDK) y ya no tiene
`expo-router`. El override no bastó sobre el lockfile viejo —npm no vuelve a
resolver lo que ya tenía resuelto— y hubo que regenerarlo desde cero
(`rm -rf node_modules package-lock.json && npm install`). La comprobación
rápida, desde `apps/mobile`:

```bash
node -e "console.log(require('expo/package.json').version, require('expo-modules-core/package.json').version)"
```

Tiene que dar 54.x y 3.0.x; `npx expo-doctor` también lo detecta como
versiones que no corresponden al SDK.

## iOS, la primera vez

1. Apple Developer Program a nombre del negocio (US$ 99/año). Con cuenta de
   empresa piden el D-U-N-S; con cuenta individual sale a nombre de la persona.
2. `npm i -g eas-cli` (la máquina tenía 20.1; la 24 es la actual) y
   `eas login`.
3. Desde `apps/mobile`: `eas init` desde la cuenta de Expo del negocio (`app.json` lleva `owner: "vivero-francisco"`, la organización, para que el proyecto no caiga en la cuenta personal `viverofrancisco` con la que se inicia sesión; crea el proyecto en Expo y escribe
   `extra.eas.projectId` en `app.json` — se commitea).
4. Las tres variables de arriba en el ambiente `production`.
5. `eas build -p ios --profile production`. La primera vez pide el Apple ID y
   crea el certificado de distribución y el provisioning profile, y los
   guarda en EAS. Tarda 15–25 minutos.
6. `eas submit -p ios --latest`: crea la app en App Store Connect si no
   existe y sube el binario a TestFlight. Probar desde TestFlight en el
   teléfono antes de mandarlo a revisión.
7. En App Store Connect, la ficha: capturas de pantalla de iPhone 6.9" y
   6.5" (el simulador sirve), descripción, **URL de política de privacidad**
   (obligatoria: la app recoge ubicación, fotos y datos de contacto), URL de
   soporte, categoría (*Business*), clasificación por edad, el cuestionario
   *App Privacy* (ubicación precisa, fotos, nombre y teléfono, id de usuario;
   todo vinculado a la identidad y ninguno para rastreo), y en *App Review
   Information* **una cuenta de prueba de producción** con la que el revisor
   pueda iniciar sesión (un personal y, mejor, también un cliente).
   La app no crea cuentas —las crea un administrador—, así que no aplica la
   exigencia de "eliminar cuenta" desde la app.
8. *Submit for Review*. Suele tardar uno o dos días.

Las siguientes subidas son `eas build -p ios --profile production` y
`eas submit -p ios --latest` (o `eas build … --auto-submit`), **sin
preguntas**: `eas.json` lleva `submit.production.ios.ascAppId` (el *Apple
ID* numérico de la app en App Store Connect, 6817389110) y el
`appleTeamId` (9UGV7JZ9JT), y la clave de App Store Connect que EAS generó
la primera vez (rol App Manager) queda guardada en EAS. **Mejor el
`eas submit` aparte que el `--auto-submit`**: en el build 4 la submission
que programó `--auto-submit` se quedó *in queue* más de una hora después
de terminado el build (sin incidente en status.expo.dev), y un
`eas submit -p ios --id <build> --no-wait` lanzado a mano por encima llegó
a Apple en un minuto; la automática se canceló con `submit:cancel` para
que no corriera después como duplicado. `--no-wait` siempre: sin él el
comando espera a Apple y se pasa de los diez minutos que aguanta una
sesión. Un cambio solo
de JS puede ir por EAS Update sin pasar por la tienda, pero eso pide
`expo-updates`, que no está instalado; por ahora todo va por build.

**Una capacidad nueva de iOS pide un build interactivo, con el Apple ID.**
Al agregar `associatedDomains` a `app.json`, los builds lanzados sin
preguntas fallaron en la firma con *Provisioning profile … doesn't support
the Associated Domains capability*, y borrar el perfil con
`eas credentials -p ios` no alcanzó: EAS lo regenera con la clave de App
Store Connect, pero **sincronizar las capacidades del App ID solo lo hace
con la sesión del Apple ID**, que un build no interactivo no tiene. El
camino es correr `eas build -p ios --profile production` a mano, contestar
que sí a *log in to your Apple account*, y ver la línea *Synced
capabilities*; o activar la capacidad en developer.apple.com (Identifiers ›
la app) y borrar el perfil después. Vale para cualquier capacidad futura
(push, Sign in with Apple).

**Correr `eas` desde `apps/mobile`**, siempre: lanzado desde la raíz del
monorepo, EAS CLI deja un `app.json` vacío (`{"expo": {}}`) al lado del
`package.json` de la raíz, que un `git add -A` se lleva sin que nadie lo
mire. Ya pasó dos veces.

## Visto en TestFlight

- **La barra de estado salía invisible** en el iPhone del usuario: hora y
  batería en blanco sobre el fondo blanco de la app. El teléfono estaba en
  modo oscuro, `app.json` traía `userInterfaceStyle: "automatic"` y el
  `<StatusBar style="auto">` de `_layout.tsx` seguía al sistema, mientras
  que la app es clara siempre (`tema.ts` no tiene paleta oscura). Ahora la
  app se declara `light` y la barra es `dark`. En el simulador nunca se vio
  porque estaba en modo claro: **probar en modo oscuro** antes de cada
  subida.

## Apple y la regla 3.2: la app tiene que servirle a un desconocido

La 1.0 (build 12) se rechazó por la **regla 3.2 (Business)**: Apple la leyó
como una app para un negocio específico, porque quien la descargaba sin
cuenta solo veía un login al que no podía entrar —las cuentas las creaba el
vivero—. Ofreció la **distribución no listada**, y no se pidió a propósito:
una app no listada **no puede volver a ser pública**, y la idea es que los
clientes la encuentren en la tienda y, más adelante, compren desde ella.

La salida fue que la app le sirva a cualquiera desde el primer minuto
(5-oct-2026): un **modo invitado** con el **catálogo** y **solicitudes** de
visita y de cotización sin cuenta, y además la pestaña del catálogo y las
solicitudes para el cliente con sesión y *Eliminar mi cuenta* en su Cuenta.
Ver [el doc de contraseñas](./autenticacion-clientes.md#modo-invitado). El
registro abierto queda para después, con el teléfono y un código por
WhatsApp. En las notas para la revisión conviene decirlo con todas las
letras: sin cuenta se puede ver el catálogo con precios y pedir una visita o
una cotización; los clientes del vivero entran además a ver sus visitas, y
el equipo entra con la cuenta de prueba.

**Las rutas nuevas tienen que estar en producción antes de mandar el build**:
el revisor se registra contra el portal publicado, y un 404 en
`/api/mobile/publico/catalogo` es otro rechazo.

## Android, después

1. Google Play Console (US$ 25 una vez) a nombre del negocio.
2. `eas build -p android --profile production` (genera un `.aab`; EAS crea
   y guarda el keystore).
3. **La primera subida es a mano** en la consola de Play (crear la app,
   subir el `.aab` a *Internal testing*): `eas submit -p android` necesita
   una cuenta de servicio de Google Cloud con permiso en la consola, que solo
   se puede dar una vez que la app existe.
4. Restringir `GOOGLE_MAPS_ANDROID_KEY` al paquete + SHA-1 del keystore de
   EAS **y** al SHA-1 de Play App Signing (Play refirma el binario).
   Por el mismo motivo, el **SHA-256** de Play App Signing está en
   `APP_ANDROID_SHA256` (`apps/admin/src/lib/enlaces-a-la-app.ts`), junto al
   del keystore de EAS: es lo que hace que el enlace de acceso abra en la
   app instalada desde la tienda. Las huellas de Play están en la consola,
   *Protegido con Play › Protección de Play Store › Firma de apps* (se mudó
   de *Integridad de la app* en 2026). Play App Signing:
   SHA-1 `AC:3C:BF:B5:AD:65:64:54:5B:7C:EA:12:A3:7C:B9:B6:64:DF:A9:82`,
   SHA-256 `3E:50:B5:AC:…:8F:69`. El keystore de EAS: SHA-1
   `CF:E5:2D:80:74:1C:DA:56:EB:E4:B9:10:C7:D9:F9:BE:C6:5A:ED:8E`, SHA-256
   `66:48:66:69:…:9B:62`.
5. La ficha de Play pide lo mismo que Apple más el formulario de *Data safety*
   y, para una app con login, credenciales de prueba en *App content*.

## Pendientes para las próximas versiones

Avisos de Google Play sobre la versión 1.0.0 (4), la primera enviada a
producción (1-oct-2026). Ninguno bloqueó la revisión; quedan para una 1.0.1
una vez aprobadas las dos tiendas.

1. **Activar R8 (minificación y ofuscación) en Android — antes de febrero
   de 2027.** Play marca *"La optimización del código DEX está por debajo
   de nuestro umbral"* (ofuscación al 1 %) y avisa que bajo el 25 % puede
   afectar la visibilidad y la publicación. Expo lo deja apagado; se
   enciende con `expo-build-properties` en `app.json`
   (`android.enableMinifyInReleaseBuilds: true` y
   `enableShrinkResourcesInReleaseBuilds: true`). **Probar a fondo antes
   de enviar**: R8 a veces rompe librerías que usan reflexión, y el fallo
   aparece solo en el build de release, no en desarrollo — instalar el
   `.aab` desde la prueba interna y recorrer login, visitas (marcar, fotos,
   mapa), chat (fotos, documentos, videos), informes (editor y PDF) y la
   galería propia. Con R8 encendido, subir también el `mapping.txt` que
   genera, para que los reportes de fallas de Play lleguen legibles (es la
   advertencia del *archivo de desofuscación* que salió al subir la 1.0.0).
2. **APIs obsoletas de borde a borde** (`Window.setStatusBarColor`,
   `setNavigationBarColor`, `LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES`),
   recomendado y sin fecha. Vienen de React Native
   (`StatusBarModule`, `WindowUtilKt.enableEdgeToEdge`) y de
   `com.google.android.material.bottomsheet`, no del código de la app: se
   resuelve al subir de SDK de Expo (`npx expo install expo@latest --fix`,
   moviendo junto el `overrides.expo` de la raíz).
3. **Orientación fija en vertical**, recomendado y sin fecha. `app.json`
   tiene `"orientation": "portrait"`, y desde Android 16 las tablets y los
   plegables lo ignoran. En un teléfono no cambia nada; en una tablet la
   app se podrá girar sin que las pantallas estén pensadas para eso.
   Cuando se aborde: probar en una tablet de Android Studio en horizontal
   y decidir si se adaptan las pantallas o se deja así. También aparece
   `GmsBarcodeScanningDelegateActivity` (ML Kit, de una dependencia), que
   no es nuestra.
4. **Si Google rechaza el permiso de fotos y videos**
   (`READ_MEDIA_IMAGES` / `READ_MEDIA_VIDEO`): la galería propia
   (`SelectorDeGaleria`, `expo-media-library`) es lo que lo pide. La salida
   es que en Android la app use el selector de fotos del sistema
   (`expo-image-picker`) en lugar de la galería propia, y quitar esos
   permisos del manifiesto; en iOS se queda igual. Se pierde ver las fotos
   ya marcadas al volver a abrirla.
5. **Los textos de las tiendas todavía son solo del equipo**: con el
   modo invitado, agregar la parte de los clientes (catálogo,
   solicitudes, ver sus visitas) a las dos fichas —ya está en
   `apps/mobile/tienda/textos.md`— y responder de nuevo *Data safety* de Play
   y la privacidad de App Store: ahora se recogen nombre y teléfono de
   cualquiera que mande una solicitud.
