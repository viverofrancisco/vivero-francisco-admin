"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Star } from "lucide-react";
import { toast } from "sonner";

interface FirmanteItem {
  id: string;
  nombre: string;
  cedula: string | null;
  isDefault: boolean;
  orden: number;
}

export function FirmantesClient({
  initialItems,
}: {
  initialItems: FirmanteItem[];
}) {
  const [items, setItems] = useState<FirmanteItem[]>(initialItems);
  const [editing, setEditing] = useState<FirmanteItem | "new" | null>(null);

  async function refresh() {
    const res = await fetch("/api/admin/firmantes", { cache: "no-store" });
    if (!res.ok) return;
    const data: { items: FirmanteItem[] } = await res.json();
    setItems(data.items);
  }

  async function toggleDefault(item: FirmanteItem) {
    const res = await fetch(`/api/admin/firmantes/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: !item.isDefault }),
    });
    if (!res.ok) {
      toast.error("No pudimos actualizar");
      return;
    }
    await refresh();
  }

  async function deleteItem(item: FirmanteItem) {
    if (!confirm(`¿Eliminar a ${item.nombre}?`)) return;
    const res = await fetch(`/api/admin/firmantes/${item.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("No pudimos eliminar");
      return;
    }
    toast.success("Firmante eliminado");
    await refresh();
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4 mr-1.5" />
          Nuevo firmante
        </Button>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <Card key={item.id}>
            <CardContent className="flex items-center justify-between gap-4 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">{item.nombre}</p>
                  {item.isDefault ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                      <Star className="h-3 w-3 fill-current" /> Default
                    </span>
                  ) : null}
                </div>
                {item.cedula ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    C.I. {item.cedula}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground italic">
                    Sin cédula
                  </p>
                )}
              </div>
              <div className="flex flex-none items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleDefault(item)}
                  title={
                    item.isDefault
                      ? "Quitar como default"
                      : "Marcar como default"
                  }
                  className={item.isDefault ? "text-amber-600" : ""}
                >
                  <Star
                    className={`h-4 w-4 ${item.isDefault ? "fill-current" : ""}`}
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditing(item)}
                  title="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteItem(item)}
                  title="Eliminar"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {items.length === 0 ? (
          <div className="rounded-lg border bg-white p-8 text-center text-sm text-muted-foreground">
            Aún no hay firmantes configurados.
          </div>
        ) : null}
      </div>

      {editing !== null ? (
        <EditDialog
          item={editing === "new" ? null : editing}
          existingMaxOrden={items.reduce((max, t) => Math.max(max, t.orden), 0)}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      ) : null}
    </>
  );
}

function EditDialog({
  item,
  existingMaxOrden,
  onClose,
  onSaved,
}: {
  item: FirmanteItem | null;
  existingMaxOrden: number;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [nombre, setNombre] = useState(item?.nombre ?? "");
  const [cedula, setCedula] = useState(item?.cedula ?? "");
  const [isDefault, setIsDefault] = useState(item?.isDefault ?? false);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!nombre.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const url = item
        ? `/api/admin/firmantes/${item.id}`
        : "/api/admin/firmantes";
      const method = item ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          cedula: cedula.trim() || null,
          isDefault,
          ...(item ? {} : { orden: existingMaxOrden + 10 }),
        }),
      });
      if (!res.ok) throw new Error("save failed");
      await onSaved();
    } catch {
      toast.error("No pudimos guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">
          {item ? "Editar firmante" : "Nuevo firmante"}
        </h2>
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-sm font-medium">Nombre completo</label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Juan Pérez"
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm font-medium">
              Cédula{" "}
              <span className="text-muted-foreground/60">(opcional)</span>
            </label>
            <Input
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
              placeholder="Ej. 0918637877"
            />
          </div>
          <label className="flex items-start gap-2 cursor-pointer rounded-md border p-3 text-sm">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <span className="font-medium block">
                Agregar por defecto a nuevos informes
              </span>
              <span className="text-xs text-muted-foreground">
                Aparecerá pre-seleccionado al crear un informe (puedes
                quitarlo o cambiarlo).
              </span>
            </span>
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
