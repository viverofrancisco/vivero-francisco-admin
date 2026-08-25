"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CustomSelect } from "@/components/ui/custom-select";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { nombreCliente } from "@vivero/shared";
import {
  FacturasTable,
  type FacturaRow,
} from "@/components/facturas/facturas-table";
import {
  PERIODICIDAD_LABEL,
  PERIODICIDAD_SUFIJO,
  estadoVariant,
  money,
} from "./formato";

interface ItemData {
  id: string;
  productoId: string;
  nombre: string;
  precio: number;
  ivaTasa: number;
  visitasPorPeriodo: number | null;
}

interface SuscripcionData {
  id: string;
  estado: string;
  periodicidad: string;
  fechaInicio: string;
  notas: string | null;
  cliente: {
    id: string;
    nombre: string;
    apellido: string | null;
    empresa: string | null;
  };
  items: ItemData[];
}

interface ProductoSuscribible {
  id: string;
  nombre: string;
  ivaTasa: number | null;
  sincronizado: boolean;
}

/** Un ítem mientras se edita: los importes van como texto para no pelear con el input. */
interface ItemDraft {
  productoId: string;
  nombre: string;
  precio: string;
  ivaTasa: string;
  visitasPorPeriodo: string;
}

const PERIODICIDADES = ["MENSUAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL"];
const ESTADOS = ["ACTIVO", "PAUSADO", "CANCELADO"];

export function SuscripcionDetail({
  suscripcion,
  backHref,
  facturas,
}: {
  suscripcion: SuscripcionData;
  /** Las que salieron de los períodos de esta suscripción. */
  facturas: FacturaRow[];
  /** A dónde vuelve la flecha: de donde vino, no siempre a la lista. */
  backHref: string;
}) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  const [disponibles, setDisponibles] = useState<ProductoSuscribible[]>([]);

  const [periodicidad, setPeriodicidad] = useState(suscripcion.periodicidad);
  const [estado, setEstado] = useState(suscripcion.estado);
  const [fechaInicio, setFechaInicio] = useState(
    suscripcion.fechaInicio.slice(0, 10)
  );
  const [notas, setNotas] = useState(suscripcion.notas ?? "");
  const [items, setItems] = useState<ItemDraft[]>(
    suscripcion.items.map((i) => ({
      productoId: i.productoId,
      nombre: i.nombre,
      precio: String(i.precio),
      ivaTasa: String(i.ivaTasa),
      visitasPorPeriodo: i.visitasPorPeriodo ? String(i.visitasPorPeriodo) : "",
    }))
  );

  useEffect(() => {
    fetch(
      `/api/suscripciones/productos?clienteId=${suscripcion.cliente.id}&exceptoSuscripcionId=${suscripcion.id}`,
      { cache: "no-store" }
    )
      .then((r) => r.json())
      .then((d) => setDisponibles(d.items ?? []))
      .catch(() => setDisponibles([]));
  }, [suscripcion.cliente.id, suscripcion.id]);

  const sinAgregar = disponibles.filter(
    (p) => !items.some((i) => i.productoId === p.id)
  );

  const agregar = (productoId: string) => {
    const p = disponibles.find((x) => x.id === productoId);
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
      const res = await fetch(`/api/suscripciones/${suscripcion.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodicidad,
          estado,
          fechaInicio,
          notas: notas.trim() || null,
          items: items.map((i) => ({
            productoId: i.productoId,
            precio: Number(i.precio),
            ivaTasa: i.ivaTasa.trim() ? Number(i.ivaTasa) : null,
            visitasPorPeriodo: Number(i.visitasPorPeriodo),
          })),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      toast.success("Suscripción actualizada");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setGuardando(false);
    }
  };

  const sufijo = PERIODICIDAD_SUFIJO[periodicidad] ?? "";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={backHref}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h1 className="truncate text-2xl font-bold">
              {nombreCliente(suscripcion.cliente)}
            </h1>
            <Badge variant={estadoVariant[estado] ?? "outline"}>
              {estado.charAt(0) + estado.slice(1).toLowerCase()}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Suscripción · todos sus productos se cobran juntos, en una factura.
          </p>
        </div>
        <Link href={`/dashboard/clientes/${suscripcion.cliente.id}`}>
          <Button variant="outline">Ver cliente</Button>
        </Link>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="overflow-visible">
            <CardHeader className="border-b">
              <CardTitle className="text-base">Productos</CardTitle>
              <CardAction>
                <span className="text-sm font-semibold tabular-nums">
                  {money(totalPeriodo)}
                  <span className="text-xs font-normal text-muted-foreground">
                    {sufijo}
                  </span>
                </span>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.length === 0 ? (
                <p className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
                  Sin productos. Una suscripción necesita al menos uno.
                </p>
              ) : (
                items.map((i) => (
                  <div
                    key={i.productoId}
                    className="space-y-2 rounded-md border p-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-sm font-medium">
                        {i.nombre}
                      </span>
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
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}

              {sinAgregar.length > 0 && (
                <CustomSelect
                  value=""
                  onChange={agregar}
                  options={sinAgregar.map((p) => ({
                    value: p.id,
                    label: p.nombre,
                    disabled: !p.sincronizado,
                    hint: p.sincronizado
                      ? undefined
                      : "No está vinculado con Contífico, así que no se puede facturar.",
                  }))}
                  placeholder="Agregar producto recurrente"
                  searchable
                  searchPlaceholder="Buscar producto..."
                />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base">Facturas</CardTitle>
              <CardAction>
                <span className="text-xs text-muted-foreground">
                  {facturas.length}{" "}
                  {facturas.length === 1 ? "emitida" : "emitidas"}
                </span>
              </CardAction>
            </CardHeader>
            <CardContent>
              <FacturasTable facturas={facturas} mostrarCliente={false} compacta />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="overflow-visible">
            <CardHeader className="border-b">
              <CardTitle className="text-base">Términos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Se cobra</Label>
                <CustomSelect
                  value={periodicidad}
                  onChange={setPeriodicidad}
                  options={PERIODICIDADES.map((p) => ({
                    value: p,
                    label: PERIODICIDAD_LABEL[p],
                  }))}
                />
                <p className="text-xs text-muted-foreground">
                  Cambiar el precio rige desde el ciclo siguiente: los períodos
                  ya facturados guardan lo que se cobró.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <CustomSelect
                  value={estado}
                  onChange={setEstado}
                  options={ESTADOS.map((e) => ({
                    value: e,
                    label: e.charAt(0) + e.slice(1).toLowerCase(),
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inicio">Desde</Label>
                <Input
                  id="inicio"
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notas">Notas</Label>
                <Textarea
                  id="notas"
                  rows={3}
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
              <Button
                className="w-full"
                onClick={guardar}
                disabled={guardando || items.length === 0}
              >
                {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar cambios
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
