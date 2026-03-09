"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  reagendarVisitaSchema,
  type ReagendarVisitaFormData,
} from "@/lib/validations/visita";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface ReagendarFormProps {
  visitaId: string;
  open: boolean;
  onClose: () => void;
}

export function ReagendarForm({ visitaId, open, onClose }: ReagendarFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReagendarVisitaFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(reagendarVisitaSchema) as any,
    defaultValues: { nuevaFecha: "", notas: "" },
  });

  const onSubmit = async (data: ReagendarVisitaFormData) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/visitas/${visitaId}/reagendar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Error");
      }

      toast.success("Visita reagendada");
      reset();
      onClose();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reagendar Visita</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nuevaFecha">Nueva fecha *</Label>
            <Input id="nuevaFecha" type="date" {...register("nuevaFecha")} />
            {errors.nuevaFecha && (
              <p className="text-sm text-red-600">{errors.nuevaFecha.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notas">Notas</Label>
            <Textarea id="notas" rows={3} {...register("notas")} />
          </div>

          <div className="flex gap-4 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : "Reagendar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
