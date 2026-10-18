import { Stack } from "expo-router";

export default function ClienteCarritoLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      {/* Confirmar es un formulario: a pantalla completa, sin las pestañas. */}
      <Stack.Screen name="confirmar" options={{ presentation: "fullScreenModal" }} />
    </Stack>
  );
}
