import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

/**
 * El carrito del cliente, **en el teléfono**: sobrevive a cerrar la app y no
 * hace falta señal para armarlo. Es de una cuenta —`datos-de-la-cuenta.ts` lo
 * borra si entra otra en el mismo teléfono—.
 *
 * **El invitado tiene el suyo, aparte** (`carrito:invitado`): quien cierra su
 * sesión y sigue como invitado no tiene por qué ver lo que armó la cuenta, y
 * el próximo que entre no tiene por qué heredar lo del invitado sin querer.
 * Pero lo que eligió sin cuenta **no se pierde** al iniciar sesión o crearla:
 * `traerCarritoDelInvitado` lo suma al de la cuenta que entra —es la misma
 * persona en el mismo teléfono, que eligió plantas y después se registró—.
 *
 * Lo que se guarda de cada línea es lo que hace falta para **mostrarla** sin
 * volver a preguntar: el nombre, la variante, la foto y el precio con IVA del
 * momento. Al confirmar solo viaja `varianteId` y `cantidad`: el precio y el
 * stock los decide el servidor, y si algo cambió lo dice.
 */
export interface LineaDelCarrito {
  varianteId: string;
  productoId: string;
  nombre: string;
  /** "Rojo / Grande"; vacío sin opciones. */
  variante: string;
  imagenUrl: string | null;
  /** Con IVA; 0 es *Gratis*. */
  precio: number;
  cantidad: number;
  /** Lo que quedaba al añadirlo; `null` sin límite. Tope de la cantidad. */
  disponible: number | null;
}

/**
 * Lo que quedó guardado de antes, sin los servicios: el catálogo se quedó con
 * los bienes —un servicio se pide marcándolo en la solicitud de visita— y el
 * servidor rechaza un pedido que los trae, así que un carrito viejo con una
 * poda adentro no podría confirmarse nunca. Se reconocían por `servicio` o
 * por no tener precio (*Por cotizar*).
 */
function sinServicios(crudas: unknown): LineaDelCarrito[] {
  if (!Array.isArray(crudas)) return [];
  return (crudas as (LineaDelCarrito & { servicio?: boolean; precio: number | null })[])
    .filter((l) => !l.servicio && typeof l.precio === "number")
    .map(({ servicio: _servicio, ...l }) => l as LineaDelCarrito);
}

const CLAVE = "carrito:lineas";
const CLAVE_INVITADO = "carrito:invitado";

/** De quién es el carrito que se muestra: de la cuenta con sesión, o del invitado. */
export type DuenoDelCarrito = "cuenta" | "invitado";
const claveDe = (dueno: DuenoDelCarrito) => (dueno === "invitado" ? CLAVE_INVITADO : CLAVE);

interface EstadoCarrito {
  lineas: LineaDelCarrito[];
  hidratado: boolean;
  /** Dónde se guarda el que está en memoria. */
  dueno: DuenoDelCarrito;
  /** Lo lee del teléfono; con otro dueño que el cargado, lo vuelve a leer. */
  hidratar: (dueno?: DuenoDelCarrito) => Promise<void>;
  /** Suma a lo que ya había de esa variante, sin pasarse de lo disponible. */
  anadir: (linea: LineaDelCarrito) => void;
  cambiarCantidad: (varianteId: string, cantidad: number) => void;
  quitar: (varianteId: string) => void;
  vaciar: () => void;
}

function guardar(dueno: DuenoDelCarrito, lineas: LineaDelCarrito[]) {
  AsyncStorage.setItem(claveDe(dueno), JSON.stringify(lineas)).catch(() => {});
}

function tope(cantidad: number, disponible: number | null): number {
  const max = disponible === null ? 999 : disponible;
  return Math.max(1, Math.min(cantidad, max));
}

