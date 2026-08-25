"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomSelect } from "@/components/ui/custom-select";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PERIODICIDAD_LABEL, PERIODICIDAD_SUFIJO, money } from "./formato";

interface ProductoSuscribible {
  id: string;
  nombre: string;
  /** Periodicidad sugerida del catálogo. La que manda es la de la suscripción. */
  ivaTasa: number | null;
  /** Vinculado con Contífico. Sin eso no se puede facturar el período. */
  sincronizado: boolean;
}

/** Un producto ya agregado a la suscripción que se está armando. */
interface ItemDraft {
  productoId: string;
  nombre: string;
  precio: string;
  ivaTasa: string;
  visitasPorPeriodo: string;
}

const PERIODICIDADES = ["MENSUAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL"];

/**
 * Alta de una suscripción. Se usa tanto en su pantalla propia como dentro de
 * la ficha del cliente, por eso el cliente puede venir fijo desde afuera.
 *
 * Una suscripción agrupa **uno o más** productos recurrentes, cada uno con su
 * precio e IVA. La periodicidad es de la suscripción, no del producto: todo lo que
 * está adentro se cobra junto, en el mismo período.
 */
export function NuevaSuscripcionForm({
  clienteId,
  onCreada,
  onCancelar,
}: {
  clienteId: string;
  onCreada?: () => void;
  onCancelar?: () => void;
}) {
  const router = useRouter();
  const [productos, setProductos] = useState<ProductoSuscribible[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [periodicidad, setPeriodicidad] = useState("MENSUAL");
  const [fechaInicio, setFechaInicio] = useState(
    new Date().toISOString().slice(0, 10)
  );

  // `cargando` ya arranca en true y el componente se monta de nuevo por cliente
  // (key en la página, montaje condicional en el diálogo), así que no hace falta
  // resetearlo acá.
  useEffect(() => {
    fetch(`/api/suscripciones/productos?clienteId=${clienteId}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((d) => setProductos(d.items ?? []))
      .catch(() => setProductos([]))
      .finally(() => setCargando(false));
  }, [clienteId]);

  const disponibles = productos.filter(
    (p) => !items.some((i) => i.productoId === p.id)
  );

  const agregar = (productoId: string) => {
    const p = productos.find((x) => x.id === productoId);
    if (!p) return;
    if (!p.sincronizado) {
      toast.error(`"${p.nombre}" no está sincronizado con Contífico`);
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        productoId: p.id,
        nombre: p.nombre,
        precio: "",
        ivaTasa: p.ivaTasa != null ? String(p.ivaTasa) : "",
        visitasPorPeriodo: "",
      },
    ]);
  };

  const actualizar = (productoId: string, patch: Partial<ItemDraft>) =>
    setItems((prev) =>
      prev.map((i) => (i.productoId === productoId ? { ...i, ...patch } : i))
    );

  const quitar = (productoId: string) =>
    setItems((prev) => prev.filter((i) => i.productoId !== productoId));

  const totalPeriodo = items.reduce((acc, i) => {
    const precio = Number(i.precio) || 0;
    return acc + precio + (precio * (Number(i.ivaTasa) || 0)) / 100;
  }, 0);

  const guardar = async () => {
    if (items.length === 0) return toast.error("Agregá al menos un producto");
    for (const i of items) {
      if (!i.precio.trim() || Number(i.precio) < 0) {
        return toast.error(`Ingresá el precio de "${i.nombre}"`);
      }
      if (Number(i.visitasPorPeriodo) < 1) {
        return toast.error(
          `Ingresá las visitas por período de "${i.nombre}"`
        );
      }
    }

    setGuardando(true);
    try {
      const res = await fetch("/api/suscripciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId,
          periodicidad,
          fechaInicio,
          items: items.map((i) => ({
            productoId: i.productoId,
            precio: Number(i.precio),
            ivaTasa: i.ivaTasa.trim() ? Number(i.ivaTasa) : null,
            visitasPorPeriodo: Number(i.visitasPorPeriodo),
          })),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      toast.success("Suscripción creada");
      onCreada?.();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <p className="py-6 text-sm text-muted-foreground">Cargando productos…</p>
    );
  }

  if (productos.length === 0) {
    return (
      <p className="py-6 text-sm text-muted-foreground">
        Este cliente ya tiene activos todos los productos recurrentes del
        catálogo.
      </p>
    );
  }

  const sufijo = PERIODICIDAD_SUFIJO[periodicidad] ?? "";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Se cobra *</Label>
          <CustomSelect
            value={periodicidad}
            onChange={setPeriodicidad}
            options={PERIODICIDADES.map((p) => ({
              value: p,
              label: PERIODICIDAD_LABEL[p],
            }))}
            placeholder="Periodicidad"
          />
          <p className="text-xs text-muted-foreground">
            Todos los productos de la suscripción se cobran juntos.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="inicio">Desde *</Label>
          <Input
            id="inicio"
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Los períodos de cobro se cuentan desde este mes.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Productos *</Label>
        {items.length === 0 ? (
          <p className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
            Todavía no agregaste ningún producto.
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((i) => (
              <div
                key={i.productoId}
                className="rounded-md border p-3 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-sm font-medium">{i.nombre}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => quitar(i.productoId)}
                    aria-label={`Quitar ${i.nombre}`}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Precio{sufijo} *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={i.precio}
                      onChange={(e) =>
                        actualizar(i.productoId, { precio: e.target.value })
                      }
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">IVA %</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={i.ivaTasa}
                      onChange={(e) =>
                        actualizar(i.productoId, { ivaTasa: e.target.value })
                      }
                      placeholder="15"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Visitas{sufijo} *</Label>
                    <Input
                      type="number"
                      min="1"
                      value={i.visitasPorPeriodo}
                      onChange={(e) =>
                        actualizar(i.productoId, {
                          visitasPorPeriodo: e.target.value,
                        })
                      }
                      placeholder="4"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {disponibles.length > 0 ? (
          <CustomSelect
            value=""
            onChange={agregar}
            options={disponibles.map((p) => ({
              value: p.id,
              label: p.nombre,
              disabled: !p.sincronizado,
              hint: p.sincronizado
                ? undefined
                : "No está vinculado con Contífico, así que no se puede facturar. Vinculalo desde la ficha del producto.",
            }))}
            placeholder="Agregar producto recurrente"
            searchable
            searchPlaceholder="Buscar producto..."
          />
        ) : (
          <p className="text-xs text-muted-foreground">
            <Plus className="mr-1 inline h-3 w-3" />
            No quedan productos recurrentes por agregar.
          </p>
        )}
      </div>

      {items.length > 0 && (
        <div className="flex items-center justify-between border-t pt-3 text-sm">
          <span className="text-muted-foreground">Total por período</span>
          <span className="text-lg font-bold tabular-nums">
            {money(totalPeriodo)}
          </span>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        {onCancelar && (
          <Button variant="outline" onClick={onCancelar} disabled={guardando}>
            Cancelar
          </Button>
        )}
        <Button onClick={guardar} disabled={guardando || items.length === 0}>
          {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Crear suscripción
        </Button>
      </div>
    </div>
  );
}
