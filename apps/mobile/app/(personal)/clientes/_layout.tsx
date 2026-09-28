import { Stack } from "expo-router";

export default function PersonalClientesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      {/* La ficha trae su encabezado (`EncabezadoDeFicha`), como la orden. */}
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
      {/* Los formularios traen su propio encabezado —Cancelar · título ·
          acción, `EncabezadoDeFormulario`—, como Nueva orden y Nueva
          suscripción: la barra nativa decía "index" en la flecha y la
          acción quedaba en un botón al pie, que con el teclado abierto se
          iba de la pantalla. */}
      <Stack.Screen name="nuevo" options={{ headerShown: false }} />
      <Stack.Screen name="editar/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="propiedades/nueva" options={{ headerShown: false }} />
      <Stack.Screen
        name="propiedades/[propiedadId]"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="asignar/[id]"
        options={{ title: "Asignar servicio" }}
      />
    </Stack>
  );
}
