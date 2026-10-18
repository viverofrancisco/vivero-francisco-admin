import * as SecureStore from "expo-secure-store";

/**
 * Un identificador de **esta instalación** de la app.
 *
 * Viaja con cada marca de entrada y salida, y existe para una sola pregunta:
 * si dos personas de la misma visita marcaron desde el mismo teléfono. Eso es
 * alguien iniciando sesión con la cuenta de un compañero para marcarle la
 * entrada — y es lo único de ese engaño que deja rastro por sí solo, porque el
 * identificador es del aparato y no de la cuenta: la sesión prestada llega con
 * el teléfono de quien la usó.
 *
 * **No identifica a la persona y no prueba nada.** Lo genera el propio
 * dispositivo, así que quien sepa del control puede borrar los datos de la app
 * y volver con otro. Lo que hace es que el camino fácil deje una marca que la
 * oficina ve.
 *
 * Vive en el almacenamiento seguro y no en `AsyncStorage` porque tiene que
 * sobrevivir a cerrar sesión: si se borrara al salir, cada préstamo de cuenta
 * generaría un identificador nuevo y el control no detectaría nada.
 */
const CLAVE = "vivero.dispositivoId";

let enMemoria: string | null = null;

/**
 * Un identificador al azar, sin dependencias.
 *
 * `Math.random` no sirve para un secreto, y acá no hay ninguno: esto no es una
 * credencial, nadie gana nada adivinando el identificador de otro aparato —a lo
 * sumo se crearía un aviso falso contra sí mismo— y el cliente puede mandar lo
 * que quiera en ese campo de todos modos. Lo único que se le pide es no
 * repetirse entre los teléfonos del vivero, y para eso sobra.
 */
function generar(): string {
  const azar = () => Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${azar()}-${azar()}`;
}

export async function dispositivoId(): Promise<string | null> {
  if (enMemoria) return enMemoria;
  try {
    const guardado = await SecureStore.getItemAsync(CLAVE);
    if (guardado) {
      enMemoria = guardado;
      return guardado;
    }
    const nuevo = generar();
    await SecureStore.setItemAsync(CLAVE, nuevo);
    enMemoria = nuevo;
    return nuevo;
  } catch {
    // Sin almacenamiento seguro la marca sale igual, sin identificador: no
    // registrar el trabajo por no poder guardar un UUID sería cambiar el dato
    // que importa por el que ayuda.
    return null;
  }
}
