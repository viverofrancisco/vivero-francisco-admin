"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CustomSelect } from "@/components/ui/custom-select";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  ServicioClientesTable,
  type ServicioClienteRow,
} from "@/components/servicios/servicio-clientes-table";

const TIPO_LABEL: Record<string, string> = {
  RECURRENTE: "Recurrente (mensual)",
  UNICO: "Único (una sola vez)",
};

interface ServicioData {
  id: string;
  nombre: string;
  tipo: string;
  descripcion: string | null;
}

export function ServicioDetail({
  servicio,
  clienteRows,
}: {
  servicio: ServicioData;
  clienteRows: ServicioClienteRow[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState({
    nombre: servicio.nombre,
    tipo: servicio.tipo,
    descripcion: servicio.descripcion ?? "",
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
          tipo: form.tipo,
          descripcion: form.descripcion,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Servicio actualizado");
      setData(form);
      setEditing(false);
      router.refresh();
    } catch {
      toast.error("Error al guardar el servicio");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{data.nombre}</h1>
          <p className="text-muted-foreground">Detalle del servicio</p>
        </div>
        {!editing && (
          <Button variant="outline" onClick={startEdit}>
            <Pencil className="mr-1.5 h-4 w-4" />
            Editar
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
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
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <CustomSelect
                  value={form.tipo}
                  onChange={(v) => setForm({ ...form, tipo: v })}
                  options={[
                    { value: "RECURRENTE", label: "Recurrente (mensual)" },
                    { value: "UNICO", label: "Único (una sola vez)" },
                  ]}
                />
              </div>
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
              <div>
                <div className="text-sm font-semibold text-muted-foreground">
                  Tipo
                </div>
                <div>{TIPO_LABEL[data.tipo] ?? data.tipo}</div>
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

      <ServicioClientesTable rows={clienteRows} />
    </div>
  );
}
