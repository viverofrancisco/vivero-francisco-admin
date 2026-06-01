"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

interface Config {
  autoRespuestaActiva: boolean;
  autoRespuestaContenido: string | null;
  forwardActivo: boolean;
  forwardTelefono: string | null;
}

interface MensajesEntrantesConfigProps {
  config: Config;
}

export function MensajesEntrantesConfig({
  config,
}: MensajesEntrantesConfigProps) {
  const [autoRespuestaActiva, setAutoRespuestaActiva] = useState(
    config.autoRespuestaActiva ?? false
  );
  const [autoRespuestaContenido, setAutoRespuestaContenido] = useState(
    config.autoRespuestaContenido ||
      "Hola {{nombre}}, gracias por escribirnos. Para atención personal por favor escríbenos al [número principal]."
  );
  const [forwardActivo, setForwardActivo] = useState(
    config.forwardActivo ?? false
  );
  const [forwardTelefono, setForwardTelefono] = useState(
    config.forwardTelefono || ""
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/notificaciones/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          autoRespuestaActiva,
          autoRespuestaContenido,
          forwardActivo,
          forwardTelefono,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al guardar");
      }
      toast.success("Configuración guardada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const insertVariable = () => {
    setAutoRespuestaContenido((prev) => prev + "{{nombre}}");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Mensajes entrantes</CardTitle>
        <CardDescription>
          Configura qué pasa cuando un cliente escribe al número de WhatsApp
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Auto-reply section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Auto-respuesta</Label>
              <p className="text-xs text-muted-foreground">
                Envía un mensaje automático cuando un cliente escribe
              </p>
            </div>
            <Switch
              checked={autoRespuestaActiva}
              onCheckedChange={setAutoRespuestaActiva}
            />
          </div>

          {autoRespuestaActiva && (
            <div className="space-y-2">
              <Textarea
                value={autoRespuestaContenido}
                onChange={(e) => setAutoRespuestaContenido(e.target.value)}
                rows={4}
                placeholder="Mensaje automático..."
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={insertVariable}
                  className="text-xs bg-muted px-2 py-0.5 rounded-full cursor-pointer hover:bg-muted/80 font-mono"
                >
                  {"{{nombre}}"}
                </button>
                <span className="text-xs text-muted-foreground">
                  Click para insertar el nombre del cliente
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="border-t" />

        {/* Forward section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">
                Notificar a otro número
              </Label>
              <p className="text-xs text-muted-foreground">
                Reenvía los mensajes recibidos a un WhatsApp de atención
              </p>
            </div>
            <Switch
              checked={forwardActivo}
              onCheckedChange={setForwardActivo}
            />
          </div>

          {forwardActivo && (
            <div className="space-y-2">
              <Label htmlFor="forward-phone" className="text-xs">
                Número de WhatsApp
              </Label>
              <Input
                id="forward-phone"
                value={forwardTelefono}
                onChange={(e) => setForwardTelefono(e.target.value)}
                placeholder="09XXXXXXXX"
              />
              <p className="text-xs text-muted-foreground">
                Se envía una notificación a este número cada vez que un cliente
                escribe. Requiere que el template &quot;Notificación de mensaje
                entrante&quot; esté aprobado.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
