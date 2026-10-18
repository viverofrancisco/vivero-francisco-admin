import AsyncStorage from "@react-native-async-storage/async-storage";
import { CLAVE_DEL_CARRITO, traerCarritoDelInvitado, useCarrito } from "./carrito";

/**
 * Los datos que la app guarda en el teléfono son **de una cuenta**: en la de
 * clientes, el carrito. Entrar con **la misma** cuenta no toca nada; entrar
 * con **otra** lo vacía antes de que se pinte, porque es de quien lo armó. La
 * primera vez, sin dueño anotado (la app recién instalada o actualizada), se
 * deja: puede ser de quien entra. Lo que eligió como invitado se suma al de
 * la cuenta en los dos casos.
 *
 * La app del equipo tiene su propia versión, con las colas sin conexión de
 * visitas y chats.
 */
const CLAVE_DUENO = "sesion:dueno";

export async function prepararDatosPara(userId: string): Promise<void> {
  let dueno: string | null = null;
  try {
    dueno = await AsyncStorage.getItem(CLAVE_DUENO);
  } catch {
    dueno = null;
  }
  if (dueno !== userId) {
    try {
      if (dueno !== null) await AsyncStorage.removeItem(CLAVE_DEL_CARRITO);
      await AsyncStorage.setItem(CLAVE_DUENO, userId);
    } catch {
      // Si el disco falla, lo peor es ver un instante el carrito de antes.
    }
    if (dueno !== null) useCarrito.setState({ dueno: "cuenta", lineas: [], hidratado: false });
  }
  // Lo que eligió como invitado antes de entrar no se pierde.
  await traerCarritoDelInvitado();
}
