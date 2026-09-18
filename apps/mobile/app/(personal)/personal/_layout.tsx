import { Stack } from "expo-router";

export default function PersonalLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Personal" }} />
      <Stack.Screen name="nuevo" options={{ title: "Nueva persona" }} />
      <Stack.Screen name="[id]" options={{ title: "Ficha" }} />
    </Stack>
  );
}
