import AsyncStorage from "@react-native-async-storage/async-storage";
import { olvidarIndiceEnMemoria } from "./cache-de-visitas";
import { useColaDeEnvio } from "./cola-de-envio";
import { useColaDeVisitas } from "./cola-de-visitas";

/**
 * Los datos que la app guarda en el teléfono son **de una cuenta**.
 *
 * La copia de las visitas y de los chats se pintaba antes de la respuesta del
 * servidor sin preguntar de quién era: al entrar con otra cuenta en el mismo
 * teléfono, Chats mostraba un instante los chats de la anterior. Y las colas
 * de envío —mensajes, marcas, fotos hechos sin señal— son peores: lo que dejó
 * pendiente una persona habría salido con la sesión de la siguiente, firmado
 * por ella.
 *
 * Así que se recuerda de quién son. Entrar con **la misma** cuenta no toca
 * nada —volver después de que la sesión venció sin señal es el caso de todos
 * los días, y ahí lo pendiente tiene que seguir esperando—; entrar con
 * **otra** borra las copias y las colas antes de que se pinte nada. La
 * primera vez, sin dueño anotado (la app recién actualizada), se borran solo
 * las copias, que se vuelven a pedir: las colas pueden ser de quien entra.
 */
const CLAVE_DUENO = "sesion:dueno";
const PREFIJOS_DE_COPIAS = ["visitas:cache:", "chats:cache:"];
const COLAS = ["chats:cola-de-envio", "visitas:cola-de-trabajo"];

export async function prepararDatosPara(userId: string): Promise<void> {
  let dueno: string | null = null;
  try {
    dueno = await AsyncStorage.getItem(CLAVE_DUENO);
  } catch {
    dueno = null;
  }
  if (dueno === userId) return;

  try {
    const claves = await AsyncStorage.getAllKeys();
    const copias = claves.filter((c) => PREFIJOS_DE_COPIAS.some((p) => c.startsWith(p)));
    const borrar = dueno === null ? copias : [...copias, ...COLAS.filter((c) => claves.includes(c))];
    if (borrar.length > 0) await AsyncStorage.multiRemove(borrar);
    await AsyncStorage.setItem(CLAVE_DUENO, userId);
  } catch {
    // Si el disco falla, lo peor es ver un instante lo de antes: el servidor
    // lo reemplaza enseguida.
  }
  olvidarIndiceEnMemoria();
  if (dueno !== null) {
    useColaDeEnvio.setState({ items: [], hidratada: false });
    useColaDeVisitas.setState({ items: [], hidratada: false });
  }
}

/** Cuántas cosas esperan señal en este teléfono, para avisar antes de salir. */
export function pendientesSinEnviar(): number {
  return useColaDeEnvio.getState().items.length + useColaDeVisitas.getState().items.length;
}
