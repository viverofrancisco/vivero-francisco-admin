import { Stack } from "expo-router";

export default function PersonalVisitasLayout() {
  return (
    <Stack>
      {/* Sin encabezado: decía "Visitas" arriba de una pantalla de visitas,
          a la que se llega desde una pestaña que dice "Visitas". El selector
          de día es el título de verdad. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: "Visita" }} />
      <Stack.Screen name="nueva" options={{ title: "Nueva visita" }} />
      <Stack.Screen
        name="completar/[id]"
        options={{ headerShown: false, presentation: "modal" }}
      />
    </Stack>
  );
}
