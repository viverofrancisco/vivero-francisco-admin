import { Stack } from "expo-router";

export default function ClienteVisitasLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Mis visitas" }} />
      <Stack.Screen name="[id]" options={{ title: "Visita" }} />
      <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
    </Stack>
  );
}
