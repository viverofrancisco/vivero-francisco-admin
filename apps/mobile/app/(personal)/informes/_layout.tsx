import { Stack } from "expo-router";

export default function PersonalInformesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Informes" }} />
      <Stack.Screen name="[id]" options={{ title: "Informe" }} />
      <Stack.Screen name="filtros" options={{ title: "Filtros" }} />
      <Stack.Screen
        name="filtros-cliente"
        options={{ title: "Cliente" }}
      />
      <Stack.Screen name="nuevo" options={{ title: "Nuevo informe" }} />
    </Stack>
  );
}
