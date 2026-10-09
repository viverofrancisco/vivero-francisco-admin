"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ETIQUETA_ESTADO_OBRA,
  nombreCliente,
  type EstadoObra,
  type ObraDetalle,
} from "@vivero/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputNumero } from "@/components/ui/input-numero";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CustomSelect } from "@/components/ui/custom-select";
import { DatePicker } from "@/components/ui/date-picker";
import { StickyFormActions } from "@/components/shared/sticky-form-actions";
import { EncabezadoFormularioMovil } from "@/components/shared/encabezado-formulario-movil";

export interface ClienteParaObra {
  id: string;
  nombre: string;
  apellido: string | null;
  empresa: string | null;
  propiedades: { id: string; nombre: string; direccion: string | null }[];
}

export interface CentroParaObra {
  id: string;
  nombre: string;
  activo: boolean;
}

interface Valores {
  nombre: string;
  centroCostoId: string;
  estado: EstadoObra;
  clienteId: string;
  propiedadId: string;
  presupuesto: string;
  fechaInicio: string;
  fechaFin: string;
  notas: string;
}

function valoresDe(obra: ObraDetalle | null, centros: CentroParaObra[]): Valores {
  // Una obra nueva va a *Obras*, que es donde van casi todas.
  const porDefecto = centros.find((c) => c.activo && /^obras$/i.test(c.nombre))?.id ?? "";
  return {
    nombre: obra?.nombre ?? "",
    centroCostoId: obra ? obra.centroCosto?.id ?? "" : porDefecto,
    estado: obra?.estado ?? "EN_CURSO",
    clienteId: obra?.cliente?.id ?? "",
    propiedadId: obra?.propiedad?.id ?? "",
    presupuesto: obra?.presupuesto != null ? String(obra.presupuesto) : "",
    fechaInicio: obra?.fechaInicio ?? "",
    fechaFin: obra?.fechaFin ?? "",
    notas: obra?.notas ?? "",
  };
}

/**
 * Crear o editar una obra.
 *
 * El cliente y la propiedad son opcionales —las obras traídas de Contífico
 * llegan solo con su nombre—, pero son lo que después deja ver la obra desde
 * la ficha del cliente y cargarle sus visitas.
 */
