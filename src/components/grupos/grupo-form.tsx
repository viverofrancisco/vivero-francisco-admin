"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { grupoSchema, type GrupoFormData } from "@/lib/validations/grupo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JardineroSelector } from "./jardinero-selector";
import { toast } from "sonner";

interface JardineroOption {
  id: string;
  nombre: string;
}

interface GrupoFormProps {
  jardineros: JardineroOption[];
  initialData?: {
    id: string;
    nombre: string;
    descripcion: string | null;
    miembrosIds: string[];
  };
}

export function GrupoForm({ jardineros, initialData }: GrupoFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isEditing = !!initialData;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<GrupoFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(grupoSchema) as any,
    defaultValues: {
      nombre: initialData?.nombre ?? "",
      descripcion: initialData?.descripcion ?? "",
      miembrosIds: initialData?.miembrosIds ?? [],
    },
  });

  const selectedIds = watch("miembrosIds");

  const onSubmit = async (data: GrupoFormData) => {
    setLoading(true);
    try {
      const url = isEditing
        ? `/api/grupos/${initialData.id}`
        : "/api/grupos";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Error al guardar");

      toast.success(isEditing ? "Grupo actualizado" : "Grupo creado");
      router.push("/dashboard/grupos");
      router.refresh();
    } catch {
      toast.error("Error al guardar el grupo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{isEditing ? "Editar Grupo" : "Nuevo Grupo"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre *</Label>
            <Input id="nombre" {...register("nombre")} />
            {errors.nombre && (
              <p className="text-sm text-red-600">{errors.nombre.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <Textarea id="descripcion" rows={4} {...register("descripcion")} />
          </div>

          <div className="space-y-2">
            <Label>Miembros del grupo</Label>
            <JardineroSelector
              jardineros={jardineros}
              selectedIds={selectedIds}
              onChange={(ids) => setValue("miembrosIds", ids)}
            />
            <p className="text-xs text-gray-500">
              {selectedIds.length} jardinero(s) seleccionado(s)
            </p>
          </div>

          <div className="flex gap-4">
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : "Guardar"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard/grupos")}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
