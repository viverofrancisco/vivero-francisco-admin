"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface WhatsAppToggleProps {
  activo: boolean;
}

export function WhatsAppToggle({ activo: initial }: WhatsAppToggleProps) {
  const [activo, setActivo] = useState(initial);
  const [saving, setSaving] = useState(false);

  const handleToggle = async (value: boolean) => {
    setActivo(value);
    setSaving(true);
    try {
      const res = await fetch("/api/notificaciones/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsappActivo: value }),
      });
      if (!res.ok) throw new Error();
      toast.success(
        value
          ? "Notificaciones de WhatsApp activadas"
          : "Notificaciones de WhatsApp desactivadas"
      );
    } catch {
      setActivo(!value);
      toast.error("Error al actualizar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Switch
        checked={activo}
        onCheckedChange={handleToggle}
        disabled={saving}
      />
      <Label className="text-sm text-muted-foreground cursor-pointer">
        {activo ? "WhatsApp activo" : "WhatsApp inactivo"}
      </Label>
    </div>
  );
}
