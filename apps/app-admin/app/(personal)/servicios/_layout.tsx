import { Stack } from "expo-router";

export default function PersonalServiciosLayout() {
  return (
    <Stack>
      {/* Sin barra nativa en ninguna: la lista pone su título grande, la ficha
          lleva `EncabezadoDeFicha` y los formularios `EncabezadoDeFormulario`,
          como el resto de la app. La nativa decía "index" en la flecha. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
      <Stack.Screen name="nuevo" options={{ headerShown: false }} />
      <Stack.Screen name="editar/[id]" options={{ headerShown: false }} />
    </Stack>
  );
}
