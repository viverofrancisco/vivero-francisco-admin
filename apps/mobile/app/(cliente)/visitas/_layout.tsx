import { Stack } from "expo-router";

export default function ClienteVisitasLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="calificar/[id]" options={{ title: "Calificar" }} />
      <Stack.Screen name="[id]" options={{ title: "Visita" }} />
    </Stack>
  );
}
