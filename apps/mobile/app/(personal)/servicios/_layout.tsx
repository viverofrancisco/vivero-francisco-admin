import { Stack } from "expo-router";

export default function PersonalServiciosLayout() {
  return (
    <Stack>
      {/* Sin barra nativa en la lista: el título grande lo pone la pantalla, como
          en el portal. En las fichas se queda, que es donde hace falta la flecha
          de volver. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: "Producto" }} />
      <Stack.Screen name="nuevo" options={{ title: "Nuevo producto" }} />
      <Stack.Screen
        name="editar/[id]"
        options={{ title: "Editar producto" }}
      />
    </Stack>
  );
}
