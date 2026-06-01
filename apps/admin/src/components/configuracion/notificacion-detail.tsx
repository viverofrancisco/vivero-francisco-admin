"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WhatsAppEditor } from "@/components/configuracion/whatsapp-editor";
import { WhatsAppPreview } from "@/components/configuracion/whatsapp-preview";
import { toast } from "sonner";
import { Send, RotateCcw, CheckCircle2, Clock, XCircle, AlertCircle, Ban, Eye } from "lucide-react";

interface PlantillaData {
  id: string;
  tipo: string;
  nombre: string;
  activa: boolean;
  contenidoOriginal: string | null;
  whatsappDefaultTemplateName: string | null;
  whatsappDefaultTemplateStatus: string | null;
  whatsappTemplateName: string | null;
  whatsappTemplateStatus: string | null;
  whatsappPendingTemplateName: string | null;
  whatsappPendingTemplateStatus: string | null;
  contenido: string;
  contenidoEnRevision: string | null;
  variables: string[];
}

interface ScheduleConfig {
  horaEnvioRecordatorio: string;
  horaEnvioDigesto: string;
  diasAnticipacion: number;
}

interface NotificacionDetailProps {
  plantilla: PlantillaData;
  scheduleConfig?: ScheduleConfig;
}

const TIPOS_CON_HORA_RECORDATORIO = ["RECORDATORIO_VISITA_CLIENTE"];
const TIPOS_CON_HORA_DIGESTO = ["RESUMEN_DIARIO_ADMIN"];

type StatusKind = "approved" | "pending" | "rejected" | "not-created";

function getStatusInfo(plantilla: PlantillaData): {
  kind: StatusKind;
  title: string;
  description: string;
  icon: typeof CheckCircle2;
  iconClass: string;
} {
  const hasDefault = !!plantilla.whatsappDefaultTemplateName;
  const hasCustom = !!plantilla.whatsappTemplateName;
  const hasPending = !!plantilla.whatsappPendingTemplateName;

  const defaultStatus = plantilla.whatsappDefaultTemplateStatus;
  const customStatus = plantilla.whatsappTemplateStatus;
  const pendingStatus = plantilla.whatsappPendingTemplateStatus;

  // No templates at all
  if (!hasDefault && !hasCustom) {
    return {
      kind: "not-created",
      title: "Sin configurar",
      description:
        "Los templates de WhatsApp aún no se han creado. Ejecuta el script de configuración para registrarlos en Meta.",
      icon: AlertCircle,
      iconClass: "text-muted-foreground",
    };
  }

  // Pending (update of existing approved custom) is in review
  if (hasPending && pendingStatus === "PENDING") {
    return {
      kind: "pending",
      title: "Tu nueva versión está en revisión",
      description:
        "WhatsApp está revisando tu nueva versión. Mientras tanto se sigue enviando la versión anterior aprobada. Generalmente toma unos minutos.",
      icon: Clock,
      iconClass: "text-amber-500",
    };
  }

  // Pending was rejected
  if (hasPending && pendingStatus === "REJECTED") {
    return {
      kind: "rejected",
      title: "Tu última versión fue rechazada",
      description:
        "WhatsApp rechazó tu última versión. Se sigue enviando la versión anterior aprobada. Revisa el contenido y guarda de nuevo para intentar otra vez.",
      icon: XCircle,
      iconClass: "text-destructive",
    };
  }

  // First-time custom edit in review (no custom approved yet)
  if (hasCustom && customStatus === "PENDING") {
    return {
      kind: "pending",
      title: "Tu nueva versión está en revisión",
      description:
        "WhatsApp está revisando tu versión personalizada. Mientras tanto se sigue enviando el mensaje original aprobado. Generalmente toma unos minutos.",
      icon: Clock,
      iconClass: "text-amber-500",
    };
  }

  // Custom template was rejected
  if (hasCustom && customStatus === "REJECTED") {
    return {
      kind: "rejected",
      title: "Tu versión personalizada fue rechazada",
      description:
        "WhatsApp rechazó tu versión personalizada. Se sigue enviando el mensaje original. Edita el contenido y guarda de nuevo para intentar otra vez.",
      icon: XCircle,
      iconClass: "text-destructive",
    };
  }

  // Custom approved
  if (hasCustom && customStatus === "APPROVED") {
    return {
      kind: "approved",
      title: "Tu mensaje personalizado está activo",
      description: "Aprobado por WhatsApp y listo para enviar.",
      icon: CheckCircle2,
      iconClass: "text-emerald-600",
    };
  }

  // Default approved, no custom
  if (hasDefault && defaultStatus === "APPROVED" && !hasCustom) {
    return {
      kind: "approved",
      title: "Mensaje original activo",
      description:
        "Aprobado por WhatsApp y listo para enviar. Puedes editarlo para crear una versión personalizada.",
      icon: CheckCircle2,
      iconClass: "text-emerald-600",
    };
  }

  // Default still pending (just created)
  if (hasDefault && defaultStatus === "PENDING") {
    return {
      kind: "pending",
      title: "Mensaje original en revisión",
      description:
        "WhatsApp está revisando el mensaje. Una vez aprobado, podrás empezar a enviar notificaciones.",
      icon: Clock,
      iconClass: "text-amber-500",
    };
  }

  // Default was rejected
  if (hasDefault && defaultStatus === "REJECTED") {
    return {
      kind: "rejected",
      title: "El mensaje original fue rechazado",
      description:
        "WhatsApp rechazó el mensaje original. Edita el contenido y vuelve a intentarlo.",
      icon: XCircle,
      iconClass: "text-destructive",
    };
  }

  // Fallback
  return {
    kind: "not-created",
    title: "Estado desconocido",
    description: "Verifica la configuración del template.",
    icon: AlertCircle,
    iconClass: "text-muted-foreground",
  };
}

