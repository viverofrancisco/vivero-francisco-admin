import { create } from "zustand";
import { API_BASE_URL } from "./config";

/**
 * Si la app llega al servidor. Es lo que dibuja el "Conectando…" de arriba,
 * como en WhatsApp.
 *
 * No pregunta al sistema si hay red —eso sería `NetInfo`, otro módulo nativo
 * y otra compilación— sino a los propios pedidos: el primero que no llega
 * apaga la luz, y desde ahí se sondea un `ping` cada cinco segundos hasta que
 * conteste. Cualquier pedido que sí llegue la vuelve a prender. Es lo mismo
 * que dice WhatsApp: no "el teléfono tiene señal" sino "estamos hablando con
 * el servidor", que es lo único que a quien mira le importa.
 */
interface Conexion {
  enLinea: boolean;
  /** Un pedido no llegó. */
  caida: () => void;
  /** Un pedido llegó. */
  recuperada: () => void;
}

const SONDEO_MS = 5000;
let sondeo: ReturnType<typeof setInterval> | null = null;

async function hayAlguien(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/mobile/ping`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

export const useConexion = create<Conexion>((set, get) => ({
  enLinea: true,
  caida: () => {
    if (get().enLinea) set({ enLinea: false });
    if (sondeo) return;
    sondeo = setInterval(async () => {
      if (await hayAlguien()) get().recuperada();
    }, SONDEO_MS);
  },
  recuperada: () => {
    if (sondeo) {
      clearInterval(sondeo);
      sondeo = null;
    }
    if (!get().enLinea) set({ enLinea: true });
  },
}));
