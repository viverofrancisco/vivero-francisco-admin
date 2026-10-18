import { Stack } from "expo-router";

/**
 * El modo invitado: el catálogo y pedir una visita, sin cuenta. Es lo que hace
 * que la app le sirva a quien la descarga sin ser cliente todavía —y lo que
 * Apple pidió para publicarla (regla 3.2)—. `useAuthGate` lo deja pasar sin
 * sesión.
 *
 * Las pestañas van en `(tabs)`, como las del cliente con sesión, para que el
 * invitado reconozca la app que va a tener al crear su cuenta. El formulario
 * de la solicitud queda afuera, a pantalla completa y por encima de ellas:
 * ocupa la pantalla y la barra de abajo no tiene nada que hacer ahí.
 */
export default function InvitadoLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="solicitar" options={{ presentation: "fullScreenModal" }} />
    </Stack>
  );
}
