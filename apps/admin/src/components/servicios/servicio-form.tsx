"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { servicioSchema, type ServicioFormData } from "@/lib/validations/servicio";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CustomSelect } from "@/components/ui/custom-select";
import { Card, CardContent } from "@/components/ui/card";
import { StickyFormActions } from "@/components/shared/sticky-form-actions";
import { toast } from "sonner";

interface ServicioFormProps {
  initialData?: {
    id: string;
    nombre: string;
    descripcion: string | null;
    tipo: string;
  };
}

export function ServicioForm({ initialData }: ServicioFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isEditing = !!initialData;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ServicioFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(servicioSchema) as any,
    defaultValues: {
      nombre: initialData?.nombre ?? "",
      descripcion: initialData?.descripcion ?? "",
      tipo: (initialData?.tipo as "RECURRENTE" | "UNICO") ?? "UNICO",
    },
  });

  const onSubmit = async (data: ServicioFormData) => {
    setLoading(true);
    try {
      const url = isEditing
        ? `/api/servicios/${initialData.id}`
        : "/api/servicios";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Error al guardar");

      toast.success(isEditing ? "Servicio actualizado" : "Servicio creado");
      router.push("/dashboard/servicios");
      router.refresh();
    } catch {
      toast.error("Error al guardar el servicio");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="mx-auto max-w-2xl space-y-5 pb-24">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEditing ? "Editar servicio" : "Nuevo servicio"}
          </h1>
          <p className="text-muted-foreground">
            Nombre, tipo y descripción del servicio.
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
              <Label>Tipo *</Label>
              <Controller
                name="tipo"
                control={control}
                render={({ field }) => (
                  <CustomSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={[
                      { value: "RECURRENTE", label: "Recurrente (mensual)" },
                      { value: "UNICO", label: "Único (una sola vez)" },
                    ]}
                  />
                )}
              />
              {errors.tipo && (
                <p className="text-sm text-destructive">{errors.tipo.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Textarea id="descripcion" rows={4} {...register("descripcion")} />
            </div>
          </CardContent>
        </Card>
      </div>

      <StickyFormActions
        saveLabel={isEditing ? "Guardar cambios" : "Crear servicio"}
        saving={loading}
        onCancel={() => router.push("/dashboard/servicios")}
      />
    </form>
  );
}
