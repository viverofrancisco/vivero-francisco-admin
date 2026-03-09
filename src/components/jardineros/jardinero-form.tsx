"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { jardineroSchema, type JardineroFormData } from "@/lib/validations/jardinero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface JardineroFormProps {
  initialData?: {
    id: string;
    nombre: string;
    telefono: string | null;
    email: string | null;
    especialidad: string | null;
    disponible: boolean;
  };
}

export function JardineroForm({ initialData }: JardineroFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isEditing = !!initialData;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<JardineroFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(jardineroSchema) as any,
    defaultValues: {
      nombre: initialData?.nombre ?? "",
      telefono: initialData?.telefono ?? "",
      email: initialData?.email ?? "",
      especialidad: initialData?.especialidad ?? "",
      disponible: initialData?.disponible ?? true,
    },
  });

  const disponible = watch("disponible");

  const onSubmit = async (data: JardineroFormData) => {
    setLoading(true);
    try {
      const url = isEditing
        ? `/api/jardineros/${initialData.id}`
        : "/api/jardineros";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Error al guardar");

      toast.success(isEditing ? "Jardinero actualizado" : "Jardinero creado");
      router.push("/dashboard/jardineros");
      router.refresh();
    } catch {
      toast.error("Error al guardar el jardinero");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>
          {isEditing ? "Editar Jardinero" : "Nuevo Jardinero"}
        </CardTitle>
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono</Label>
              <Controller
                name="telefono"
                control={control}
                render={({ field }) => (
                  <PhoneInput
                    id="telefono"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && (
                <p className="text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="especialidad">Especialidad</Label>
            <Input id="especialidad" {...register("especialidad")} />
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="disponible"
              checked={disponible}
              onCheckedChange={(checked) => setValue("disponible", checked)}
            />
            <Label htmlFor="disponible">Disponible</Label>
          </div>

          <div className="flex gap-4">
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : "Guardar"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard/jardineros")}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
