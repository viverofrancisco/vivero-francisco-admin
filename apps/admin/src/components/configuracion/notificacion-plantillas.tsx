"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
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
import { toast } from "sonner";
import { Pencil, Upload, RefreshCw, Trash2 } from "lucide-react";

interface Plantilla {
  id: string;
  tipo: string;
  nombre: string;
  activa: boolean;
  whatsappTemplateName: string | null;
  whatsappTemplateStatus: string | null;
  whatsappTemplateLanguage: string;
  whatsappPendingTemplateName: string | null;
  whatsappPendingTemplateStatus: string | null;
  contenido: string;
  variables: string[];
}

interface NotificacionPlantillasProps {
  plantillas: Plantilla[];
}

const TIPO_LABELS: Record<string, string> = {
  CONFIRMACION_VISITA_CLIENTE: "Cliente",
  RECORDATORIO_VISITA_CLIENTE: "Cliente",
  RESUMEN_DIARIO_ADMIN: "Admin",
  ALERTA_VISITA_COMPLETADA: "Admin",
  ALERTA_VISITA_INCOMPLETA: "Admin",
};

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  APPROVED: { label: "Aprobado", variant: "default" },
  PENDING: { label: "Pendiente", variant: "secondary" },
  REJECTED: { label: "Rechazado", variant: "destructive" },
};

function TemplateStatusBadge({
  status,
  isPending,
}: {
  status: string | null;
  isPending?: boolean;
}) {
  if (!status) {
    return <Badge variant="outline">No creado en Meta</Badge>;
  }

  const config = STATUS_CONFIG[status] || {
    label: status,
    variant: "outline" as const,
  };

  return (
    <Badge variant={config.variant}>
      {isPending ? `Nueva versión: ${config.label}` : config.label}
    </Badge>
  );
}

