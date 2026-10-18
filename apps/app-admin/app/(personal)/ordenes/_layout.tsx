import { Stack } from "expo-router";

export default function OrdenesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      {/* Sin barra nativa: la flecha vive al lado del número de la orden,
          como en la ficha de la visita (`EncabezadoDeFicha`). */}
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
      <Stack.Screen name="emitir/[id]" options={{ headerShown: false }} />
      {/* Cancelar y Crear viven en un encabezado propio (`EncabezadoDeFormulario`). */}
      <Stack.Screen name="nueva" options={{ headerShown: false }} />
    </Stack>
  );
}
