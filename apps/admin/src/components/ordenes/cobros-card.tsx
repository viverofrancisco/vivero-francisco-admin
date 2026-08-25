"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { money } from "./formato";

/**
 * Contífico no devuelve los mismos códigos que recibe: un cobro mandado como
 * `EF` vuelve como `CAJA`. Por eso el mapa tiene las dos formas.
 */
const FORMA_LABEL: Record<string, string> = {
  EF: "Efectivo",
  CAJA: "Efectivo",
  CQ: "Cheque",
  TRA: "Transferencia",
  TC: "Tarjeta de crédito",
};

/** Los datáfonos que reconoce Contífico. */
const DATAFONO_LABEL: Record<string, string> = {
  D: "Datafast",
  M: "Medianet",
  E: "Dataexpress",
  P: "PlaceToPay",
  A: "Alignet",
};

interface Cobro {
  id: string;
  formaCobro: string;
  monto: number;
  fecha: string | null;
  comprobante: string | null;
  numeroCheque: string | null;
  fechaCheque: string | null;
  cuentaBancaria: string | null;
  tipoPing: string | null;
  numeroTarjeta: string | null;
  lote: string | null;
}

/**
 * Lo que hay para contar de un cobro, según cómo se pagó.
 *
 * En efectivo no hay nada: Contífico no guarda ninguna referencia y lo que
 * devuelve en `numero_comprobante` es su propia etiqueta, no un dato de nadie.
 */
function detalles(c: Cobro): { etiqueta: string; valor: string }[] {
  const filas: { etiqueta: string; valor: string }[] = [];
  if (c.cuentaBancaria) filas.push({ etiqueta: "Cuenta", valor: c.cuentaBancaria });
  if (c.comprobante) filas.push({ etiqueta: "Comprobante", valor: c.comprobante });
  if (c.numeroCheque) {
    filas.push({
      etiqueta: "Cheque",
      valor: c.fechaCheque ? `${c.numeroCheque} · ${c.fechaCheque}` : c.numeroCheque,
    });
  }
  if (c.tipoPing) {
    filas.push({
      etiqueta: "Datáfono",
      valor: DATAFONO_LABEL[c.tipoPing] ?? c.tipoPing,
    });
  }
  if (c.numeroTarjeta) filas.push({ etiqueta: "Tarjeta", valor: c.numeroTarjeta });
  if (c.lote) filas.push({ etiqueta: "Lote", valor: c.lote });
  return filas;
}

/**
 * Los cobros de la factura de esta orden, debajo del detalle.
 *
 * Se piden a Contífico al montar y no se guardan acá: los cobros son suyos y
 * alguien pudo cargar uno desde su interfaz. Una copia local sería una copia
 * potencialmente vieja de un número que habla de plata.
 */
export function CobrosCard({ facturaId }: { facturaId: string }) {
  const [datos, setDatos] = useState<{
    total: number;
    saldo: number | null;
    cobros: Cobro[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pedido, setPedido] = useState<string | null>(null);

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
            Consultando a Contífico…
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
                      {FORMA_LABEL[c.formaCobro] ?? c.formaCobro}
                      {c.fecha && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {c.fecha}
                        </span>
                      )}
                    </p>
                    <span className="flex-none font-semibold tabular-nums">
                      {money(c.monto)}
                    </span>
                  </div>
                  {detalles(c).length > 0 && (
                    <dl className="mt-1 space-y-0.5">
                      {detalles(c).map((d) => (
                        <div key={d.etiqueta} className="flex gap-2 text-xs">
                          <dt className="w-24 flex-none text-muted-foreground">
                            {d.etiqueta}
                          </dt>
                          <dd className="min-w-0 break-words">{d.valor}</dd>
                        </div>
                      ))}
                    </dl>
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
