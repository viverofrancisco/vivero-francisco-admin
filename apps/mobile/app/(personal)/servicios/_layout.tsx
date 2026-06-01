import { Stack } from "expo-router";

export default function PersonalServiciosLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Servicios" }} />
      <Stack.Screen name="[id]" options={{ title: "Servicio" }} />
      <Stack.Screen name="nuevo" options={{ title: "Nuevo servicio" }} />
      <Stack.Screen
        name="editar/[id]"
        options={{ title: "Editar servicio" }}
      />
    </Stack>
  );
}