export function NotificacionPlantillas({
  plantillas: initialPlantillas,
}: NotificacionPlantillasProps) {
  const router = useRouter();
  const [plantillas, setPlantillas] = useState(initialPlantillas);
  const [editingPlantilla, setEditingPlantilla] = useState<Plantilla | null>(
    null
  );
  const [editContenido, setEditContenido] = useState("");
  const [saving, setSaving] = useState(false);
  const [metaLoading, setMetaLoading] = useState<string | null>(null);

  const handleToggle = async (plantilla: Plantilla) => {
    try {
      const res = await fetch(`/api/notificaciones/plantillas/${plantilla.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activa: !plantilla.activa,
          contenido: plantilla.contenido,
        }),
      });

      if (!res.ok) throw new Error("Error al actualizar");

      setPlantillas((prev) =>
        prev.map((p) =>
          p.id === plantilla.id ? { ...p, activa: !p.activa } : p
        )
      );
      toast.success(
        `${plantilla.nombre} ${!plantilla.activa ? "activada" : "desactivada"}`
      );
    } catch {
      toast.error("Error al actualizar plantilla");
    }
  };

  const openEdit = (plantilla: Plantilla) => {
    setEditingPlantilla(plantilla);
    setEditContenido(plantilla.contenido);
  };

  const handleSaveEdit = async () => {
    if (!editingPlantilla) return;
    setSaving(true);

    try {
      const res = await fetch(
        `/api/notificaciones/plantillas/${editingPlantilla.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contenido: editContenido }),
        }
      );

      if (!res.ok) throw new Error("Error al guardar");

      setPlantillas((prev) =>
        prev.map((p) =>
          p.id === editingPlantilla.id
            ? { ...p, contenido: editContenido }
            : p
        )
      );
      setEditingPlantilla(null);
      toast.success("Plantilla actualizada");
      router.refresh();
    } catch {
      toast.error("Error al guardar plantilla");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateInMeta = async (plantilla: Plantilla) => {
    setMetaLoading(plantilla.id);
    try {
      const res = await fetch(
        `/api/notificaciones/plantillas/${plantilla.id}/meta`,
        { method: "POST" }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al crear template en Meta");
      }

      setPlantillas((prev) =>
        prev.map((p) => (p.id === plantilla.id ? { ...p, ...data } : p))
      );

      toast.success(
        plantilla.whatsappTemplateName
          ? "Nueva versión creada en Meta (pendiente de aprobación)"
          : "Template creado en Meta (pendiente de aprobación)"
      );
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al crear template"
      );
    } finally {
      setMetaLoading(null);
    }
  };

  const handleCheckStatus = async (plantilla: Plantilla) => {
    setMetaLoading(plantilla.id);
    try {
      const res = await fetch(
        `/api/notificaciones/plantillas/${plantilla.id}/meta`
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al verificar estado");
      }

      setPlantillas((prev) =>
        prev.map((p) => (p.id === plantilla.id ? { ...p, ...data } : p))
      );

      const status = data.whatsappTemplateStatus;
      if (status === "APPROVED") {
        toast.success("Template aprobado por Meta");
      } else if (status === "REJECTED") {
        toast.error("Template rechazado por Meta");
      } else {
        toast.info(`Estado: ${status || "pendiente"}`);
      }
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al verificar estado"
      );
    } finally {
      setMetaLoading(null);
    }
  };

  const handleDeleteFromMeta = async (plantilla: Plantilla) => {
    setMetaLoading(plantilla.id);
    try {
      const res = await fetch(
        `/api/notificaciones/plantillas/${plantilla.id}/meta`,
        { method: "DELETE" }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al eliminar template");
      }

      setPlantillas((prev) =>
        prev.map((p) => (p.id === plantilla.id ? { ...p, ...data } : p))
      );

      toast.success("Template eliminado de Meta");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al eliminar template"
      );
    } finally {
      setMetaLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      {plantillas.map((plantilla) => {
        const isLoading = metaLoading === plantilla.id;
        const hasActiveTemplate = !!plantilla.whatsappTemplateName;
        const hasPending = !!plantilla.whatsappPendingTemplateName;
        const isPending =
          plantilla.whatsappTemplateStatus === "PENDING" || hasPending;

        return (
          <Card key={plantilla.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-wrap">
                  <CardTitle className="text-base">
                    {plantilla.nombre}
                  </CardTitle>
                  <Badge
                    variant={
                      TIPO_LABELS[plantilla.tipo] === "Cliente"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {TIPO_LABELS[plantilla.tipo] || plantilla.tipo}
                  </Badge>
                  <TemplateStatusBadge
                    status={plantilla.whatsappTemplateStatus}
                  />
                  {hasPending && (
                    <TemplateStatusBadge
                      status={plantilla.whatsappPendingTemplateStatus}
                      isPending
                    />
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={plantilla.activa}
                    onCheckedChange={() => handleToggle(plantilla)}
                    size="sm"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(plantilla)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground whitespace-pre-line line-clamp-3">
                {plantilla.contenido}
              </p>

              {plantilla.whatsappTemplateName && (
                <p className="text-xs text-muted-foreground">
                  Template activo:{" "}
                  <span className="font-mono">
                    {plantilla.whatsappTemplateName}
                  </span>
                </p>
              )}

              {/* Meta action buttons */}
              <div className="flex flex-wrap gap-2">
                {!hasActiveTemplate && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCreateInMeta(plantilla)}
                    disabled={isLoading}
                  >
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    {isLoading ? "Creando..." : "Crear en Meta"}
                  </Button>
                )}

                {hasActiveTemplate &&
                  plantilla.whatsappTemplateStatus === "APPROVED" &&
                  !hasPending && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCreateInMeta(plantilla)}
                      disabled={isLoading}
                    >
                      <Upload className="mr-1.5 h-3.5 w-3.5" />
                      {isLoading ? "Actualizando..." : "Actualizar en Meta"}
                    </Button>
                  )}

                {isPending && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCheckStatus(plantilla)}
                    disabled={isLoading}
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    {isLoading ? "Verificando..." : "Verificar estado"}
                  </Button>
                )}

                {hasActiveTemplate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteFromMeta(plantilla)}
                    disabled={isLoading}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    {isLoading ? "Eliminando..." : "Eliminar de Meta"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Edit Dialog */}
      <Dialog
        open={!!editingPlantilla}
        onOpenChange={(open) => !open && setEditingPlantilla(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar plantilla</DialogTitle>
          </DialogHeader>
          {editingPlantilla && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Contenido del mensaje</Label>
                <Textarea
                  value={editContenido}
                  onChange={(e) => setEditContenido(e.target.value)}
                  rows={5}
                />
                <div className="flex flex-wrap gap-1">
                  {editingPlantilla.variables.map((v) => (
                    <button
                      key={v}
                      type="button"
                      className="text-xs bg-muted px-2 py-0.5 rounded-full cursor-pointer hover:bg-muted/80"
                      onClick={() =>
                        setEditContenido((prev) => `${prev}{{${v}}}`)
                      }
                    >
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Después de guardar, usa &quot;Actualizar en Meta&quot; para
                  crear una nueva versión del template.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setEditingPlantilla(null)}
                >
                  Cancelar
                </Button>
                <Button onClick={handleSaveEdit} disabled={saving}>
                  {saving ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
