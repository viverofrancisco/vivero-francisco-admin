import { Stack } from "expo-router";

export default function PersonalMasLayout() {
  return (
    <Stack>
      {/* Sin barra: la pestaña de abajo ya dice "Más", y arriba solo
          repetía la palabra sobre una franja vacía. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
