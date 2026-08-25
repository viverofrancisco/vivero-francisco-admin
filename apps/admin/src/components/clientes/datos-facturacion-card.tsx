"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomSelect } from "@/components/ui/custom-select";
import { PhoneInput } from "@/components/ui/phone-input";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/shared/empty-state";
import { Archive, Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

export interface DatoFacturacion {
  id: string;
  tipoIdentificacion: "CEDULA" | "RUC";
  identificacion: string;
  razonSocial: string;
  tipoPersona: "NATURAL" | "JURIDICA";
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  esPredeterminado: boolean;
}

interface Borrador {
  tipoIdentificacion: "CEDULA" | "RUC";
  identificacion: string;
  razonSocial: string;
  tipoPersona: "NATURAL" | "JURIDICA";
  direccion: string;
  telefono: string;
  email: string;
  esPredeterminado: boolean;
}

const vacio: Borrador = {
  tipoIdentificacion: "CEDULA",
  identificacion: "",
  razonSocial: "",
  tipoPersona: "NATURAL",
  direccion: "",
  telefono: "",
  email: "",
  esPredeterminado: false,
};

/**
 * Los datos con los que se le factura a un cliente.
 *
 * Puede tener más de uno: a nombre propio y al de su empresa, o a razones
 * sociales distintas. Al emitir se elige cuál, y el predeterminado es el que se
 * propone.
 *
 * Los campos son los que Contífico guarda de una persona; no hay ninguno de
 * adorno.
 */
export function DatosFacturacionCard({
  clienteId,
  datos,
}: {
  clienteId: string;
  datos: DatoFacturacion[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState<Borrador>(vacio);

  const abrirNuevo = () => {
    setForm({ ...vacio, esPredeterminado: datos.length === 0 });
    setEditando(null);
    setAbierto(true);
  };

  const abrirEdicion = (d: DatoFacturacion) => {
    setForm({
      tipoIdentificacion: d.tipoIdentificacion,
      identificacion: d.identificacion,
      razonSocial: d.razonSocial,
      tipoPersona: d.tipoPersona,
      direccion: d.direccion ?? "",
      telefono: d.telefono ?? "",
      email: d.email ?? "",
      esPredeterminado: d.esPredeterminado,
    });
    setEditando(d.id);
    setAbierto(true);
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      const res = await fetch(
        editando
          ? `/api/facturacion/${editando}`
          : `/api/clientes/${clienteId}/facturacion`,
        {
          method: editando ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            direccion: form.direccion.trim() || null,
            telefono: form.telefono.trim() || null,
            email: form.email.trim() || null,
          }),
        }
      );
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      toast.success(editando ? "Datos actualizados" : "Datos agregados");
      setAbierto(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setGuardando(false);
    }
  };

  const archivar = async (d: DatoFacturacion) => {
    if (
      !window.confirm(
        `¿Archivar los datos de "${d.razonSocial}"?\n\nNo se van a ofrecer más al facturar. Las facturas ya emitidas los siguen mostrando.`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/facturacion/${d.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      toast.success("Datos archivados");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Datos de facturación</CardTitle>
          <CardAction>
            <Button
              size="sm"
              variant="ghost"
              onClick={abrirNuevo}
              title="Agregar datos de facturación"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {datos.length === 0 ? (
            <EmptyState message="Sin datos de facturación" />
          ) : (
            <div className="space-y-2">
              {datos.map((d) => (
                <div
                  key={d.id}
                  className="flex items-start justify-between gap-2 rounded-lg border p-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{d.razonSocial}</p>
                    <p className="text-xs font-semibold text-muted-foreground">
                      {d.tipoIdentificacion} {d.identificacion}
                      {d.esPredeterminado && " · predeterminado"}
                    </p>
                  </div>
                  <div className="flex flex-none gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => abrirEdicion(d)}
                      title="Editar"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => archivar(d)}
                      title="Archivar"
                    >
                      <Archive className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editando ? "Editar datos de facturación" : "Datos de facturación"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo de identificación *</Label>
                <CustomSelect
                  value={form.tipoIdentificacion}
                  onChange={(v) =>
                    setForm({
                      ...form,
                      tipoIdentificacion: v as "CEDULA" | "RUC",
                      // Un RUC es casi siempre de una jurídica; se propone y se
                      // puede corregir (hay RUC de persona natural).
                      tipoPersona: v === "RUC" ? "JURIDICA" : "NATURAL",
                    })
                  }
                  options={[
                    { value: "CEDULA", label: "Cédula" },
                    { value: "RUC", label: "RUC" },
                  ]}
                />
              </div>
              <div className="space-y-2">
                {/* La etiqueta sigue al tipo elegido: un "Número" a secas se
                    confundía con el teléfono, que está más abajo. */}
                <Label htmlFor="identificacion">
                  {form.tipoIdentificacion === "RUC" ? "RUC *" : "Cédula *"}
                </Label>
                <Input
                  id="identificacion"
                  inputMode="numeric"
                  value={form.identificacion}
                  onChange={(e) =>
                    setForm({ ...form, identificacion: e.target.value })
                  }
                  placeholder={
                    form.tipoIdentificacion === "RUC"
                      ? "13 dígitos"
                      : "10 dígitos"
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="razonSocial">Razón social *</Label>
              <Input
                id="razonSocial"
                value={form.razonSocial}
                onChange={(e) =>
                  setForm({ ...form, razonSocial: e.target.value })
                }
                placeholder="Como debe salir en la factura"
              />
              <p className="text-xs text-muted-foreground">
                Es lo que se imprime en el documento del SRI, no el nombre con
                el que figura en el portal.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Tipo de persona *</Label>
              <CustomSelect
                value={form.tipoPersona}
                onChange={(v) =>
                  setForm({ ...form, tipoPersona: v as "NATURAL" | "JURIDICA" })
                }
                options={[
                  { value: "NATURAL", label: "Natural" },
                  { value: "JURIDICA", label: "Jurídica" },
                ]}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="direccion-fact">Dirección</Label>
              <Input
                id="direccion-fact"
                value={form.direccion}
                onChange={(e) => setForm({ ...form, direccion: e.target.value })}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="telefono-fact">Teléfono</Label>
                <PhoneInput
                  id="telefono-fact"
                  value={form.telefono}
                  onChange={(v) => setForm({ ...form, telefono: v })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-fact">Email</Label>
                <Input
                  id="email-fact"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="Recibe la factura electrónica"
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2.5">
              <Checkbox
                checked={form.esPredeterminado}
                onCheckedChange={(v) =>
                  setForm({ ...form, esPredeterminado: v === true })
                }
              />
              <span className="text-sm">
                Usar como predeterminado al facturar
              </span>
            </label>

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button
                variant="outline"
                onClick={() => setAbierto(false)}
                disabled={guardando}
              >
                Cancelar
              </Button>
              <Button onClick={guardar} disabled={guardando}>
                {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