export const useCarrito = create<EstadoCarrito>((set, get) => ({
  lineas: [],
  hidratado: false,
  dueno: "cuenta",

  hidratar: async (dueno = "cuenta") => {
    if (get().hidratado && get().dueno === dueno) return;
    // Se cambia de dueño antes de leer, así nada de lo que se toque mientras
    // tanto se guarda en el carrito equivocado.
    set({ dueno, lineas: [], hidratado: false });
    try {
      const crudo = await AsyncStorage.getItem(claveDe(dueno));
      const lineas = crudo ? sinServicios(JSON.parse(crudo)) : [];
      if (get().dueno === dueno) set({ lineas, hidratado: true });
    } catch {
      if (get().dueno === dueno) set({ hidratado: true });
    }
  },

  anadir: (linea) => {
    const lineas = [...get().lineas];
    const i = lineas.findIndex((l) => l.varianteId === linea.varianteId);
    if (i >= 0) {
      lineas[i] = {
        ...linea,
        cantidad: tope(lineas[i].cantidad + linea.cantidad, linea.disponible),
      };
    } else {
      lineas.push({ ...linea, cantidad: tope(linea.cantidad, linea.disponible) });
    }
    guardar(get().dueno, lineas);
    set({ lineas });
  },

  cambiarCantidad: (varianteId, cantidad) => {
    const lineas = get().lineas.map((l) =>
      l.varianteId === varianteId ? { ...l, cantidad: tope(cantidad, l.disponible) } : l
    );
    guardar(get().dueno, lineas);
    set({ lineas });
  },

  quitar: (varianteId) => {
    const lineas = get().lineas.filter((l) => l.varianteId !== varianteId);
    guardar(get().dueno, lineas);
    set({ lineas });
  },

  vaciar: () => {
    guardar(get().dueno, []);
    set({ lineas: [] });
  },
}));

/** Cuántas unidades hay en el carrito: el número de la pestaña. */
export function unidadesEnElCarrito(lineas: LineaDelCarrito[]): number {
  return lineas.reduce((n, l) => n + l.cantidad, 0);
}

export const CLAVE_DEL_CARRITO = CLAVE;

/**
 * Lo que el invitado puso en su carrito, sumado al de la cuenta que acaba de
 * entrar (la misma variante suma sus cantidades), y el del invitado vaciado.
 * Va **después** de `prepararDatosPara`, que puede haber borrado el de una
 * cuenta anterior: lo que se suma es lo que esta persona eligió recién.
 */
export async function traerCarritoDelInvitado(): Promise<void> {
  try {
    const crudoInvitado = await AsyncStorage.getItem(CLAVE_INVITADO);
    const delInvitado = crudoInvitado ? sinServicios(JSON.parse(crudoInvitado)) : [];
    if (delInvitado.length === 0) return;
    const crudo = await AsyncStorage.getItem(CLAVE);
    const lineas = crudo ? sinServicios(JSON.parse(crudo)) : [];
    for (const l of delInvitado) {
      const i = lineas.findIndex((x) => x.varianteId === l.varianteId);
      if (i >= 0) {
        lineas[i] = { ...l, cantidad: tope(lineas[i].cantidad + l.cantidad, l.disponible) };
      } else {
        lineas.push(l);
      }
    }
    await AsyncStorage.setItem(CLAVE, JSON.stringify(lineas));
    await AsyncStorage.removeItem(CLAVE_INVITADO);
    // Que la pestaña de la cuenta lo vuelva a leer con lo sumado.
    useCarrito.setState({ dueno: "cuenta", lineas: [], hidratado: false });
  } catch {
    // Si el disco falla, el carrito del invitado sigue ahí para la próxima.
  }
}

/** La línea para una variante elegida en la ficha. */
export function lineaDeLaFicha(
  producto: {
    id: string;
    nombre: string;
    imagenes: string[];
    imagenUrl: string | null;
  },
  variante: { id: string; nombre: string; precio: number | null; imagenUrl: string | null; disponible: number | null },
  cantidad: number
): LineaDelCarrito {
  return {
    varianteId: variante.id,
    productoId: producto.id,
    nombre: producto.nombre,
    variante: variante.nombre,
    imagenUrl: variante.imagenUrl ?? producto.imagenUrl ?? producto.imagenes[0] ?? null,
    precio: variante.precio ?? 0,
    cantidad,
    disponible: variante.disponible,
  };
}

/**
 * La línea para *Añadir* en una tarjeta: solo cuando el producto tiene una
 * variante (con varias se elige en el drawer de *Elegir opciones*). `null` si
 * no se puede añadir directo. La cantidad la pone la tarjeta.
 */
export function lineaDeLaTarjeta(p: {
  id: string;
  nombre: string;
  imagenUrl: string | null;
  precioDesde: number | null;
  varianteUnicaId: string | null;
  disponibleUnica: number | null;
}): LineaDelCarrito | null {
  if (!p.varianteUnicaId) return null;
  return {
    varianteId: p.varianteUnicaId,
    productoId: p.id,
    nombre: p.nombre,
    variante: "",
    imagenUrl: p.imagenUrl,
    precio: p.precioDesde ?? 0,
    cantidad: 1,
    disponible: p.disponibleUnica,
  };
}
