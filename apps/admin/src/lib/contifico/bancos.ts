/**
 * Cuentas bancarias de la empresa en Contífico.
 *
 * Son **las propias**, no las de los clientes: su documentación las agrupa bajo
 * «Mis Bancos». Hacen falta para registrar un cobro por transferencia, que pide
 * en cuál cayó la plata.
 */
import { contificoRequest } from "./client";

export interface CuentaBancaria {
  id: string;
  nombre: string;
  numero: string;
  /** `CC` corriente, `CA` ahorros. */
  tipo_cuenta: string;
  /** `A` activa, `I` inactiva. */
  estado: string;
}

/** El endpoint es `/banco/cuenta/`, en singular. En plural devuelve 404. */
export async function listarCuentasBancarias(): Promise<CuentaBancaria[]> {
  const cuentas = await contificoRequest<CuentaBancaria[]>("/banco/cuenta/", {
    timeoutMs: 30_000,
  });
  return (Array.isArray(cuentas) ? cuentas : []).filter(
    (c) => c.estado === "A"
  );
}
