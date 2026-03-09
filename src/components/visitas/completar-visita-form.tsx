"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  completarVisitaSchema,
  type CompletarVisitaFormData,
} from "@/lib/validations/visita";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface CompletarVisitaFormProps {
  visitaId: string;
  open: boolean;
  onClose: () => void;
}

export function CompletarVisitaForm({
  visitaId,
  open,
  onClose,
}: CompletarVisitaFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<CompletarVisitaFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(completarVisitaSchema) as any,
    defaultValues: {
      estado: "COMPLETADA",
      fechaRealizada: new Date().toISOString().split("T")[0],
      notas: "",
      notasIncompleto: "",
      nuevaFechaProgramada: "",
    },
  });

  const estado = watch("estado");

  const onSubmit = async (data: CompletarVisitaFormData) => {
    if (data.estado === "INCOMPLETA" && !data.nuevaFechaProgramada) {
      toast.error("Indica una nueva fecha para reagendar");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/visitas/${visitaId}/completar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Error");
      }

      toast.success(
        data.estado === "COMPLETADA"
          ? "Visita completada"
          : "Visita marcada como incompleta y reagendada"
      );
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Completar Visita</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Resultado *</Label>
            <Controller
              name="estado"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COMPLETADA">Completada</SelectItem>
                    <SelectItem value="INCOMPLETA">Incompleta</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fechaRealizada">Fecha realizada *</Label>
            <Input
              id="fechaRealizada"
              type="date"
              {...register("fechaRealizada")}
            />
            {errors.fechaRealizada && (
              <p className="text-sm text-red-600">{errors.fechaRealizada.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notas">Notas del trabajo</Label>
            <Textarea id="notas" rows={3} {...register("notas")} />
          </div>

          {estado === "INCOMPLETA" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="notasIncompleto">Razón de incompleto *</Label>
                <Textarea
                  id="notasIncompleto"
                  rows={3}
                  placeholder="Explica por qué no se completó..."
                  {...register("notasIncompleto")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nuevaFechaProgramada">
                  Nueva fecha programada *
                </Label>
                <Input
                  id="nuevaFechaProgramada"
                  type="date"
                  {...register("nuevaFechaProgramada")}
                />
              </div>
            </>
          )}

          <div className="flex gap-4 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
