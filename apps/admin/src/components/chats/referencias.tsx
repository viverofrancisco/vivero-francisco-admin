import { CalendarDays, Tag, Users } from "lucide-react";
import type { ReferenciaEnMensaje, TipoDeReferencia } from "@vivero/shared";

/** Lo que comparten la burbuja, el selector y la vista previa de una ficha. */
export const ETIQUETA_REFERENCIA: Record<TipoDeReferencia, string> = {
  visita: "Visita",
  cliente: "Cliente",
  producto: "Producto",
};

export function IconoDeReferencia({ tipo, className }: { tipo: TipoDeReferencia; className: string }) {
  if (tipo === "visita") return <CalendarDays className={className} />;
  if (tipo === "cliente") return <Users className={className} />;
  return <Tag className={className} />;
}

/**
 * La ficha de ahora, con `from` para que su flecha vuelva al chat. `from` ya
 * viene codificado por `useAca`.
 */
export function hrefDeReferencia(ref: ReferenciaEnMensaje, from: string): string {
  const base = { visita: "visitas", cliente: "clientes", producto: "productos" }[ref.tipo];
  return `/dashboard/${base}/${ref.id}?from=${from}`;
}
