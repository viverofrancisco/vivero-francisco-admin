import { Stack } from "expo-router";

export default function PersonalVisitasLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Visitas" }} />
      <Stack.Screen name="[id]" options={{ title: "Visita" }} />
      <Stack.Screen name="nueva" options={{ title: "Nueva visita" }} />
      <Stack.Screen
        name="completar/[id]"
        options={{ headerShown: false, presentation: "modal" }}
      />
      <Stack.Screen
        name="incompleta/[id]"
        options={{ headerShown: false, presentation: "modal" }}
      />
      <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
    </Stack>
  );
}
