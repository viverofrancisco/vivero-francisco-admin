import { Stack } from "expo-router";

export default function ChatsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      {/* La conversación pone su propio encabezado: el nombre del chat y
          quiénes están, que es lo que hace falta ahí adentro. */}
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
      {/* Sin encabezado nativo: la pantalla pone el suyo, con Cancelar a la
          izquierda y Crear a la derecha. El de la pila decía "‹ index". */}
      <Stack.Screen name="nuevo" options={{ headerShown: false }} />
      {/* Quién leyó un mensaje: pone su propio encabezado, como la conversación. */}
      <Stack.Screen name="info/[mensajeId]" options={{ headerShown: false }} />
    </Stack>
  );
}
