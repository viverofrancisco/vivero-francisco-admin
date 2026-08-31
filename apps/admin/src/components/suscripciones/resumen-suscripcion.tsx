"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { money } from "./formato";

/** Lo mínimo que el resumen necesita de cada producto del plan. */
export interface ItemResumen {
  nombre: string;
  /** Como está en el formulario: texto, y puede estar vacío. */
  precio: string;
  ivaTasa: string;
}

const centavos = (n: number) => Math.round(n * 100) / 100;

function importes(i: ItemResumen) {
  const base = centavos(Number(i.precio) || 0);
  const iva = centavos((base * (Number(i.ivaTasa) || 0)) / 100);
  return { base, iva, total: centavos(base + iva) };
}

/**
 * Lo que se le va a cobrar al cliente en cada período, producto por producto.
 *
 * Existe porque el formulario pide el precio **sin IVA** y la tasa aparte, así
 * que mirando los campos no hay forma de saber cuánto termina pagando por cada
 * cosa — y esa es justo la pregunta que se hace quien arma el plan, con el
 * cliente delante.
 *
 * Es el mismo componente en el alta y en el detalle: son la misma cuenta, y
 * dos copias se habrían separado a la primera corrección.
 */
export function ResumenSuscripcion({
  items,
  /** `/mes`, `/trimestre`… Lo que corresponda a la periodicidad elegida. */
  sufijo,
}: {
  items: ItemResumen[];
  sufijo: string;
}) {
  const totales = items.reduce(
    (acc, i) => {
      const x = importes(i);
      return {
        base: centavos(acc.base + x.base),
        iva: centavos(acc.iva + x.iva),
        total: centavos(acc.total + x.total),
      };
    },
    { base: 0, iva: 0, total: 0 }
  );

  return (
    <Card>
      <CardHeader className="border-b py-3">
        <CardTitle className="text-base">Resumen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {items.length === 0 ? (
          <p className="text-muted-foreground">
            Agregá un producto para ver cuánto se cobra.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              {items.map((i) => {
                const x = importes(i);
                return (
                  <div key={i.nombre} className="flex justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate">{i.nombre}</span>
                      {/* El desglose de la línea, que es lo que no se puede
                          leer de los campos: el precio va sin IVA. */}
                      <span className="block text-xs text-muted-foreground">
                        {money(x.base)}
                        {Number(i.ivaTasa) > 0 && ` + ${i.ivaTasa}% IVA`}
                      </span>
                    </span>
                    <span className="flex-none tabular-nums">
                      {money(x.total)}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="space-y-1.5 border-t pt-3">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{money(totales.base)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">IVA</span>
                <span className="tabular-nums">{money(totales.iva)}</span>
              </div>
              <div className="flex justify-between gap-3 border-t pt-1.5 text-base font-bold">
                <span>
                  Total
                  <span className="text-xs font-normal text-muted-foreground">
                    {sufijo}
                  </span>
                </span>
                <span className="tabular-nums">{money(totales.total)}</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