export function NotificacionDetail({
  plantilla: initial,
  scheduleConfig,
}: NotificacionDetailProps) {
  const router = useRouter();
  const [plantilla, setPlantilla] = useState(initial);
  const [contenido, setContenido] = useState(initial.contenido);
  const [saving, setSaving] = useState(false);
  const [testTelefono, setTestTelefono] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Preview dialog state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState("");
  const [previewCanTest, setPreviewCanTest] = useState(false);

  // Schedule config state
  const [horaEnvio, setHoraEnvio] = useState(
    TIPOS_CON_HORA_RECORDATORIO.includes(initial.tipo)
      ? scheduleConfig?.horaEnvioRecordatorio || "08:00"
      : scheduleConfig?.horaEnvioDigesto || "07:00"
  );
  const [diasAnticipacion, setDiasAnticipacion] = useState(
    scheduleConfig?.diasAnticipacion || 1
  );
  const [savingSchedule, setSavingSchedule] = useState(false);

  const showRecordatorioConfig = TIPOS_CON_HORA_RECORDATORIO.includes(plantilla.tipo);
  const showDigestoConfig = TIPOS_CON_HORA_DIGESTO.includes(plantilla.tipo);
  const showScheduleConfig = showRecordatorioConfig || showDigestoConfig;

  const hasContentChanges = contenido !== plantilla.contenido;
  // isSavedCustomized uses the SAVED content, not the live editor value
  const isSavedCustomized = plantilla.contenidoOriginal
    ? plantilla.contenido !== plantilla.contenidoOriginal
    : false;
  const hasDefaultTemplate = !!plantilla.whatsappDefaultTemplateName;
  const hasCustomTemplate = !!plantilla.whatsappTemplateName;
  const hasPending = !!plantilla.whatsappPendingTemplateName;

  // Can send a test message? Only if there's an approved template
  const canSendTest =
    (hasCustomTemplate && plantilla.whatsappTemplateStatus === "APPROVED") ||
    (hasDefaultTemplate && plantilla.whatsappDefaultTemplateStatus === "APPROVED");

  // Template is in review when:
  // - there's a pending template (update of existing custom), OR
  // - the custom template itself has PENDING status (first edit not yet approved)
  const isInReview =
    (hasPending && plantilla.whatsappPendingTemplateStatus === "PENDING") ||
    (hasCustomTemplate && plantilla.whatsappTemplateStatus === "PENDING");

  const statusInfo = getStatusInfo(plantilla);
  const StatusIcon = statusInfo.icon;

  const handleSaveSchedule = async () => {
    setSavingSchedule(true);
    try {
      const body: Record<string, unknown> = {};
      if (showRecordatorioConfig) {
        body.horaEnvioRecordatorio = horaEnvio;
        body.diasAnticipacion = diasAnticipacion;
      } else if (showDigestoConfig) {
        body.horaEnvioDigesto = horaEnvio;
      }

      const res = await fetch("/api/notificaciones/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      toast.success("Horario guardado");
    } catch {
      toast.error("Error al guardar horario");
    } finally {
      setSavingSchedule(false);
    }
  };

  const openPreview = (content: string, canTest: boolean) => {
    setPreviewContent(content);
    setPreviewCanTest(canTest);
    setTestTelefono("");
    setPreviewOpen(true);
  };

  const handleCancelEdit = () => {
    setContenido(plantilla.contenido);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const needsMetaUpdate =
        hasDefaultTemplate &&
        plantilla.contenidoOriginal !== null &&
        contenido !== plantilla.contenidoOriginal &&
        contenido !== plantilla.contenido;

      // TRANSACTIONAL FLOW:
      // 1. If content needs Meta template update -> call Meta first
      // 2. If Meta succeeds -> save to DB (in contenidoEnRevision, NOT contenido)
      // 3. If Meta fails -> don't save anything

      if (needsMetaUpdate) {
        // Call Meta first with new content
        const metaRes = await fetch(
          `/api/notificaciones/plantillas/${plantilla.id}/meta`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contenido }),
          }
        );
        const metaData = await metaRes.json();

        if (!metaRes.ok) {
          toast.error(
            metaData.error || "Error al enviar template a WhatsApp. No se guardaron los cambios."
          );
          return;
        }

        // Meta succeeded, now save edited content to contenidoEnRevision
        const dbRes = await fetch(
          `/api/notificaciones/plantillas/${plantilla.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contenido,
              target: "contenidoEnRevision",
            }),
          }
        );
        if (!dbRes.ok) {
          toast.error("Template creado en WhatsApp pero error al guardar en la base de datos");
          return;
        }

        setPlantilla((p) => ({
          ...p,
          ...metaData,
          contenidoEnRevision: contenido,
        }));
        toast.success(
          "Guardado. Tu nueva versión está en revisión por WhatsApp."
        );
        router.refresh();
        return;
      }

      // If content matches original and has custom template, delete custom + reset contenido
      if (
        hasDefaultTemplate &&
        plantilla.contenidoOriginal &&
        contenido === plantilla.contenidoOriginal &&
        hasCustomTemplate
      ) {
        await fetch(
          `/api/notificaciones/plantillas/${plantilla.id}/meta`,
          { method: "DELETE" }
        ).catch(() => {});

        await fetch(
          `/api/notificaciones/plantillas/${plantilla.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contenido }),
          }
        );

        setPlantilla((p) => ({
          ...p,
          contenido,
          whatsappTemplateName: null,
          whatsappTemplateStatus: null,
          whatsappPendingTemplateName: null,
          whatsappPendingTemplateStatus: null,
        }));

        toast.success("Revertido al mensaje original");
        router.refresh();
        return;
      }

      // No Meta update needed - just save content to DB
      const res = await fetch(
        `/api/notificaciones/plantillas/${plantilla.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contenido }),
        }
      );
      if (!res.ok) throw new Error("Error al guardar");

      setPlantilla((p) => ({ ...p, contenido }));
      toast.success("Guardado correctamente");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al guardar"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (value: boolean) => {
    setPlantilla((p) => ({ ...p, activa: value }));
    try {
      const res = await fetch(
        `/api/notificaciones/plantillas/${plantilla.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            activa: value,
            contenido: plantilla.contenido,
          }),
        }
      );
      if (!res.ok) throw new Error();
      toast.success(
        value ? "Notificación activada" : "Notificación desactivada"
      );
    } catch {
      setPlantilla((p) => ({ ...p, activa: !value }));
      toast.error("Error al actualizar");
    }
  };

  const handleCancelReview = async () => {
    setCancelling(true);
    try {
      const res = await fetch(
        `/api/notificaciones/plantillas/${plantilla.id}/cancel-pending`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cancelar revisión");

      setPlantilla((p) => ({ ...p, ...data }));
      toast.success("Revisión cancelada. Ya puedes editar el mensaje.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cancelar");
    } finally {
      setCancelling(false);
    }
  };

  const handleRevert = async () => {
    if (!plantilla.contenidoOriginal) return;
    setReverting(true);
    try {
      setContenido(plantilla.contenidoOriginal);

      const res = await fetch(
        `/api/notificaciones/plantillas/${plantilla.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contenido: plantilla.contenidoOriginal }),
        }
      );
      if (!res.ok) throw new Error();

      if (hasCustomTemplate || hasPending) {
        await fetch(
          `/api/notificaciones/plantillas/${plantilla.id}/meta`,
          { method: "DELETE" }
        ).catch(() => {});
      }

      setPlantilla((p) => ({
        ...p,
        contenido: plantilla.contenidoOriginal!,
        whatsappTemplateName: null,
        whatsappTemplateStatus: null,
        whatsappPendingTemplateName: null,
        whatsappPendingTemplateStatus: null,
      }));

      toast.success("Revertido al mensaje original");
      router.refresh();
    } catch {
      toast.error("Error al revertir");
    } finally {
      setReverting(false);
    }
  };

  const handleTest = async () => {
    if (!testTelefono) {
      toast.error("Ingresa un número de teléfono");
      return;
    }
    setTestLoading(true);
    try {
      const res = await fetch(
        `/api/notificaciones/plantillas/${plantilla.id}/test`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ telefono: testTelefono }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al enviar prueba");
      toast.success("Mensaje de prueba enviado");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al enviar"
      );
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{plantilla.nombre}</h2>
        <div className="flex items-center gap-3">
          <Label htmlFor="activa-toggle" className="text-sm">
            {plantilla.activa ? "Activa" : "Inactiva"}
          </Label>
          <Switch
            id="activa-toggle"
            checked={plantilla.activa}
            onCheckedChange={handleToggle}
          />
        </div>
      </div>

      {/* Status */}
      <Card>
        <CardContent className="flex items-start gap-3 py-4">
          <StatusIcon className={`h-5 w-5 mt-0.5 shrink-0 ${statusInfo.iconClass}`} />
          <div className="space-y-1">
            <p className="text-sm font-medium">{statusInfo.title}</p>
            <p className="text-sm text-muted-foreground">
              {statusInfo.description}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* In Review: Show dual view (active vs in-review) */}
      {isInReview ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Active message */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <CardTitle className="text-sm">Mensaje en uso</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Versión aprobada que se está enviando actualmente.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm whitespace-pre-line bg-muted/50 p-3 rounded-md mb-3 max-h-32 overflow-y-auto">
                  {plantilla.contenido}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openPreview(plantilla.contenido, canSendTest)}
                >
                  <Eye className="mr-1.5 h-3.5 w-3.5" />
                  Vista previa
                </Button>
              </CardContent>
            </Card>

            {/* In-review message */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500" />
                  <CardTitle className="text-sm">Mensaje en revisión</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  WhatsApp está revisando esta nueva versión.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm whitespace-pre-line bg-muted/50 p-3 rounded-md mb-3 max-h-32 overflow-y-auto">
                  {plantilla.contenidoEnRevision || ""}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    openPreview(plantilla.contenidoEnRevision || "", false)
                  }
                >
                  <Eye className="mr-1.5 h-3.5 w-3.5" />
                  Vista previa
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={handleCancelReview}
              disabled={cancelling}
            >
              <Ban className="mr-1.5 h-3.5 w-3.5" />
              {cancelling ? "Cancelando..." : "Cancelar revisión"}
            </Button>
            <span className="text-xs text-muted-foreground">
              Cancelar la revisión te permitirá editar nuevamente.
            </span>
          </div>
        </div>
      ) : (
        /* Not in review: normal editor */
        <div className="space-y-3">
          <Label>Contenido del mensaje</Label>
          <WhatsAppEditor
            content={contenido}
            onChange={setContenido}
            variables={plantilla.variables}
          />
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={handleSave}
              disabled={saving || !hasContentChanges}
            >
              {saving ? "Guardando..." : "Guardar"}
            </Button>

            {hasContentChanges ? (
              <Button
                variant="outline"
                onClick={handleCancelEdit}
                disabled={saving}
              >
                Cancelar
              </Button>
            ) : (
              isSavedCustomized && (
                <Button
                  variant="outline"
                  onClick={handleRevert}
                  disabled={reverting}
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  {reverting ? "Revirtiendo..." : "Revertir al original"}
                </Button>
              )
            )}

            <Button
              variant="outline"
              onClick={() => openPreview(contenido, canSendTest)}
            >
              <Eye className="mr-1.5 h-3.5 w-3.5" />
              Vista previa
            </Button>

            {hasContentChanges && (
              <span className="text-xs text-amber-500">
                Cambios sin guardar
              </span>
            )}
          </div>
        </div>
      )}

      {/* Schedule Config */}
      {showScheduleConfig && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Horario de envío</CardTitle>
            <CardDescription>
              {showRecordatorioConfig
                ? "Configura cuándo se envían los recordatorios a los clientes"
                : "Configura cuándo se envía el resumen diario"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hora-envio">Hora de envío (Ecuador)</Label>
                <Input
                  id="hora-envio"
                  type="time"
                  value={horaEnvio}
                  onChange={(e) => setHoraEnvio(e.target.value)}
                />
              </div>

              {showRecordatorioConfig && (
                <div className="space-y-2">
                  <Label htmlFor="dias-anticipacion">
                    Días de anticipación
                  </Label>
                  <Input
                    id="dias-anticipacion"
                    type="number"
                    min={1}
                    max={7}
                    value={diasAnticipacion}
                    onChange={(e) =>
                      setDiasAnticipacion(parseInt(e.target.value) || 1)
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Cuántos días antes de la visita se envía el recordatorio
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={handleSaveSchedule}
                disabled={savingSchedule}
                size="sm"
              >
                {savingSchedule ? "Guardando..." : "Guardar horario"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Vista previa</DialogTitle>
            <DialogDescription>
              Así se verá el mensaje en WhatsApp (con valores de ejemplo).
            </DialogDescription>
          </DialogHeader>

          <WhatsAppPreview content={previewContent} />

          {previewCanTest && (
            <div className="space-y-3 pt-2 border-t">
              <Label className="text-sm font-medium">Enviar prueba</Label>
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="test-phone-dialog" className="text-xs">
                    Número de teléfono
                  </Label>
                  <Input
                    id="test-phone-dialog"
                    value={testTelefono}
                    onChange={(e) => setTestTelefono(e.target.value)}
                    placeholder="09XXXXXXXX"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={handleTest}
                  disabled={testLoading}
                >
                  <Send className="mr-2 h-4 w-4" />
                  {testLoading ? "Enviando..." : "Enviar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
