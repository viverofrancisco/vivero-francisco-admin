#!/usr/bin/env bash
# Compila la versión de desarrollo, la instala en el simulador y la abre.
#
# Reemplaza a `npm run ios` mientras Expo SDK 54 no soporte Xcode 27: su CLI
# busca la app "Simulator", que Xcode 27 cambió por DeviceHub, y se detiene
# aunque el simulador esté abierto. Además Xcode 27 rechaza los pods que
# piden iOS 13/14, de ahí IPHONEOS_DEPLOYMENT_TARGET=15.1.
#
#   npm run ios:sim                      # el simulador abierto, o "iPhone 17 Pro"
#   npm run ios:sim -- "iPhone 17 Pro Max"
#
# Con `npx expo start` corriendo, la app se conecta sola a Metro.
set -euo pipefail
cd "$(dirname "$0")/.."

NOMBRE=${1:-}

# Las claves de Google Maps que app.config.ts mete en el binario.
if [ -f .env ]; then set -a; . ./.env; set +a; fi

# La carpeta ios se genera de app.config.ts y no está en git. Si quedó de una
# configuración vieja (otro bundle id), hay que regenerarla:
#   npx expo prebuild -p ios --clean
if [ ! -d ios ]; then
  echo "› No está la carpeta ios: corriendo expo prebuild"
  npx expo prebuild -p ios --no-install
fi
if [ ! -d ios/Pods ] || ! cmp -s ios/Podfile.lock ios/Pods/Manifest.lock; then
  echo "› Instalando los pods"
  (cd ios && pod install)
fi
WORKSPACE=$(ls -d ios/*.xcworkspace | head -1)
SCHEME=$(basename "$WORKSPACE" .xcworkspace)

# El simulador: el que pidas por nombre, si no el que esté encendido, si no
# un iPhone 17 Pro.
if [ -n "$NOMBRE" ]; then
  UDID=$(xcrun simctl list devices available | grep -F "    $NOMBRE (" | head -1 | grep -oE '[0-9A-F-]{36}' || true)
  [ -n "$UDID" ] || { echo "No hay un simulador llamado \"$NOMBRE\". Mira: xcrun simctl list devices available"; exit 1; }
else
  UDID=$(xcrun simctl list devices booted | grep -oE '[0-9A-F-]{36}' | head -1 || true)
  if [ -z "$UDID" ]; then
    UDID=$(xcrun simctl list devices available | grep -F "    iPhone 17 Pro (" | head -1 | grep -oE '[0-9A-F-]{36}' || true)
  fi
  [ -n "$UDID" ] || { echo "No encontré un simulador. Ábrelo desde DeviceHub y vuelve a correr esto."; exit 1; }
fi

xcrun simctl boot "$UDID" 2>/dev/null || true
open -a /Applications/Xcode.app/Contents/Applications/DeviceHub.app 2>/dev/null \
  || open -a Simulator 2>/dev/null || true

LOG=ios/build/ios-sim.log
mkdir -p ios/build
echo "› Compilando (la primera vez tarda varios minutos; el detalle queda en apps/app-admin/$LOG)"
if ! xcodebuild -workspace "$WORKSPACE" -scheme "$SCHEME" -configuration Debug \
  -destination "id=$UDID" -derivedDataPath ios/build/dd \
  IPHONEOS_DEPLOYMENT_TARGET=15.1 build >"$LOG" 2>&1; then
  grep -E "error:" "$LOG" | head -20
  echo "✗ La compilación falló. El detalle completo está en apps/app-admin/$LOG"
  exit 1
fi

echo "› Instalando en el simulador"
# El .app se llama como el `name` de app.json, no como el workspace: al pasar
# a "Vivero Admin" salió ViveroAdmin.app con el esquema ViveroFranciscoAdmin.
APP=$(ls -d ios/build/dd/Build/Products/Debug-iphonesimulator/*.app | head -1)
BUNDLE_ID=$(/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "$APP/Info.plist")
xcrun simctl terminate "$UDID" "$BUNDLE_ID" 2>/dev/null || true
xcrun simctl install "$UDID" "$APP"
xcrun simctl launch "$UDID" "$BUNDLE_ID" >/dev/null
echo "✓ Listo. Si Metro no está corriendo: npx expo start"
