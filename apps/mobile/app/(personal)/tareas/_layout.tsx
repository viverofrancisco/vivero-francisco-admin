import { Stack } from "expo-router";

export default function TareasLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      {/* El formulario trae su propio encabezado (Cancelar · título · Crear). */}
      <Stack.Screen name="nueva" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
    </Stack>
  );
}
