import { Stack } from "expo-router";

export default function PersonalServiciosLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Productos" }} />
      <Stack.Screen name="[id]" options={{ title: "Producto" }} />
      <Stack.Screen name="nuevo" options={{ title: "Nuevo producto" }} />
      <Stack.Screen
        name="editar/[id]"
        options={{ title: "Editar producto" }}
      />
    </Stack>
  );
}
