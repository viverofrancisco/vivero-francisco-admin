import { Stack } from "expo-router";

export default function PersonalClientesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: "Cliente" }} />
      <Stack.Screen name="nuevo" options={{ title: "Nuevo cliente" }} />
      <Stack.Screen
        name="editar/[id]"
        options={{ title: "Editar cliente" }}
      />
      <Stack.Screen
        name="propiedades/nueva"
        options={{ title: "Nueva propiedad" }}
      />
      <Stack.Screen
        name="propiedades/[propiedadId]"
        options={{ title: "Propiedad" }}
      />
      <Stack.Screen
        name="asignar/[id]"
        options={{ title: "Asignar servicio" }}
      />
    </Stack>
  );
}
