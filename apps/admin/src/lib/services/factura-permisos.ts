/**
 * Quién puede tocar la plata.
 *
 * Solo ADMIN y STAFF. Un `PERSONAL_ADMIN` lleva el trabajo de campo de sus
 * sectores —sus clientes, sus visitas, sus mensajes— y no ve lo que se cobra:
 * el corte no es "de quién es el cliente" sino "esto es dinero".
 *
 * Vive aparte porque lo usan el servicio de facturas y el de cobros, y que uno
 * importe al otro solo por esto los ata sin motivo.
 */
import { ForbiddenError } from "./errors";
import type { Viewer } from "./viewer";
import { isAdminRole } from "./viewer";

export function ensureCanWrite(viewer: Viewer): void {
  if (!isAdminRole(viewer.role)) throw new ForbiddenError();
}

export function ensureCanRead(viewer: Viewer): void {
  if (!isAdminRole(viewer.role)) throw new ForbiddenError();
}
