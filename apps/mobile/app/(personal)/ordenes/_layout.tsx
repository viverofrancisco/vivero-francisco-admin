import { Stack } from "expo-router";

export default function OrdenesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Órdenes" }} />
      <Stack.Screen name="[id]" options={{ title: "Orden" }} />
    </Stack>
  );
}
