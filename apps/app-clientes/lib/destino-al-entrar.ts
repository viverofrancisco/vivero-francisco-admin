/**
 * A dónde va el cliente al abrir sesión, cuando no es a sus visitas.
 *
 * El que decide adónde se va al entrar es `useAuthGate` (`app/_layout.tsx`):
 * si la pantalla de login o de registro navegara por su cuenta, las dos
 * órdenes competirían. Así que quien sabe de dónde vino —el checkout de
 * invitado, con *Iniciar sesión* o *Crear cuenta*— lo deja anotado acá antes
 * de abrir la sesión, y el gate lo toma una sola vez.
 */
export type DestinoAlEntrar = "checkout";

let pendiente: DestinoAlEntrar | null = null;

export function irAlEntrarA(destino: DestinoAlEntrar | null): void {
  pendiente = destino;
}

/** Lo anotado, y lo borra: sirve para una entrada, no para las siguientes. */
export function tomarDestinoAlEntrar(): DestinoAlEntrar | null {
  const d = pendiente;
  pendiente = null;
  return d;
}
