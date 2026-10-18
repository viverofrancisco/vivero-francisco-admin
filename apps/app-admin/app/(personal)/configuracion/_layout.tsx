import { Stack } from "expo-router";

export default function PersonalConfiguracionLayout() {
  return (
    <Stack>
      {/* Sin encabezado: decía "Cuenta" arriba de una pantalla a la que se
          llega desde una pestaña que dice Cuenta, y el nombre de quien la
          abre ya está grande en el medio. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
