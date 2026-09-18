import { Stack } from "expo-router";

export default function TareasLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="nueva" options={{ title: "Nueva tarea" }} />
      <Stack.Screen name="[id]" options={{ title: "Tarea" }} />
    </Stack>
  );
}
