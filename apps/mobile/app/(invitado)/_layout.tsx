import { Stack } from "expo-router";

/**
 * El modo invitado: el catálogo y pedir una visita o una cotización, sin
 * cuenta. Es lo que hace que la app le sirva a quien la descarga sin ser
 * cliente todavía —y lo que Apple pidió para publicarla (regla 3.2)—.
 * `useAuthGate` lo deja pasar sin sesión.
 */
export default function InvitadoLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
