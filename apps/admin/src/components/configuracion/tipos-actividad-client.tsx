"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface TipoItem {
  id: string;
  nombre: string;
  descripcionTemplate: string | null;
  orden: number;
  activo: boolean;
}

export function TiposActividadClient({
  initialItems,
}: {
  initialItems: TipoItem[];
}) {
  const [items, setItems] = useState<TipoItem[]>(initialItems);
  const [editing, setEditing] = useState<TipoItem | "new" | null>(null);

  async function refresh() {
    const res = await fetch("/api/admin/tipos-actividad?incluirInactivos=true", {
      cache: "no-store",
    });
    if (!res.ok) return;
    const data: { items: TipoItem[] } = await res.json();
    setItems(data.items);
  }

  async function move(id: string, direction: -1 | 1) {
    const idx = items.findIndex((t) => t.id === id);
    const targetIdx = idx + direction;
    if (idx < 0 || targetIdx < 0 || targetIdx >= items.length) return;
    const a = items[idx];
    const b = items[targetIdx];
    // Swap orden values via API.
    await fetch(`/api/admin/tipos-actividad/${a.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orden: b.orden }),
    });
    await fetch(`/api/admin/tipos-actividad/${b.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orden: a.orden }),
    });
    await refresh();
  }

  async function toggleActivo(item: TipoItem) {
    await fetch(`/api/admin/tipos-actividad/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !item.activo }),
    });
    await refresh();
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4 mr-1.5" />
          Nuevo tipo
        </Button>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <Card
            key={item.id}
            className={item.activo ? "" : "opacity-60"}
          >
            <CardContent className="flex items-start justify-between gap-4 py-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {item.nombre}
                  {!item.activo ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (Inactivo)
                    </span>
                  ) : null}
                </p>
                {item.descripcionTemplate ? (
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                    {item.descripcionTemplate}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground italic">
                    Sin descripción default
                  </p>
                )}
              </div>
              <div className="flex flex-none items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => move(item.id, -1)}
                  title="Subir"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => move(item.id, 1)}
                  title="Bajar"
                >
                  <ArrowDown className="h-4 w-4" />
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
                  onClick={() => toggleActivo(item)}
                  title={item.activo ? "Desactivar" : "Reactivar"}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {items.length === 0 ? (
          <div className="rounded-lg border bg-white p-8 text-center text-sm text-muted-foreground">
            Aún no hay tipos de actividad.
          </div>
        ) : null}
      </div>

      {editing !== null ? (
        <EditDialog
          item={editing === "new" ? null : editing}
          existingMaxOrden={
            items.reduce((max, t) => Math.max(max, t.orden), 0)
          }
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
  item: TipoItem | null;
  existingMaxOrden: number;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [nombre, setNombre] = useState(item?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(
    item?.descripcionTemplate ?? ""
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!nombre.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const url = item
        ? `/api/admin/tipos-actividad/${item.id}`
        : "/api/admin/tipos-actividad";
      const method = item ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          descripcionTemplate: descripcion.trim() || null,
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
          {item ? "Editar tipo de actividad" : "Nuevo tipo de actividad"}
        </h2>
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-sm font-medium">Nombre</label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Poda de árboles"
            />
          </div>
          <div>
            <label className="text-sm font-medium">
              Descripción default (opcional)
            </label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={5}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Texto que aparecerá por defecto en los informes para este tipo de actividad."
            />
          </div>
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
