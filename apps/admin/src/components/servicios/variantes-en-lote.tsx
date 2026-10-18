"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputNumero, comoNumero } from "@/components/ui/input-numero";
import { CustomSelect } from "@/components/ui/custom-select";
import {
  TITULO_DE_CAMPO_EN_LOTE,
  UNIDADES_DE_PESO,
  UNIDAD_PESO_LABEL,
  type CampoDeVarianteEnLote,
  type UnidadPeso,
} from "@vivero/shared";

/** Una variante elegida, con lo que tiene **hoy** (lo pendiente ya aplicado). */
export interface VarianteEnLote {
  id: string;
  nombre: string;
  precio: number;
  costo: number | null;
  sku: string | null;
  peso: number | null;
  pesoUnidad: UnidadPeso;
  stock: number;
  manejaInventario: boolean;
}

/** Lo que vuelve: el valor escrito por variante (`null` = vaciar el costo o el peso). */
export type ValoresEnLote = Record<string, number | string | null>;

function inicial(v: VarianteEnLote, campo: CampoDeVarianteEnLote): string {
  const x =
    campo === "precio"
      ? v.precio
      : campo === "costo"
        ? v.costo
        : campo === "sku"
          ? v.sku
          : campo === "peso"
            ? v.peso
            : v.stock;
  return x === null || x === undefined ? "" : String(x);
}

/**
 * *Editar en lote*, un campo a la vez, como el *Bulk edit* de Shopify: cada
 * variante elegida con su propia caja —precio, costo, SKU, peso o stock— y
 * arriba **Aplicar a todas**, que escribe lo mismo en todas las cajas. Nada se
 * guarda acá: *Listo* deja los cambios pendientes en la ficha, que se guardan
 * con la barra de arriba como cualquier otro.
 *
 * El stock es un **conteo**: lo que se escribe es cuántas hay en el estante, y
 * el libro anota la diferencia. Una variante que no lleva inventario no tiene
 * caja.
 */
export function VariantesEnLote({
  campo,
  variantes,
  onListo,
  onCerrar,
}: {
  campo: CampoDeVarianteEnLote | null;
  variantes: VarianteEnLote[];
  onListo: (valores: ValoresEnLote, pesoUnidad?: UnidadPeso) => void;
  onCerrar: () => void;
}) {
  return (
    <Dialog open={campo !== null} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent pantallaCompletaEnMovil className="sm:max-w-lg">
        {campo ? (
          <Contenido
            key={campo}
            campo={campo}
            variantes={variantes}
            onListo={onListo}
            onCerrar={onCerrar}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** Montado con el diálogo, así cada apertura arranca de los valores de hoy. */
function Contenido({
  campo,
  variantes,
  onListo,
  onCerrar,
}: {
  campo: CampoDeVarianteEnLote;
  variantes: VarianteEnLote[];
  onListo: (valores: ValoresEnLote, pesoUnidad?: UnidadPeso) => void;
  onCerrar: () => void;
}) {
  const [textos, setTextos] = useState<Record<string, string>>(() =>
    Object.fromEntries(variantes.map((v) => [v.id, inicial(v, campo)]))
  );
  const [todas, setTodas] = useState("");
  const [unidad, setUnidad] = useState<UnidadPeso>(variantes[0]?.pesoUnidad ?? "KG");

  const esTexto = campo === "sku";
  const entero = campo === "stock";
  const editable = (v: VarianteEnLote) => campo !== "stock" || v.manejaInventario;
  const titulo = TITULO_DE_CAMPO_EN_LOTE[campo];

  function listo() {
    const valores: ValoresEnLote = {};
    for (const v of variantes) {
      if (!editable(v)) continue;
      const t = (textos[v.id] ?? "").trim();
      if (t === inicial(v, campo) && !(campo === "peso" && unidad !== v.pesoUnidad)) continue;
      if (esTexto) valores[v.id] = t;
      else if (t === "") {
        // Vaciar el costo o el peso es "no se sabe"; el precio y el stock no
        // se vacían: quedan como estaban.
        if (campo === "costo" || campo === "peso") valores[v.id] = null;
      } else {
        const n = comoNumero(t);
        if (n !== null && n >= 0) valores[v.id] = entero ? Math.trunc(n) : n;
      }
    }
    onListo(valores, campo === "peso" ? unidad : undefined);
  }

  const caja = (valor: string, onChange: (t: string) => void, etiqueta: string) =>
    esTexto ? (
      <Input
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        aria-label={etiqueta}
        className="h-9"
      />
    ) : (
      <div className="relative">
        {campo === "precio" || campo === "costo" ? (
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            $
          </span>
        ) : null}
        <InputNumero
          value={valor}
          onChange={onChange}
          decimales={entero ? false : campo === "peso" ? 3 : 2}
          aria-label={etiqueta}
          className={`h-9 text-right tabular-nums ${
            campo === "precio" || campo === "costo" ? "pl-6" : ""
          }`}
        />
      </div>
    );

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {titulo} · {variantes.length} {variantes.length === 1 ? "variante" : "variantes"}
        </DialogTitle>
      </DialogHeader>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto md:max-h-[60vh]">
        {/* Lo mismo para todas: se escribe una vez y se reparte en las cajas,
            que siguen editables una por una. */}
        <div className="flex items-end gap-2 rounded-md bg-muted/50 p-3">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Aplicar a todas</p>
            {caja(todas, setTodas, "Aplicar a todas")}
          </div>
          {campo === "peso" ? (
            <div className="w-24">
              <CustomSelect
                value={unidad}
                onChange={(u) => setUnidad(u as UnidadPeso)}
                options={UNIDADES_DE_PESO.map((u) => ({ value: u, label: UNIDAD_PESO_LABEL[u] }))}
              />
            </div>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="h-9"
            disabled={todas.trim() === ""}
            onClick={() =>
              setTextos((t) =>
                Object.fromEntries(
                  variantes.map((v) => [v.id, editable(v) ? todas : (t[v.id] ?? "")])
                )
              )
            }
          >
            Aplicar
          </Button>
        </div>

        <div className="divide-y rounded-md border">
          {variantes.map((v) => (
            <div key={v.id} className="flex items-center gap-3 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm">{v.nombre}</span>
              <div className="w-36 flex-none">
                {editable(v) ? (
                  caja(textos[v.id] ?? "", (t) => setTextos((x) => ({ ...x, [v.id]: t })), v.nombre)
                ) : (
                  <p className="text-right text-xs text-muted-foreground">No lleva inventario</p>
                )}
              </div>
              {campo === "peso" ? (
                <span className="w-8 flex-none text-xs text-muted-foreground">
                  {UNIDAD_PESO_LABEL[unidad]}
                </span>
              ) : null}
            </div>
          ))}
        </div>
        {campo === "stock" ? (
          <p className="text-xs text-muted-foreground">
            Escribe cuántas hay en el estante: el inventario anota la diferencia como un conteo.
          </p>
        ) : null}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button type="button" onClick={listo}>
          Listo
        </Button>
      </DialogFooter>
    </>
  );
}
