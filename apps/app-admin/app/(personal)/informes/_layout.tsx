import { Stack } from "expo-router";

export default function PersonalInformesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
      <Stack.Screen name="filtros" options={{ title: "Filtros" }} />
      <Stack.Screen name="nuevo" options={{ title: "Nuevo informe" }} />
    </Stack>
  );
}
