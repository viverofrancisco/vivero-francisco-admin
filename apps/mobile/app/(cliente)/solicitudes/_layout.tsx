import { Stack } from "expo-router";

// La lista va siempre debajo: el formulario se abre también desde Mis visitas
// y desde un producto, y al enviarlo o cancelarlo se vuelve a ella, donde se
// ve el pedido recién hecho.
export const unstable_settings = { initialRouteName: "index" };

export default function ClienteSolicitudesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      {/* A pantalla completa y por encima de las pestañas: el formulario ocupa
          la pantalla y la barra de abajo no tiene nada que hacer ahí. */}
      <Stack.Screen name="nueva" options={{ presentation: "fullScreenModal" }} />
    </Stack>
  );
}
