"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { money } from "./formato";

const FORMA_LABEL: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  TARJETA: "Tarjeta",
  CHEQUE: "Cheque",
  OTRO: "Otro",
};

interface Cobro {
  id: string;
  formaPago: string;
  monto: number;
  /** `YYYY-MM-DD`: el día que entró la plata, sin hora. */
  fecha: string | null;
  /** Con qué encontrarlo, y quién lo anotó. */
  referencia: string | null;
  nota: string | null;
  registradoPor: string | null;
}

/** El día que entró la plata, leído como el resto del portal. */
function fechaCobro(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Los cobros de la factura de esta orden, debajo del detalle.
 *
 * Se piden al montar: el saldo sale de sumarlos, así que la lista y el número
 * de arriba no pueden discrepar.
 */
export function CobrosCard({ facturaId }: { facturaId: string }) {
  const [datos, setDatos] = useState<{
    total: number;
    saldo: number | null;
    cobros: Cobro[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pedido, setPedido] = useState<string | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);
  const router = useRouter();

  /**
   * Borra un cobro.
   *
   * Un cobro es un hecho —o entró esa plata o no— así que se borra en vez de
   * corregirse: cambiarle el monto sería inventar un estado entre "pasó" y "no
   * pasó". El saldo lo recalcula el servidor desde lo que queda.
   */
  const borrar = async (cobroId: string) => {
    setBorrando(cobroId);
    try {
      const res = await fetch(`/api/facturas/${facturaId}/cobros/${cobroId}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error");
      toast.success("Cobro borrado");
      setPedido(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos borrarlo");
    } finally {
      setBorrando(null);
    }
  };

  // Se dispara al renderizar con una factura nueva en vez de con un efecto: no
  // hay dependencias que sincronizar ni un `setState` después de pintar.
  if (pedido !== facturaId) {
    setPedido(facturaId);
    setDatos(null);
    setError(null);
    fetch(`/api/facturas/${facturaId}/cobros`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Error");
        return r.json();
      })
      .then(setDatos)
      .catch((e: Error) => setError(e.message));
  }

  return (
    <Card>
      <CardHeader className="border-b py-3">
        <CardTitle className="text-base">Cobros</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : !datos ? (
          <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando los cobros…
          </p>
        ) : datos.cobros.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            Todavía no se registró ningún cobro.
          </p>
        ) : (
          <>
            <ul className="divide-y">
              {datos.cobros.map((c) => (
                <li key={c.id} className="py-3 text-sm first:pt-0">
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="font-medium">
                      {FORMA_LABEL[c.formaPago] ?? c.formaPago}
                      {c.fecha && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {fechaCobro(c.fecha)}
                        </span>
                      )}
                    </p>
                    <span className="flex items-center gap-1">
                      <span className="flex-none font-semibold tabular-nums">
                        {money(c.monto)}
                      </span>
                      {/* Un cobro es un hecho: o entró esa plata o no. Por eso
                          se borra en vez de corregirse. */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={`Borrar el cobro de ${money(c.monto)}`}
                        disabled={borrando !== null}
                        onClick={() => borrar(c.id)}
                      >
                        {borrando === c.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </Button>
                    </span>
                  </div>
                  {(c.referencia || c.registradoPor) && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {c.referencia}
                      {c.referencia && c.registradoPor ? " · " : ""}
                      {c.registradoPor ? `anotó ${c.registradoPor}` : ""}
                    </p>
                  )}
                  {c.nota && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {c.nota}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
