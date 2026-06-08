"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { grupoSchema, type GrupoFormData } from "@/lib/validations/grupo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { StickyFormActions } from "@/components/shared/sticky-form-actions";
import { PersonalSelector } from "./personal-selector";
import { toast } from "sonner";

interface PersonalOption {
  id: string;
  nombre: string;
}

interface GrupoFormProps {
  personalList: PersonalOption[];
  initialData?: {
    id: string;
    nombre: string;
    descripcion: string | null;
    miembrosIds: string[];
  };
}

export function GrupoForm({ personalList, initialData }: GrupoFormProps) {
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
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="mx-auto max-w-2xl space-y-5 pb-24">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEditing ? "Editar grupo" : "Nuevo grupo"}
          </h1>
          <p className="text-muted-foreground">
            Nombre, descripción y miembros de la cuadrilla.
          </p>
        </div>
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input id="nombre" {...register("nombre")} />
              {errors.nombre && (
                <p className="text-sm text-destructive">{errors.nombre.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Textarea id="descripcion" rows={4} {...register("descripcion")} />
            </div>

            <div className="space-y-2">
              <Label>Miembros del grupo</Label>
              <PersonalSelector
                personalList={personalList}
                selectedIds={selectedIds}
                onChange={(ids) => setValue("miembrosIds", ids)}
              />
              <p className="text-xs text-muted-foreground">
                {selectedIds.length} personal seleccionado(s)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <StickyFormActions
        saveLabel={isEditing ? "Guardar cambios" : "Crear grupo"}
        saving={loading}
        onCancel={() => router.push("/dashboard/grupos")}
      />
    </form>
  );
}
