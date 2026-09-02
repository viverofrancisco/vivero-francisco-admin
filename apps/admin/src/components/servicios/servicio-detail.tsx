"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CustomSelect } from "@/components/ui/custom-select";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Link2,
  Pencil,
  Undo2,
} from "lucide-react";
import { CopyField } from "@/components/shared/copy-field";
import { toast } from "sonner";
import {
  ServicioClientesTable,
  type ServicioClienteRow,
} from "@/components/servicios/servicio-clientes-table";
import {
  ContificoSyncDialog,
  type ContificoProducto,
  type VinculoContifico,
} from "@/components/servicios/contifico-sync-dialog";

const TIPO_LABEL: Record<string, string> = {
  SERVICIO: "Servicio",
  BIEN: "Bien",
};

interface ServicioData {
  id: string;
  nombre: string;
  tipo: string;
  descripcion: string | null;
  ivaTasa: string | number | null;
  /** Llave anti-duplicados en Contífico. Se genera al sincronizar. */
  codigo: string | null;
  contificoProductoId: string | null;
  /** Cuándo se archivó, o `null` si está en el catálogo. */
  archivadoEl: string | null;
  categoriaId: string | null;
}

export function ServicioDetail({
  servicio,
  clienteRows,
  categorias = [],
  backHref = "/dashboard/productos",
}: {
  servicio: ServicioData;
  clienteRows: ServicioClienteRow[];
  /** Las del portal, para poder reagrupar el producto desde acá. */
  categorias?: { id: string; nombre: string }[];
  /** La lista de la que se vino, con sus filtros. */
  backHref?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [guardandoVinculo, setGuardandoVinculo] = useState(false);
  const [restaurando, setRestaurando] = useState(false);

  /** Lo devuelve al catálogo. No toca el vínculo con Contífico. */
  const restaurar = async () => {
    setRestaurando(true);
    try {
      const res = await fetch(`/api/servicios/${servicio.id}/restaurar`, {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error");
      toast.success("El producto vuelve al catálogo");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al restaurar");
    } finally {
      setRestaurando(false);
    }
  };
  const [contifico, setContifico] = useState<VinculoContifico>({
    codigo: servicio.codigo,
    contificoProductoId: servicio.contificoProductoId,
  });

  /** Vincular y cambiar son la misma llamada: el POST pisa el vínculo previo. */
  const guardarVinculo = async (init: RequestInit, exito: string) => {
    setGuardandoVinculo(true);
    try {
      const res = await fetch(`/api/servicios/${servicio.id}/contifico`, init);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error");
      setContifico(body);
      setSyncOpen(false);
      toast.success(exito);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos guardar");
    } finally {
      setGuardandoVinculo(false);
    }
  };

  const elegir = (
    p: ContificoProducto,
    opciones: { actualizarNombre: boolean }
  ) =>
    guardarVinculo(
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contificoProductoId: p.id,
          codigo: p.codigo,
          actualizarNombre: opciones.actualizarNombre,
        }),
      },
      opciones.actualizarNombre
        ? `Vinculado y renombrado en Contífico`
        : `Vinculado con "${p.nombre}"`
    );

  const crearNuevo = () =>
    guardarVinculo({ method: "POST" }, "Producto creado en Contífico");

  const desvincular = () =>
    guardarVinculo({ method: "DELETE" }, "Vínculo deshecho");
  const [data, setData] = useState({
    nombre: servicio.nombre,
    tipo: servicio.tipo,
    descripcion: servicio.descripcion ?? "",
    categoriaId: servicio.categoriaId,
  });
  const [form, setForm] = useState(data);

  const startEdit = () => {
    setForm(data);
    setEditing(true);
  };

  const save = async () => {
    if (!form.nombre.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/servicios/${servicio.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          // `tipo` es inmutable: se manda tal cual está para que el servidor
          // lo valide, no para cambiarlo.
          tipo: form.tipo,
          descripcion: form.descripcion,
          categoriaId: form.categoriaId,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Producto actualizado");
      setData(form);
      setEditing(false);
      router.refresh();
    } catch {
      toast.error("Error al guardar el producto");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {/* Faltaba: era la única ficha sin forma de volver al listado. */}
          <Link href={backHref}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{data.nombre}</h1>
            <p className="text-muted-foreground">Detalle del producto</p>
          </div>
        </div>
        {!editing && (
          <Button variant="outline" onClick={startEdit}>
            <Pencil className="mr-1.5 h-4 w-4" />
            Editar
          </Button>
        )}
      </div>

      {/* Archivado, la ficha se abre igual —se llega desde el filtro, y desde
          una orden vieja que lo nombra— pero tiene que decirlo: si no, se ve
          idéntica a la de un producto que sigue a la venta. */}
      {servicio.archivadoEl && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <span>
            Este producto está archivado: no se ofrece en visitas, órdenes ni
            suscripciones. Lo que ya lo nombra sigue igual.
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={restaurar}
            disabled={restaurando}
          >
            <Undo2 className="mr-2 h-4 w-4" />
            Restaurar
          </Button>
        </div>
      )}

      {/* El detalle manda; Contífico es estado de apoyo, va al costado. */}
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="space-y-4">
              {editing ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="nombre">Nombre *</Label>
                    <Input
                      id="nombre"
                      value={form.nombre}
                      onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    />
                  </div>
                  {/* Reagrupa el producto en el portal. No toca la
                      categoría que tiene en Contífico: allá lleva la cuenta
                      contable, y moverlo cambiaría dónde se contabilizaron
                      ventas que ya pasaron. */}
                  {categorias.length > 0 && (
                    <div className="space-y-2">
                      <Label>Categoría</Label>
                      <CustomSelect
                        value={form.categoriaId ?? ""}
                        onChange={(v) =>
                          setForm({ ...form, categoriaId: v || null })
                        }
                        options={[
                          { value: "", label: "Sin categoría" },
                          ...categorias.map((c) => ({
                            value: c.id,
                            label: c.nombre,
                          })),
                        ]}
                        placeholder="Sin categoría"
                        searchable
                        searchPlaceholder="Buscar categoría..."
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="descripcion">Descripción</Label>
                    <Textarea
                      id="descripcion"
                      rows={4}
                      value={form.descripcion}
                      onChange={(e) =>
                        setForm({ ...form, descripcion: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      variant="outline"
                      onClick={() => setEditing(false)}
                      disabled={saving}
                    >
                      Cancelar
                    </Button>
                    <Button onClick={save} disabled={saving}>
                      {saving ? "Guardando..." : "Guardar cambios"}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <div className="text-sm font-semibold text-muted-foreground">
                        Tipo
                      </div>
                      <div>{TIPO_LABEL[data.tipo] ?? data.tipo}</div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-muted-foreground">
                        Categoría
                      </div>
                      <div>
                        {categorias.find((c) => c.id === data.categoriaId)
                          ?.nombre ?? (
                          <span className="text-muted-foreground">
                            Sin categoría
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-muted-foreground">
                      Descripción
                    </div>
                    <div className="whitespace-pre-wrap">
                      {data.descripcion || (
                        <span className="text-muted-foreground">Sin descripción</span>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          {/* Facturar exige el `producto_id` de Contífico. Sin vínculo, el
              producto no se puede agregar a una orden ni contratar en una
              suscripción. */}
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-sm font-semibold">Contífico</CardTitle>
              <CardAction>
                {contifico.contificoProductoId ? (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Vinculado
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Sin vincular
                  </span>
                )}
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-3">
              {contifico.contificoProductoId ? (
                <div className="divide-y rounded-lg border bg-muted/30">
                  {contifico.codigo && (
                    <CopyField
                      label="Código"
                      value={contifico.codigo}
                      className="px-2.5 py-2"
                    />
                  )}
                  <CopyField
                    label="ID"
                    value={contifico.contificoProductoId}
                    className="px-2.5 py-2"
                  />
                </div>
              ) : (
                <p className="rounded-lg bg-amber-50 p-3 text-xs leading-snug text-amber-800">
                  Hasta que esté vinculado, este producto no se puede agregar a
                  una orden ni contratar en una suscripción.
                </p>
              )}

              <div className="flex gap-2">
                {contifico.contificoProductoId ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setSyncOpen(true)}
                      disabled={guardandoVinculo}
                    >
                      Cambiar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 text-muted-foreground"
                      onClick={desvincular}
                      disabled={guardandoVinculo}
                    >
                      Desvincular
                    </Button>
                  </>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => setSyncOpen(true)}
                    disabled={guardandoVinculo}
                  >
                    <Link2 className="mr-2 h-4 w-4" />
                    Vincular
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Montado solo cuando está abierto: así el asistente arranca siempre
          en el primer paso, sin tener que resetearlo a mano. */}
      {syncOpen && (
        <ContificoSyncDialog
          producto={{
            id: servicio.id,
            nombre: data.nombre,
            descripcion: data.descripcion || null,
            tipo: data.tipo,
            ivaTasa: servicio.ivaTasa != null ? Number(servicio.ivaTasa) : null,
          }}
          open={syncOpen}
          onOpenChange={setSyncOpen}
          actualId={contifico.contificoProductoId}
          guardando={guardandoVinculo}
          onElegir={elegir}
          onCrearNuevo={crearNuevo}
        />
      )}

      <ServicioClientesTable rows={clienteRows} />
    </div>
  );
}
