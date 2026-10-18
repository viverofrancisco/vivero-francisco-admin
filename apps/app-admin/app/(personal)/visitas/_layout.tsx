import { Stack } from "expo-router";

export default function PersonalVisitasLayout() {
  return (
    <Stack>
      {/* Sin encabezado: decía "Visitas" arriba de una pantalla de visitas,
          a la que se llega desde una pestaña que dice "Visitas". El selector
          de día es el título de verdad. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      {/* Sin encabezado nativo: decía "Visita" arriba de una visita, y la
          flecha de atrás mostraba "index" —el nombre de la ruta— porque la
          lista ya no tiene título del cual tomarlo. La flecha vive al lado del
          nombre del cliente, que es donde el pulgar la busca. */}
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
      <Stack.Screen name="nueva" options={{ title: "Nueva visita" }} />
      <Stack.Screen
        name="completar/[id]"
        options={{ headerShown: false, presentation: "modal" }}
      />
    </Stack>
  );
}
