"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
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

  const etiqueta = activo
    ? "WhatsApp activo"
    : "WhatsApp inactivo";

  // Sin el texto al lado: la posición del interruptor ya dice si está prendido,
  // y el rótulo repetía eso en dos renglones justo al lado del título. El
  // nombre accesible se queda —un interruptor sin nombre no se puede anunciar—
  // y en escritorio aparece al pasar el mouse.
  return (
    <Switch
      checked={activo}
      onCheckedChange={handleToggle}
      disabled={saving}
      aria-label={etiqueta}
      title={etiqueta}
      className="flex-none"
    />
  );
}
