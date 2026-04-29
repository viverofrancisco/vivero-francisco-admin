"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { visitaSchema, type VisitaFormData } from "@/lib/validations/visita";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CustomSelect } from "@/components/ui/custom-select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface ClienteServicioOption {
  id: string;
  cliente: { nombre: string; apellido?: string | null };
  servicio: { nombre: string; tipo: string };
}

interface GrupoOption {
  id: string;
  nombre: string;
}

interface VisitaFormProps {
  open: boolean;
  onClose: () => void;
  clienteServicios: ClienteServicioOption[];
  grupos: GrupoOption[];
}

export function VisitaForm({
  open,
  onClose,
  clienteServicios,
  grupos,
}: VisitaFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<VisitaFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(visitaSchema) as any,
    defaultValues: {
      clienteServicioId: "",
      fechaProgramada: "",
      grupoId: "",
      notas: "",
    },
  });

  const onSubmit = async (data: VisitaFormData) => {
    setLoading(true);
    try {
      const res = await fetch("/api/visitas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Error al crear");
      }

      toast.success("Visita programada");
      reset();
      onClose();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva Visita</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Servicio asignado *</Label>
            <Controller
              name="clienteServicioId"
              control={control}
              render={({ field }) => (
                <CustomSelect
                  value={field.value}
                  onChange={field.onChange}
                  options={clienteServicios.map((cs) => ({
                    value: cs.id,
                    label: `${cs.cliente.nombre} ${cs.cliente.apellido || ""}`.trim() + " — " + cs.servicio.nombre,
                  }))}
                  placeholder="Seleccionar"
                  searchable
                  searchPlaceholder="Buscar servicio..."
                />
              )}
            />
            {errors.clienteServicioId && (
              <p className="text-sm text-red-600">{errors.clienteServicioId.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="fechaProgramada">Fecha programada *</Label>
            <Input id="fechaProgramada" type="date" {...register("fechaProgramada")} />
            {errors.fechaProgramada && (
              <p className="text-sm text-red-600">{errors.fechaProgramada.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Grupo de personal</Label>
            <Controller
              name="grupoId"
              control={control}
              render={({ field }) => (
                <CustomSelect
                  value={field.value}
                  onChange={field.onChange}
                  options={grupos.map((g) => ({ value: g.id, label: g.nombre }))}
                  placeholder="Sin asignar"
                />
              )}
            />
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
              {loading ? "Guardando..." : "Programar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
