"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";

interface Plantilla {
  id: string;
  tipo: string;
  nombre: string;
  activa: boolean;
  whatsappTemplateStatus: string | null;
  whatsappDefaultTemplateStatus: string | null;
  whatsappPendingTemplateStatus: string | null;
  contenido: string;
}

interface NotificacionListProps {
  plantillas: Plantilla[];
}

const DESCRIPCIONES: Record<string, string> = {
  CONFIRMACION_VISITA_CLIENTE:
    "Se envía al cliente cuando se programa una nueva visita",
  RECORDATORIO_VISITA_CLIENTE:
    "Se envía al cliente un día antes de su visita programada",
  RESUMEN_DIARIO_ADMIN:
    "Resumen matutino con todas las visitas programadas del día",
  ALERTA_VISITA_COMPLETADA:
    "Se envía al admin cuando una visita se marca como completada",
  ALERTA_VISITA_INCOMPLETA:
    "Se envía al admin cuando una visita se marca como incompleta o cancelada",
  MENSAJE_ENTRANTE_CLIENTE:
    "Se envía al número configurado cuando un cliente escribe al WhatsApp del negocio",
};

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  APPROVED: { label: "Activa", variant: "default" },
  PENDING: { label: "En revisión", variant: "secondary" },
  REJECTED: { label: "Rechazada", variant: "destructive" },
};

/**
 * Compute the effective status for display:
 * - If there's a pending revision, show that
 * - If there's a custom template, show its status
 * - Otherwise show the default template status
 */
function getEffectiveStatus(p: Plantilla): string | null {
  if (p.whatsappPendingTemplateStatus) return p.whatsappPendingTemplateStatus;
  if (p.whatsappTemplateStatus) return p.whatsappTemplateStatus;
  if (p.whatsappDefaultTemplateStatus) return p.whatsappDefaultTemplateStatus;
  return null;
}

export function NotificacionList({ plantillas: initial }: NotificacionListProps) {
  const router = useRouter();
  const [plantillas, setPlantillas] = useState(initial);

  const handleToggle = async (plantilla: Plantilla, e: React.MouseEvent) => {
    e.stopPropagation();

    const newValue = !plantilla.activa;
    setPlantillas((prev) =>
      prev.map((p) => (p.id === plantilla.id ? { ...p, activa: newValue } : p))
    );

    try {
      const res = await fetch(`/api/notificaciones/plantillas/${plantilla.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activa: newValue, contenido: plantilla.contenido }),
      });
      if (!res.ok) throw new Error();
      toast.success(`${plantilla.nombre} ${newValue ? "activada" : "desactivada"}`);
    } catch {
      setPlantillas((prev) =>
        prev.map((p) =>
          p.id === plantilla.id ? { ...p, activa: !newValue } : p
        )
      );
      toast.error("Error al actualizar");
    }
  };

  return (
    <div className="space-y-3">
      {plantillas.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground">
          No hay notificaciones configuradas
        </p>
      ) : (
        plantillas.map((p) => (
          <Card
            key={p.id}
            className="cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all"
            onClick={() =>
              router.push(`/dashboard/configuracion/notificaciones/${p.id}`)
            }
          >
            <CardContent className="flex items-center gap-4 py-4">
              <div
                className="shrink-0"
                onClick={(e) => handleToggle(p, e)}
              >
                <Switch checked={p.activa} size="sm" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium">{p.nombre}</h3>
                  {(() => {
                    const status = getEffectiveStatus(p);
                    if (!status) {
                      return <Badge variant="outline">No creada en Meta</Badge>;
                    }
                    const cfg =
                      STATUS_BADGE[status] || {
                        label: status,
                        variant: "outline" as const,
                      };
                    return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
                  })()}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {DESCRIPCIONES[p.tipo] || ""}
                </p>
              </div>

              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