export function ObraForm({
  obra,
  clientes,
  centros,
  volverA,
}: {
  obra: ObraDetalle | null;
  clientes: ClienteParaObra[];
  centros: CentroParaObra[];
  volverA: string;
}) {
  const router = useRouter();
  const editando = obra !== null;
  const inicial = valoresDe(obra, centros);
  const [v, setV] = useState<Valores>(inicial);
  const [guardando, setGuardando] = useState(false);
  const [confirmarArchivo, setConfirmarArchivo] = useState(false);

  const set = <K extends keyof Valores>(k: K, valor: Valores[K]) =>
    setV((prev) => ({ ...prev, [k]: valor }));

  const cliente = clientes.find((c) => c.id === v.clienteId) ?? null;
  const cambio = JSON.stringify(v) !== JSON.stringify(inicial);

  function elegirCliente(id: string) {
    const c = clientes.find((x) => x.id === id);
    // Con una sola propiedad, esa: es casi siempre el caso.
    setV((prev) => ({
      ...prev,
      clienteId: id,
      propiedadId: c?.propiedades.length === 1 ? c.propiedades[0].id : "",
    }));
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!v.nombre.trim()) return toast.error("Escribe el nombre de la obra");
    setGuardando(true);
    try {
      const cuerpo = {
        nombre: v.nombre.trim(),
        centroCostoId: v.centroCostoId || null,
        estado: v.estado,
        clienteId: v.clienteId || null,
        propiedadId: v.propiedadId || null,
        presupuesto: v.presupuesto.trim() ? Number(v.presupuesto) : null,
        fechaInicio: v.fechaInicio || null,
        fechaFin: v.fechaFin || null,
        notas: v.notas.trim() || null,
      };
      const res = await fetch(editando ? `/api/obras/${obra.id}` : "/api/obras", {
        method: editando ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "No se pudo guardar");
      toast.success(editando ? "Obra guardada" : "Obra creada");
      if (editando) router.refresh();
      else router.push(`/dashboard/obras/${body.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  async function archivar() {
    setGuardando(true);
    try {
      const res = await fetch(`/api/obras/${obra!.id}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "No se pudo archivar");
      toast.success("Obra archivada");
      router.push(volverA);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo archivar");
      setGuardando(false);
    }
  }

  const titulo = editando ? `Obra #${obra.numero}` : "Nueva obra";

  return (
    <form onSubmit={guardar}>
      <EncabezadoFormularioMovil
        titulo={titulo}
        accion={editando ? "Guardar" : "Crear"}
        cargando={guardando}
        deshabilitado={editando && !cambio}
        onCancelar={() => router.push(volverA)}
      />
      <div className="mx-auto max-w-2xl space-y-5 px-4 pt-3 pb-6 md:px-0 md:pt-0 md:pb-24">
        <div className="hidden items-start justify-between gap-3 md:flex">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
            {editando && obra.updatedByNombre ? (
              <p className="text-sm text-muted-foreground">
                Última modificación: {obra.updatedByNombre}
              </p>
            ) : null}
          </div>
          {editando ? (
            <Button type="button" variant="outline" onClick={() => setConfirmarArchivo(true)}>
              Archivar
            </Button>
          ) : null}
        </div>

        <Card>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre"
                value={v.nombre}
                onChange={(e) => set("nombre", e.target.value)}
                placeholder="Obra Casa del Sol"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Centro de costo</Label>
                <CustomSelect
                  value={v.centroCostoId}
                  onChange={(x) => set("centroCostoId", x)}
                  options={centros
                    .filter((c) => c.activo || c.id === v.centroCostoId)
                    .map((c) => ({ value: c.id, label: c.nombre }))}
                  placeholder="Sin centro de costo"
                  clearable
                />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <CustomSelect
                  value={v.estado}
                  onChange={(x) => set("estado", x as EstadoObra)}
                  options={(Object.keys(ETIQUETA_ESTADO_OBRA) as EstadoObra[]).map((e) => ({
                    value: e,
                    label: ETIQUETA_ESTADO_OBRA[e],
                  }))}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <CustomSelect
                    value={v.clienteId}
                    onChange={elegirCliente}
                    options={clientes.map((c) => ({ value: c.id, label: nombreCliente(c) }))}
                    placeholder="Sin cliente"
                    searchable
                    searchPlaceholder="Buscar cliente..."
                    clearable
                  />
                </div>
                <div className="space-y-2">
                  <Label>Propiedad</Label>
                  <CustomSelect
                    value={v.propiedadId}
                    onChange={(x) => set("propiedadId", x)}
                    options={(cliente?.propiedades ?? []).map((p) => ({
                      value: p.id,
                      label: p.nombre,
                      hint: p.direccion ?? undefined,
                    }))}
                    placeholder={cliente ? "Sin propiedad" : "Elige primero el cliente"}
                    disabled={!cliente}
                    clearable
                  />
                </div>
              </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="presupuesto">Presupuesto (sin IVA)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <InputNumero
                    id="presupuesto"
                    value={v.presupuesto}
                    onChange={(t) => set("presupuesto", t)}
                    decimales
                    className="pl-6"
                    inputMode="decimal"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Inicio</Label>
                <DatePicker value={v.fechaInicio} onChange={(d) => set("fechaInicio", d)} placeholder="Sin fecha" />
              </div>
              <div className="space-y-2">
                <Label>Fin</Label>
                <DatePicker value={v.fechaFin} onChange={(d) => set("fechaFin", d)} placeholder="Sin fecha" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notas">Notas</Label>
              <Textarea id="notas" rows={3} value={v.notas} onChange={(e) => set("notas", e.target.value)} />
            </div>

            {editando && obra.contificoCodigo ? (
              <p className="text-xs text-muted-foreground">
                Centro de costo {obra.contificoCodigo} en Contífico.
              </p>
            ) : null}
          </CardContent>
        </Card>

        {editando ? (
          <div className="md:hidden">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setConfirmarArchivo(true)}
            >
              Archivar obra
            </Button>
          </div>
        ) : null}
      </div>

      {editando ? (
        <Dialog open={confirmarArchivo} onOpenChange={setConfirmarArchivo}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>¿Archivar &quot;{obra.nombre}&quot;?</DialogTitle>
              <DialogDescription>
                Sale de las listas. Lo que ya se le cargó sigue diciendo que era de esta obra.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirmarArchivo(false)}>
                Cancelar
              </Button>
              <Button type="button" variant="destructive" onClick={archivar} disabled={guardando}>
                Archivar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      <div className="hidden md:block">
        <StickyFormActions
          saveLabel={editando ? "Guardar cambios" : "Crear obra"}
          saving={guardando}
          disabled={editando && !cambio}
          onCancel={() => router.push(volverA)}
        />
      </div>
    </form>
  );
}
