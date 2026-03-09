"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { clienteSchema, type ClienteFormData } from "@/lib/validations/cliente";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { CIUDADES_ECUADOR } from "@/lib/constants/ciudades-ecuador";

interface ClienteFormProps {
  initialData?: {
    id: string;
    nombre: string;
    email: string | null;
    telefono: string | null;
    ciudad: string | null;
    direccion: string | null;
    numeroCasa: string | null;
    referencia: string | null;
    notas: string | null;
  };
}

export function ClienteForm({ initialData }: ClienteFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isEditing = !!initialData;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ClienteFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(clienteSchema) as any,
    defaultValues: {
      nombre: initialData?.nombre ?? "",
      email: initialData?.email ?? "",
      telefono: initialData?.telefono ?? "",
      ciudad: initialData?.ciudad ?? "",
      direccion: initialData?.direccion ?? "",
      numeroCasa: initialData?.numeroCasa ?? "",
      referencia: initialData?.referencia ?? "",
      notas: initialData?.notas ?? "",
    },
  });

  const onSubmit = async (data: ClienteFormData) => {
    setLoading(true);
    try {
      const url = isEditing
        ? `/api/clientes/${initialData.id}`
        : "/api/clientes";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        throw new Error("Error al guardar");
      }

      toast.success(
        isEditing ? "Cliente actualizado" : "Cliente creado"
      );
      router.push("/dashboard/clientes");
      router.refresh();
    } catch {
      toast.error("Error al guardar el cliente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>
          {isEditing ? "Editar Cliente" : "Nuevo Cliente"}
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
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && (
                <p className="text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>
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
              {errors.telefono && (
                <p className="text-sm text-red-600">{errors.telefono.message}</p>
              )}
            </div>
          </div>

          <Separator />
          <p className="text-sm font-medium text-gray-500">Ubicación</p>

          <div className="space-y-2">
            <Label>Ciudad</Label>
            <Controller
              name="ciudad"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(v) => field.onChange(v ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar ciudad" />
                  </SelectTrigger>
                  <SelectContent>
                    {CIUDADES_ECUADOR.map((ciudad) => (
                      <SelectItem key={ciudad} value={ciudad}>
                        {ciudad}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="direccion">Dirección</Label>
              <Input
                id="direccion"
                placeholder="Calle principal e intersección"
                {...register("direccion")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="numeroCasa">Número de casa</Label>
              <Input
                id="numeroCasa"
                placeholder="Ej: N45-123"
                {...register("numeroCasa")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="referencia">Referencia</Label>
            <Textarea
              id="referencia"
              rows={3}
              placeholder="Ej: Frente al parque, casa blanca con portón verde"
              {...register("referencia")}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="notas">Notas</Label>
            <Textarea id="notas" rows={4} {...register("notas")} />
          </div>

          <div className="flex gap-4">
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : "Guardar"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard/clientes")}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
