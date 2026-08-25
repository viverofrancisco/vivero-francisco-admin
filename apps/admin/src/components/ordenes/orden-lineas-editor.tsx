"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CustomSelect } from "@/components/ui/custom-select";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { money, fecha } from "./formato";

export interface ProductoCatalogo {
  id: string;
  nombre: string;
  ivaTasa: number | null;
  contificoProductoId: string | null;
}

/** Una línea tal como viaja al servidor, con su procedencia intacta. */
export interface LineaEditable {
  uid: string;
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
  ivaTasa: string;
  productoId: string;
  visitaProductoId: string | null;
  suscripcionItemId: string | null;
  periodoInicio: string | null;
  periodoFin: string | null;
}

let contador = 0;

/**
 * Toda línea sale de un producto del catálogo: Contífico exige `producto_id` en
 * cada `detalles[]` y no acepta texto libre, así que una línea suelta sería una
 * orden imposible de cobrar.
 */
function lineaBase(): Omit<LineaEditable, "descripcion" | "productoId"> {
  return {
    uid: `nueva-${contador++}`,
    cantidad: "1",
    precioUnitario: "",
    ivaTasa: "0",
    visitaProductoId: null,
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

/** De dónde salió la línea. Se conserva al editar: es lo que evita cobrar dos veces. */
function origen(l: LineaEditable): string | null {
  if (l.periodoInicio && l.periodoFin) {
    return `Suscripción · ${fecha(l.periodoInicio)} → ${fecha(l.periodoFin)}`;
  }
  if (l.visitaProductoId) return "Trabajo de una visita";
  return null;
}

/**
 * Edita las líneas de una orden en borrador.
 *
 * La procedencia (`visitaProductoId`, `suscripcionItemId` + período) viaja
 * intacta aunque se cambie la descripción o el precio: es lo que sostiene los
 * índices únicos que impiden facturar el mismo trabajo dos veces.
 */
export function OrdenLineasEditor({
  lineasIniciales,
  notasIniciales,
  productos,
  suscritos = [],
  guardando,
  onGuardar,
  onCancelar,
}: {
  lineasIniciales: LineaEditable[];
  notasIniciales: string;
  productos: ProductoCatalogo[];
  /** Productos que este cliente ya tiene en un plan activo. */
  suscritos?: string[];
  guardando: boolean;
  onGuardar: (lineas: LineaEditable[], notas: string) => void;
  onCancelar: () => void;
}) {
  const [lineas, setLineas] = useState<LineaEditable[]>(lineasIniciales);
  const [notas, setNotas] = useState(notasIniciales);

  const actualizar = (uid: string, patch: Partial<LineaEditable>) =>
    setLineas((prev) =>
      prev.map((l) => (l.uid === uid ? { ...l, ...patch } : l))
    );

  const quitar = (uid: string) =>
    setLineas((prev) => prev.filter((l) => l.uid !== uid));

  const agregarProducto = (productoId: string) => {
    const p = productos.find((x) => x.id === productoId);
    if (!p) return;
    if (!p.contificoProductoId) {
      toast.error(`"${p.nombre}" no está sincronizado con Contífico`);
      return;
    }
    if (suscritos.includes(p.id)) {
      toast.error(
        `"${p.nombre}" está en un plan de este cliente: se cobra por período`
      );
      return;
    }
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
    onGuardar(lineas, notas);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {lineas.map((l) => {
          const i = importes(l);
          const proc = origen(l);
          return (
            <div key={l.uid} className="rounded-md border p-3 space-y-2">
              <div className="flex items-start gap-2">
                <div className="flex-1 space-y-1">
                  <Input
                    value={l.descripcion}
                    onChange={(e) =>
                      actualizar(l.uid, { descripcion: e.target.value })
                    }
                    placeholder="Descripción"
                    className="font-medium"
                  />
                  {proc && (
                    <p className="text-xs text-muted-foreground">{proc}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => quitar(l.uid)}
                  aria-label="Quitar producto"
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
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
            options={productos.map((p) => ({
              value: p.id,
              label: p.nombre,
              disabled: !p.contificoProductoId || suscritos.includes(p.id),
              hint: !p.contificoProductoId
                ? "No está vinculado con Contífico, así que no se puede facturar."
                : suscritos.includes(p.id)
                  ? "Este cliente lo tiene en un plan: se cobra por período."
                  : undefined,
            }))}
            placeholder="Buscar producto..."
            searchable
            searchPlaceholder="Buscar producto..."
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notas-orden">Notas</Label>
        <Textarea
          id="notas-orden"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Opcional"
          rows={2}
        />
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

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </Button>
        <Button onClick={guardar} disabled={guardando}>
          {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}
