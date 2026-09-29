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
`eas submit -p ios --latest` (o `eas build … --auto-submit`). Un cambio solo
de JS puede ir por EAS Update sin pasar por la tienda, pero eso pide
`expo-updates`, que no está instalado; por ahora todo va por build.

## Visto en TestFlight

- **La barra de estado salía invisible** en el iPhone del usuario: hora y
  batería en blanco sobre el fondo blanco de la app. El teléfono estaba en
  modo oscuro, `app.json` traía `userInterfaceStyle: "automatic"` y el
  `<StatusBar style="auto">` de `_layout.tsx` seguía al sistema, mientras
  que la app es clara siempre (`tema.ts` no tiene paleta oscura). Ahora la
  app se declara `light` y la barra es `dark`. En el simulador nunca se vio
  porque estaba en modo claro: **probar en modo oscuro** antes de cada
  subida.

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
5. La ficha de Play pide lo mismo que Apple más el formulario de *Data safety*
   y, para una app con login, credenciales de prueba en *App content*.
