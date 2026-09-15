import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { PaperProvider, MD3LightTheme } from "react-native-paper";
import { LocaleConfig } from "react-native-calendars";
import "react-native-gesture-handler";
import "react-native-reanimated";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useAuthStore } from "@/lib/auth-store";
import { apiRequest } from "@/lib/api";
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

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;

    let cancelled = false;
    async function ensureUser() {
      if (user || !refreshToken) return;
      try {
        const me = await apiRequest<MeResponse>("/api/mobile/auth/me");
        if (cancelled) return;
        setUser({
          id: me.id,
          role: me.role,
          name: me.name,
          apellido: me.apellido,
          email: me.email,
          personalId: me.personalId,
          clienteId: me.clienteId,
        });
      } catch {
        if (!cancelled) await clear();
      }
    }
    ensureUser();
    return () => {
      cancelled = true;
    };
  }, [hydrated, user, refreshToken, setUser, clear]);

  useEffect(() => {
    if (!hydrated) return;
    const inAuth = segments[0] === "(auth)";
    const inCliente = segments[0] === "(cliente)";
    const inPersonal = segments[0] === "(personal)";

    if (!user) {
      if (!inAuth) router.replace("/(auth)/onboarding");
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
  }, [hydrated, user, segments, router]);
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
        </Stack>
        <StatusBar style="auto" />
      </PaperProvider>
    </GestureHandlerRootView>
  );
}
