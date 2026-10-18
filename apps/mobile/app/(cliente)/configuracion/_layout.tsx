import { Stack } from "expo-router";

export default function ClienteConfiguracionLayout() {
  return (
    <Stack>
      {/* Sin encabezado, como la del equipo: la pestaña ya dice Cuenta y el
          nombre de quien la abre está grande en el medio. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
