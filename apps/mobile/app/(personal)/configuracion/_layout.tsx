import { Stack } from "expo-router";

export default function PersonalConfiguracionLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Cuenta" }} />
    </Stack>
  );
}
