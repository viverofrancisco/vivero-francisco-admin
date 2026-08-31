"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomSelect } from "@/components/ui/custom-select";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { money } from "./formato";
import {
  origenDeLinea,
  nuevoUid,
  type LineaEditable,
} from "./selector-visitas";

export type { LineaEditable };

export interface ProductoCatalogo {
  id: string;
  nombre: string;
  ivaTasa: number | null;
  contificoProductoId: string | null;
}

/**
 * El `form` al que apuntan Guardar y Cancelar, que viven en el encabezado de la
 * página —fuera de este árbol— para no taparle nada al contenido de abajo.
 */
export const ORDEN_LINEAS_FORM_ID = "orden-lineas-form";

/**
 * Toda línea sale de un producto del catálogo: Contífico exige `producto_id` en
 * cada `detalles[]` y no acepta texto libre, así que una línea suelta sería una
 * orden imposible de cobrar.
 */
function lineaBase(): Omit<LineaEditable, "descripcion" | "productoId"> {
  return {
    uid: nuevoUid(),
    cantidad: "1",
    precioUnitario: "",
    ivaTasa: "0",
    visitaProductoIds: [],
    suscripcionItemId: null,
    periodoInicio: null,
    periodoFin: null,
  };
}

function importes(l: LineaEditable) {
  const subtotal = (Number(l.cantidad) || 0) * (Number(l.precioUnitario) || 0);
  const iva = (subtotal * (Number(l.ivaTasa) || 0)) / 100;
  return { subtotal, iva, total: subtotal + iva };
}

/**
 * Edita las líneas de una orden en borrador.
 *
 * La procedencia (`visitaProductoIds`, `suscripcionItemId` + período) viaja
 * intacta aunque se cambie la descripción o el precio: es lo que sostiene los
 * índices únicos que impiden facturar el mismo trabajo dos veces.
 */
