"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { money } from "./formato";

const centavos = (n: number) => Math.round(n * 100) / 100;

/**
 * Lo que se le va a cobrar al cliente en cada período.
 *
 * Existe porque el formulario pide el precio **sin IVA** y la tasa aparte, así
 * que mirando los campos no hay forma de saber cuánto termina pagando — y esa
 * es justo la pregunta que se hace quien arma el plan, con el cliente delante.
 * Debajo, cuánto sale cada visita: es el número con el que se compara contra
 * cobrar el trabajo suelto.
 *
 * Es el mismo componente en el alta y en el detalle: son la misma cuenta, y
 * dos copias se habrían separado a la primera corrección.
 */
export function ResumenSuscripcion({
  precio,
  ivaTasa,
  visitasPorPeriodo,
  /** `/mes`, `/trimestre`… Lo que corresponda a la periodicidad elegida. */
  sufijo,
}: {
  /** Como están en el formulario: texto, y pueden estar vacíos. */
  precio: string;
  ivaTasa: string;
  visitasPorPeriodo: string;
  sufijo: string;
}) {
  const base = centavos(Number(precio) || 0);
  const tasa = Number(ivaTasa) || 0;
  const iva = centavos((base * tasa) / 100);
  const total = centavos(base + iva);
  const visitas = Number(visitasPorPeriodo) || 0;

  return (
    <Card>
      <CardHeader className="border-b py-3">
        <CardTitle className="text-base">Resumen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {precio.trim() === "" ? (
          <p className="text-muted-foreground">
            Pon el precio para ver cuánto se cobra.
          </p>
        ) : (
          <>
            <div className="space-y-1.5">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{money(base)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">
                  IVA{tasa > 0 ? ` ${tasa}%` : ""}
                </span>
                <span className="tabular-nums">{money(iva)}</span>
              </div>
              <div className="flex justify-between gap-3 border-t pt-1.5 text-base font-bold">
                <span>
                  Total
                  <span className="text-xs font-normal text-muted-foreground">
                    {sufijo}
                  </span>
                </span>
                <span className="tabular-nums">{money(total)}</span>
              </div>
            </div>
            {visitas > 0 && (
              <p className="border-t pt-3 text-xs text-muted-foreground">
                {visitas} visita{visitas === 1 ? "" : "s"}
                {sufijo} ·{" "}
                <span className="tabular-nums">
                  {money(centavos(total / visitas))}
                </span>{" "}
                por visita
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
