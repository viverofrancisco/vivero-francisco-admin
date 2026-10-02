import { useEffect, useRef, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { PaperProvider, MD3LightTheme } from "react-native-paper";
import { LocaleConfig } from "react-native-calendars";
import "react-native-gesture-handler";
import "react-native-reanimated";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useAuthStore } from "@/lib/auth-store";
import { apiRequest, esApiError } from "@/lib/api";
import { resolverServidor } from "@/lib/config";
import { precargarBranding } from "@/lib/branding";
import { prepararDatosPara } from "@/lib/datos-de-la-cuenta";
import type { MeResponse } from "@vivero/shared";
import { tema } from "@/lib/tema";

LocaleConfig.locales.es = {
  monthNames: [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ],
  monthNamesShort: [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
  ],
  dayNames: [
    "Domingo", "Lunes", "Martes", "Miércoles",
    "Jueves", "Viernes", "Sábado",
  ],
  dayNamesShort: ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"],
  today: "Hoy",
};
LocaleConfig.defaultLocale = "es";

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: tema.verde,
    secondary: "#558b2f",
  },
};

function useAuthGate() {
  const { hydrated, hydrate, accessToken, refreshToken, user, setUser, clear } =
    useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  /** Si ya se preguntó quién es en este arranque. */
  const consultado = useRef(false);
  /**
   * Hay token pero no usuario guardado (quien viene de una versión que no lo
   * guardaba) y el servidor no contestó: sin saber el rol no hay a dónde
   * entrar, así que va al login sin cerrar la sesión.
   */
  const [sinRespuesta, setSinRespuesta] = useState(false);

  useEffect(() => {
    // Primero dónde está el portal, después la sesión: en desarrollo el
    // puerto puede no ser el 3000.
    // El logo guardado también: si no, el login pinta antes de tenerlo.
    Promise.all([resolverServidor(), precargarBranding()]).finally(() => hydrate());
  }, [hydrate]);

  /**
   * Quién es, al día: **una vez por arranque**, en cuanto se sabe si hay
   * sesión. Con el usuario guardado en el teléfono la app ya entró y esto corre
   * detrás, por si cambió el rol o el nombre; sin usuario guardado (quien viene
   * de una versión que no lo guardaba) la pantalla de carga lo espera.
   *
   * No depende de `refreshToken` ni de `user` a propósito: consultar `/me`
   * renueva el token, y con el token en las dependencias el efecto se
   * reiniciaba en medio de su propia consulta, descartaba la respuesta y ya no
   * volvía a preguntar —la app quedaba en la pantalla de carga para siempre
   * (build 11, 2-oct-2026)—. Lo que hace falta del store se lee en el momento.
   *
   * **Solo un rechazo del servidor cierra la sesión**: no tener señal al abrir
   * la app dejaba afuera a quien la abría en un jardín sin cobertura.
   */
  useEffect(() => {
    if (!hydrated || consultado.current) return;
    if (!useAuthStore.getState().refreshToken) return;
    consultado.current = true;
    // Sin marca de "sigue montado": es el layout raíz, no se desmonta, y una
    // marca así hacía descartar la respuesta cuando React corre el efecto dos
    // veces en desarrollo.
    void (async () => {
      try {
        const me = await apiRequest<MeResponse>("/api/mobile/auth/me");
        await prepararDatosPara(me.id);
        // Si en el medio cerró sesión, no se le vuelve a abrir.
        if (!useAuthStore.getState().refreshToken) return;
        setUser({
          id: me.id,
          role: me.role,
          name: me.name,
          apellido: me.apellido,
          email: me.email,
          usuario: me.usuario,
          personalId: me.personalId,
          clienteId: me.clienteId,
        });
      } catch (e) {
        const rechazada = esApiError(e) && (e.status === 401 || e.status === 403);
        if (rechazada) await clear();
        else setSinRespuesta(true);
      }
    })();
  }, [hydrated, setUser, clear]);

  /**
   * Red de seguridad: la pantalla de carga **nunca** se queda sola esperando.
   * Si a los 12 s todavía no se sabe quién es, va al login sin cerrar la
   * sesión —la consulta sigue y, si llega, entra—.
   */
  useEffect(() => {
    if (!hydrated || user || !refreshToken || sinRespuesta) return;
    const reloj = setTimeout(() => setSinRespuesta(true), 12_000);
    return () => clearTimeout(reloj);
  }, [hydrated, user, refreshToken, sinRespuesta]);

  useEffect(() => {
    if (!hydrated) return;
    // El enlace de acceso abierto en la app: vale con o sin sesión, y para
    // cualquier rol, así que no se lo manda a ningún lado. Ver la pantalla.
    if (segments[0] === "establecer-contrasena") return;
    const inAuth = segments[0] === "(auth)";
    const inCliente = segments[0] === "(cliente)";
    const inPersonal = segments[0] === "(personal)";

    if (!user) {
      // Con token y sin usuario guardado, se espera al servidor en la
      // pantalla de carga en vez de mostrar el login un instante.
      if (refreshToken && !sinRespuesta) return;
      if (!inAuth) router.replace("/(auth)/login");
      return;
    }

    if (user.role === "CLIENTE" && !inCliente) {
      router.replace("/(cliente)/visitas");
    } else if (!inPersonal) {
      // Todo el resto —oficina y jardineros— entra por acá. **El jardinero
      // ahora sí usa la app**: es donde carga lo que hizo en cada visita, que
      // es el motivo por el que cada uno tiene su cuenta.
      router.replace("/(personal)/visitas");
    }
  }, [hydrated, user, refreshToken, sinRespuesta, segments, router]);
}

export default function RootLayout() {
  useAuthGate();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={theme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(cliente)" />
          <Stack.Screen name="(personal)" />
          <Stack.Screen name="establecer-contrasena" />
        </Stack>
        {/* Oscuro y no "auto": la app es clara siempre —`tema.ts` no tiene
            paleta oscura— y "auto" seguía al sistema, así que en un iPhone
            en modo oscuro la hora y la batería salían blancas sobre nuestro
            fondo blanco. `userInterfaceStyle: "light"` en app.json dice lo
            mismo del lado nativo (alertas, teclado, hojas). */}
        <StatusBar style="dark" />
      </PaperProvider>
    </GestureHandlerRootView>
  );
}
