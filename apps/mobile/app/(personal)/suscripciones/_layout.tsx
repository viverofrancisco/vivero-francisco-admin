import { Stack } from "expo-router";

export default function SuscripcionesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      {/* Sin barra nativa: la flecha vive al lado del nombre del cliente,
          como en la ficha de la visita (`EncabezadoDeFicha`). */}
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
      {/* Cancelar y Crear viven en un encabezado propio (`EncabezadoDeFormulario`). */}
      <Stack.Screen name="nueva" options={{ headerShown: false }} />
    </Stack>
  );
}
