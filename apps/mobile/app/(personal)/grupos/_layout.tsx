import { Stack } from "expo-router";

export default function GruposLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Grupos" }} />
      <Stack.Screen name="nuevo" options={{ title: "Nuevo grupo" }} />
      <Stack.Screen name="[id]" options={{ title: "Grupo" }} />
    </Stack>
  );
}