export function OrdenLineasEditor({
  lineas,
  onLineasChange,
  productos,
  clienteNombre,
  suscritos = [],
  onGuardar,
}: {
  /**
   * Las líneas viven en la página, no acá: el card de **Visitas** —que está
   * fuera de este componente, más abajo— trabaja sobre las mismas, y tenerlas
   * en dos lugares las habría dejado en desacuerdo.
   */
  lineas: LineaEditable[];
  onLineasChange: (lineas: LineaEditable[]) => void;
  productos: ProductoCatalogo[];
  /** Para nombrarlo en el aviso: "Fulano tiene este producto…". */
  clienteNombre?: string;
  /** Productos que este cliente ya tiene en un plan activo. */
  suscritos?: string[];
  /**
   * Guardar y cancelar no están acá: los dibuja el encabezado de la página,
   * que es sticky. Este componente solo expone el `form` al que apuntan.
   */
  onGuardar: (lineas: LineaEditable[]) => void;
}) {
  const setLineas = (f: (prev: LineaEditable[]) => LineaEditable[]) =>
    onLineasChange(f(lineas));

  const actualizar = (uid: string, patch: Partial<LineaEditable>) =>
    setLineas((prev) =>
      prev.map((l) => (l.uid === uid ? { ...l, ...patch } : l))
    );

  const quitar = (uid: string) =>
    setLineas((prev) => prev.filter((l) => l.uid !== uid));

  const agregarProducto = (productoId: string) => {
    const p = productos.find((x) => x.id === productoId);
    if (!p) return;
    setLineas((prev) => [
      ...prev,
      {
        ...lineaBase(),
        descripcion: p.nombre,
        ivaTasa: p.ivaTasa != null ? String(p.ivaTasa) : "0",
        productoId: p.id,
      },
    ]);
  };

  const totales = lineas.reduce(
    (acc, l) => {
      const i = importes(l);
      return {
        subtotal: acc.subtotal + i.subtotal,
        iva: acc.iva + i.iva,
        total: acc.total + i.total,
      };
    },
    { subtotal: 0, iva: 0, total: 0 }
  );

  const guardar = () => {
    if (lineas.length === 0) return toast.error("La orden necesita un producto");
    const sinDescripcion = lineas.find((l) => !l.descripcion.trim());
    if (sinDescripcion) return toast.error("Hay un producto sin descripción");
    const sinPrecio = lineas.find(
      (l) => l.precioUnitario.trim() === "" || Number(l.precioUnitario) < 0
    );
    if (sinPrecio)
      return toast.error(`Falta el precio de "${sinPrecio.descripcion}"`);
    onGuardar(lineas);
  };

  return (
    // Un `form` de verdad y no un `div` con un onClick: Guardar y Cancelar
    // viven en el encabezado de la página, fuera de este árbol, y lo que los
    // conecta con esto es el `form` al que apunta el botón.
    <form
      id={ORDEN_LINEAS_FORM_ID}
      onSubmit={(e) => {
        e.preventDefault();
        guardar();
      }}
      className="space-y-4"
    >
      <div className="space-y-3">
        {lineas.map((l) => {
          const i = importes(l);
          const proc = origenDeLinea(l);
          return (
            <div key={l.uid} className="rounded-md border p-3 space-y-2">
              <div className="flex items-start gap-2">
                  {/* El nombre no se edita acá. La orden registra **lo que
                      se hizo**, y renombrarlo es una decisión de qué sale
                      impreso: eso se toma al emitir, donde además se puede
                      juntar todo en una sola línea. Editarlo en los dos lados
                      dejaba a la orden mintiendo sobre sus propios ítems. */}
                  {/* La procedencia al lado del nombre y no debajo: es una
                      aclaración corta, y en su propio renglón hacía cada
                      producto un tercio más alto sin decir más. */}
                  <div className="flex flex-1 flex-wrap items-baseline gap-x-2">
                    <p className="text-sm font-medium">{l.descripcion}</p>
                    {proc && (
                      <span className="text-xs text-muted-foreground">
                        {proc}
                      </span>
                    )}
                  </div>
                {/* Solo lo agregado a mano se saca de a uno. Lo que viene
                    de una visita se saca **desmarcando la visita**: una visita
                    se factura completa, así que quitarle un producto dejaría
                    una orden que el servidor rechaza al guardar. */}
                {l.visitaProductoIds.length === 0 && !l.suscripcionItemId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => quitar(l.uid)}
                    aria-label="Quitar producto"
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-20 space-y-1">
                  <Label className="text-xs">Cant.</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={l.cantidad}
                    onChange={(e) =>
                      actualizar(l.uid, { cantidad: e.target.value })
                    }
                  />
                </div>
                <div className="w-28 space-y-1">
                  <Label className="text-xs">Precio *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={l.precioUnitario}
                    onChange={(e) =>
                      actualizar(l.uid, { precioUnitario: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>
                <div className="w-24 space-y-1">
                  <Label className="text-xs">IVA %</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={l.ivaTasa}
                    onChange={(e) =>
                      actualizar(l.uid, { ivaTasa: e.target.value })
                    }
                  />
                </div>
                <div className="ml-auto text-right">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="font-semibold tabular-nums">{money(i.total)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-3 border-t pt-3">
        <div className="min-w-[220px] flex-1 space-y-1">
          <Label className="text-xs">Agregar del catálogo</Label>
          <CustomSelect
            value=""
            onChange={agregarProducto}
            // Un producto sin vincular **entra igual**: la orden es el
            // registro de lo que se vendió, y lo que necesita estar en
            // Contífico es lo que sale impreso, que se decide al emitir. El
            // aviso queda para que no sorprenda después.
            options={productos.map((p) => ({
              value: p.id,
              label: p.nombre,
              hint: !p.contificoProductoId
                ? "No está vinculado con Contífico: al emitir vas a tener que facturarlo con otro producto."
                : suscritos.includes(p.id)
                  ? `${clienteNombre ?? "El cliente"} tiene este producto en una suscripción.`
                  : undefined,
            }))}
            placeholder="Buscar producto..."
            searchable
            searchPlaceholder="Buscar producto..."
          />
        </div>
      </div>

      <div className="space-y-1.5 border-t pt-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="tabular-nums">{money(totales.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">IVA</span>
          <span className="tabular-nums">{money(totales.iva)}</span>
        </div>
        <div className="flex justify-between border-t pt-1.5 text-base font-bold">
          <span>Total</span>
          <span className="tabular-nums">{money(totales.total)}</span>
        </div>
      </div>

    </form>
  );
}
