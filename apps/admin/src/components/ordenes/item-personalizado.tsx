"use client";

import { useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Minus, Plus, X } from "lucide-react";
import { Casilla } from "./selector-productos";

/** Lo que sale de la hoja: la línea, con los importes como texto. */
export interface ItemPersonalizado {
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
  ivaTasa: string;
}

/**
 * Un ítem personalizado en el teléfono: un trabajo puntual que no vale la
 * pena dar de alta como producto. La pantalla de Shopify, la misma de la app
 * (`HojaItemPersonalizado`): a pantalla completa, con la ✕ y el título
 * arriba, el nombre, el precio con su "$" y el teclado numérico, la cantidad
 * con −/+ y la casilla de si cobra IVA. Entra como una línea más e imprime un
 * código genérico en la factura.
 *
 * En el escritorio no hace falta: el botón agrega la línea vacía y se escribe
 * ahí mismo, que con un teclado delante es más corto que abrir otra pantalla.
 */
export function HojaItemPersonalizado({
  abierto,
  onCerrar,
  onAgregar,
}: {
  abierto: boolean;
  onCerrar: () => void;
  onAgregar: (item: ItemPersonalizado) => void;
}) {
  return (
    <DialogPrimitive.Root
      open={abierto}
      onOpenChange={(o) => {
        if (!o) onCerrar();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Popup className="fixed inset-0 z-50 flex h-dvh w-screen flex-col bg-background outline-none data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom-4 data-closed:animate-out data-closed:fade-out-0">
          {/* Los campos viven en el contenido, que se monta con la hoja y se
              va con ella: cada apertura arranca en blanco sin un efecto que
              lo borre. */}
          <Contenido onAgregar={onAgregar} />
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Contenido({
  onAgregar,
}: {
  onAgregar: (item: ItemPersonalizado) => void;
}) {
  const [descripcion, setDescripcion] = useState("");
  /** Como texto: se escribe con el teclado numérico o se mueve con −/+. */
  const [cantidad, setCantidad] = useState("1");
  const [precio, setPrecio] = useState("");
  // En Ecuador un trabajo de jardinería tributa al 15 %; el 0 es la excepción.
  // Marcado, se puede escribir otra tasa.
  const [cobraIva, setCobraIva] = useState(true);
  const [iva, setIva] = useState("15");

  const listo =
    descripcion.trim() !== "" && precio.trim() !== "" && Number(cantidad) > 0;

  const mover = (delta: number) =>
    setCantidad((c) => String(Math.max(1, (Number(c) || 0) + delta)));

  const agregar = () => {
    if (!listo) return;
    onAgregar({
      descripcion: descripcion.trim(),
      cantidad: String(Number(cantidad) || 1),
      precioUnitario: precio,
      ivaTasa: cobraIva ? iva.trim() || "0" : "0",
    });
  };

  return (
    <>
      <div className="flex h-14 flex-none items-center gap-1.5 border-b border-border px-2.5">
        <DialogPrimitive.Close
          className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </DialogPrimitive.Close>
        <DialogPrimitive.Title className="min-w-0 flex-1 truncate text-center text-[17px] font-bold">
          Ítem personalizado
        </DialogPrimitive.Title>
        <button
          type="button"
          onClick={agregar}
          disabled={!listo}
          className="min-w-[76px] rounded-lg px-1.5 py-1.5 text-right text-base font-bold text-primary active:bg-muted disabled:text-muted-foreground"
        >
          Agregar
        </button>
      </div>

      <form
        className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 pb-10"
        onSubmit={(e) => {
          e.preventDefault();
          agregar();
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="item-nombre">Nombre del ítem *</Label>
          <Input
            id="item-nombre"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="h-11 rounded-xl"
            autoFocus
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="item-precio">Precio *</Label>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base text-muted-foreground">
              $
            </span>
            {/* `inputMode="decimal"`: el teclado numérico del teléfono,
                sin el `type="number"` que en iOS no lo trae. */}
            <Input
              id="item-precio"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className="h-11 rounded-xl pl-7"
            />
          </div>
        </div>

        {/* Cantidad: se escribe con el teclado numérico o se mueve con
            −/+, que en un teléfono es más rápido para el 1 o 2 de
            siempre. Los dos tocan el mismo valor. */}
        <div className="flex items-center gap-3 rounded-xl border border-border px-3.5 py-2">
          <div className="min-w-0 flex-1">
            <Label
              htmlFor="item-cantidad"
              className="text-xs text-muted-foreground"
            >
              Cantidad
            </Label>
            <input
              id="item-cantidad"
              value={cantidad}
              onChange={(e) =>
                setCantidad(e.target.value.replace(/[^0-9]/g, ""))
              }
              onBlur={() =>
                setCantidad((c) => String(Math.max(1, Number(c) || 1)))
              }
              onFocus={(e) => e.target.select()}
              inputMode="numeric"
              className="block w-full bg-transparent py-0.5 text-[17px] outline-none"
              aria-label="Cantidad"
            />
          </div>
          <div className="flex flex-none gap-1.5">
            <button
              type="button"
              onClick={() => mover(-1)}
              disabled={Number(cantidad) <= 1}
              className="flex h-10 w-11 items-center justify-center rounded-[10px] bg-muted disabled:opacity-50"
              aria-label="Menos"
            >
              <Minus className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => mover(1)}
              className="flex h-10 w-11 items-center justify-center rounded-[10px] bg-muted"
              aria-label="Más"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setCobraIva((v) => !v)}
          className="flex w-full items-center gap-3 py-3 text-left"
        >
          <Casilla
            estado={cobraIva ? "si" : "no"}
            className="h-[22px] w-[22px] rounded-md"
          />
          <span className="text-base">Cobra IVA</span>
        </button>
        {/* Marcado, la tasa se escribe: 15 es lo usual, pero no lo único. */}
        <div className={cn("space-y-1", !cobraIva && "hidden")}>
          <Label htmlFor="item-iva">IVA %</Label>
          <Input
            id="item-iva"
            value={iva}
            onChange={(e) => setIva(e.target.value)}
            inputMode="decimal"
            placeholder="15"
            className="h-11 rounded-xl"
          />
        </div>
        <p className="text-[13px] leading-[18px] text-muted-foreground">
          Un trabajo puntual sin producto en el catálogo. Lo que se vendió lo
          dice el nombre.
        </p>
      </form>
    </>
  );
}
