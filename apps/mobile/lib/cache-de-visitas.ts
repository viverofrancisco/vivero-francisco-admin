import AsyncStorage from "@react-native-async-storage/async-storage";
import type { TareaDeCatalogo } from "@/components/VisitaResultForm";
import type { VisitaDetail } from "./types";

/**
 * Una copia local de las visitas, para verlas **sin señal**.
 *
 * Lo que se guarda es lo que la pantalla ya pidió: cada día que se abrió en la
 * lista —con la ficha completa de cada visita, porque la lista ya la trae— y
 * cada visita que se abrió. Se pinta primero y el servidor la reemplaza cuando
 * contesta; si no contesta, se queda, con el aviso de que es lo último que se
 * guardó. Es el mismo criterio que la copia de los chats: un snapshot para no
 * mirar un spinner ni una pantalla vacía, nunca la verdad.
 *
 * **No pesa.** Son fichas en JSON —unos pocos KB cada una—, no fotos: las
 * fotos siguen siendo direcciones en R2 que el teléfono baja cuando puede.
 * Y se poda sola: se guardan hasta `DIAS_MAX` días y `VISITAS_MAX` fichas, las
 * más recientes en guardarse, y el resto se borra al guardar. Con eso el
 * total queda en el orden de un MB aunque alguien recorra el calendario.
 */

const DIAS_MAX = 21;
const VISITAS_MAX = 300;
const CLAVE_INDICE = "visitas:cache:indice";
const CLAVE_TAREAS = "visitas:cache:tareas";
const claveDia = (dia: string) => `visitas:cache:dia:${dia}`;
const claveVisita = (id: string) => `visitas:cache:visita:${id}`;

interface Indice {
  /** Día ISO → cuándo se guardó. */
  dias: Record<string, string>;
  /** Id de visita → cuándo se guardó. */
  visitas: Record<string, string>;
}

let indiceEnMemoria: Indice | null = null;

/** Al cambiar de cuenta: el índice en memoria es de la anterior. */
export function olvidarIndiceEnMemoria() {
  indiceEnMemoria = null;
}

async function leerIndice(): Promise<Indice> {
  if (indiceEnMemoria) return indiceEnMemoria;
  try {
    const crudo = await AsyncStorage.getItem(CLAVE_INDICE);
    const leido = crudo ? (JSON.parse(crudo) as Indice) : null;
    indiceEnMemoria = leido?.dias && leido?.visitas ? leido : { dias: {}, visitas: {} };
  } catch {
    indiceEnMemoria = { dias: {}, visitas: {} };
  }
  return indiceEnMemoria;
}

/** Los que sobran, del más viejo en guardarse: para borrarlos. */
function sobrantes(guardados: Record<string, string>, maximo: number): string[] {
  const claves = Object.keys(guardados);
  if (claves.length <= maximo) return [];
  return claves
    .sort((a, b) => guardados[a].localeCompare(guardados[b]))
    .slice(0, claves.length - maximo);
}

async function anotar(cambio: (i: Indice) => void) {
  const indice = await leerIndice();
  cambio(indice);
  const diasFuera = sobrantes(indice.dias, DIAS_MAX);
  const visitasFuera = sobrantes(indice.visitas, VISITAS_MAX);
  diasFuera.forEach((d) => delete indice.dias[d]);
  visitasFuera.forEach((v) => delete indice.visitas[v]);
  const aBorrar = [...diasFuera.map(claveDia), ...visitasFuera.map(claveVisita)];
  try {
    if (aBorrar.length > 0) await AsyncStorage.multiRemove(aBorrar);
    await AsyncStorage.setItem(CLAVE_INDICE, JSON.stringify(indice));
  } catch {
    // Sin almacenamiento no hay copia, y no pasa nada.
  }
}

async function leer<T>(clave: string): Promise<T | null> {
  try {
    const crudo = await AsyncStorage.getItem(clave);
    return crudo ? (JSON.parse(crudo) as T) : null;
  } catch {
    return null;
  }
}

/** Las visitas de un día (`YYYY-MM-DD`), como las mandó el servidor la última vez. */
export async function leerDia(dia: string): Promise<VisitaDetail[] | null> {
  const lista = await leer<VisitaDetail[]>(claveDia(dia));
  return Array.isArray(lista) ? lista : null;
}

/**
 * Guardar un día entero, y **cada visita por separado**: la lista ya trae la
 * ficha completa, así que abrir hoy con señal deja todas las de hoy listas
 * para abrirse sin ella.
 */
export function guardarDia(dia: string, items: VisitaDetail[]) {
  const ahora = new Date().toISOString();
  const pares: [string, string][] = [
    [claveDia(dia), JSON.stringify(items)],
    ...items.map((v): [string, string] => [claveVisita(v.id), JSON.stringify(v)]),
  ];
  AsyncStorage.multiSet(pares)
    .then(() =>
      anotar((i) => {
        i.dias[dia] = ahora;
        items.forEach((v) => {
          i.visitas[v.id] = ahora;
        });
      })
    )
    .catch(() => {});
}

export async function leerVisita(id: string): Promise<VisitaDetail | null> {
  const v = await leer<VisitaDetail>(claveVisita(id));
  return v && v.id === id ? v : null;
}

export function guardarVisita(v: VisitaDetail) {
  const ahora = new Date().toISOString();
  AsyncStorage.setItem(claveVisita(v.id), JSON.stringify(v))
    .then(() =>
      anotar((i) => {
        i.visitas[v.id] = ahora;
      })
    )
    .catch(() => {});
}

/** El catálogo de tareas: sin él no se puede cargar el parte ni etiquetar fotos. */
export async function leerTareas(): Promise<TareaDeCatalogo[] | null> {
  const t = await leer<TareaDeCatalogo[]>(CLAVE_TAREAS);
  return Array.isArray(t) && t.length > 0 ? t : null;
}

export function guardarTareas(items: TareaDeCatalogo[]) {
  if (items.length === 0) return;
  AsyncStorage.setItem(CLAVE_TAREAS, JSON.stringify(items)).catch(() => {});
}
