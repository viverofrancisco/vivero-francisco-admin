import { Stack } from "expo-router";

export default function PersonalMasLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Más" }} />
    </Stack>
  );
}
