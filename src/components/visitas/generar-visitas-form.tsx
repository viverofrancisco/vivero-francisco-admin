"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

interface GenerarVisitasFormProps {
  open: boolean;
  onClose: () => void;
}

export function GenerarVisitasForm({ open, onClose }: GenerarVisitasFormProps) {
  const router = useRouter();
  const now = new Date();
  const [mes, setMes] = useState(String(now.getMonth() + 1));
  const [anio, setAnio] = useState(String(now.getFullYear()));
  const [loading, setLoading] = useState(false);

  const handleGenerar = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/visitas/generar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes: parseInt(mes), anio: parseInt(anio) }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Error al generar");
      }

      const result = await res.json();
      toast.success(
        `${result.creadas} visitas creadas, ${result.omitidas} omitidas`
      );
      onClose();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al generar");
    } finally {
      setLoading(false);
    }
  };

  const anioActual = now.getFullYear();
  const anios = [anioActual, anioActual + 1];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Generar Visitas del Mes</DialogTitle>
          <DialogDescription>
            Genera visitas automáticamente para todos los servicios activos del mes seleccionado.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 grid-cols-2">
            <div className="space-y-2">
              <Label>Mes</Label>
              <Select value={mes} onValueChange={(v) => v && setMes(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESES.map((nombre, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      {nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Año</Label>
              <Select value={anio} onValueChange={(v) => v && setAnio(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {anios.map((a) => (
                    <SelectItem key={a} value={String(a)}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-4 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleGenerar} disabled={loading}>
              {loading ? "Generando..." : "Generar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
