"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { personalSchema, type PersonalFormData } from "@/lib/validations/personal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { CustomSelect } from "@/components/ui/custom-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface PersonalFormProps {
  initialData?: {
    id: string;
    nombre: string;
    apellido: string | null;
    telefono: string | null;
    especialidad: string | null;
    tipo: string | null;
    sueldo: number | null;
    estado: string;
  };
  cards?: boolean;
  cardsEditing?: boolean;
  onEditDone?: () => void;
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);

function tipoLabel(tipo: string): string {
  switch (tipo) {
    case "JARDINERO":
      return "Jardinero";
    case "CHOFER":
      return "Chofer";
    case "SUPERVISOR":
      return "Supervisor";
    case "MECANICO":
      return "Mecanico";
    default:
      return tipo;
  }
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value || "—"}</span>
    </div>
  );
}

export function PersonalForm({ initialData, cards, cardsEditing, onEditDone }: PersonalFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isEditing = !!initialData;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<PersonalFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(personalSchema) as any,
    defaultValues: {
      nombre: initialData?.nombre ?? "",
      apellido: initialData?.apellido ?? "",
      telefono: initialData?.telefono ?? "",
      especialidad: initialData?.especialidad ?? "",
      tipo: (initialData?.tipo as "JARDINERO" | "CHOFER" | "SUPERVISOR" | "MECANICO" | "") ?? "",
      sueldo: initialData?.sueldo ?? ("" as unknown as undefined),
      estado: (initialData?.estado as "ACTIVO" | "INACTIVO") ?? "ACTIVO",
    },
  });

  // Reset form when leaving edit mode externally
  const prevEditing = useRef(cardsEditing);
  useEffect(() => {
    if (prevEditing.current && !cardsEditing && initialData) {
      reset({
        nombre: initialData.nombre ?? "",
        apellido: initialData.apellido ?? "",
        telefono: initialData.telefono ?? "",
        especialidad: initialData.especialidad ?? "",
        tipo: (initialData.tipo as "JARDINERO" | "CHOFER" | "SUPERVISOR" | "MECANICO" | "") ?? "",
        sueldo: initialData.sueldo ?? ("" as unknown as undefined),
        estado: (initialData.estado as "ACTIVO" | "INACTIVO") ?? "ACTIVO",
      });
    }
    prevEditing.current = cardsEditing;
  }, [cardsEditing, initialData, reset]);

  const onSubmit = async (data: PersonalFormData) => {
    setLoading(true);
    try {
      const url = isEditing
        ? `/api/personal/${initialData.id}`
        : "/api/personal";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Error al guardar");

      toast.success(isEditing ? "Personal actualizado" : "Personal creado");

      if (cards) {
        reset(data);
        onEditDone?.();
        router.refresh();
      } else {
        router.push("/dashboard/personal");
        router.refresh();
      }
    } catch {
      toast.error("Error al guardar el personal");
    } finally {
      setLoading(false);
    }
  };

  // --- Cards layout mode ---
  if (cards) {
    if (!cardsEditing) {
      return (
        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Informacion General</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <InfoRow label="Nombre" value={initialData?.nombre} />
              <InfoRow label="Apellido" value={initialData?.apellido} />
              <InfoRow label="Telefono" value={initialData?.telefono} />
              <InfoRow label="Especialidad" value={initialData?.especialidad} />
              <InfoRow label="Tipo" value={initialData?.tipo ? tipoLabel(initialData.tipo) : null} />
              <InfoRow
                label="Sueldo"
                value={initialData?.sueldo ? formatPrice(initialData.sueldo) : null}
              />
              <InfoRow
                label="Estado"
                value={initialData?.estado === "ACTIVO" ? "Activo" : "Inactivo"}
              />
            </CardContent>
          </Card>
        </div>
      );
    }

    // Edit mode
    return (
      <form id="personal-cards-form" onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Informacion General</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre *</Label>
                  <Input id="nombre" {...register("nombre")} />
                  {errors.nombre && (
                    <p className="text-sm text-red-600">{errors.nombre.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apellido">Apellido</Label>
                  <Input id="apellido" {...register("apellido")} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="telefono">Telefono</Label>
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
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="especialidad">Especialidad</Label>
                  <Input id="especialidad" {...register("especialidad")} />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Controller
                    name="tipo"
                    control={control}
                    render={({ field }) => (
                      <CustomSelect
                        value={field.value}
                        onChange={field.onChange}
                        options={[
                          { value: "JARDINERO", label: "Jardinero" },
                          { value: "CHOFER", label: "Chofer" },
                          { value: "SUPERVISOR", label: "Supervisor" },
                          { value: "MECANICO", label: "Mecanico" },
                        ]}
                        placeholder="Seleccionar tipo"
                      />
                    )}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sueldo">Sueldo (USD)</Label>
                  <Input
                    id="sueldo"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Ej: 450.00"
                    {...register("sueldo")}
                  />
                  {errors.sueldo && (
                    <p className="text-sm text-red-600">{errors.sueldo.message}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Controller
                  name="estado"
                  control={control}
                  render={({ field }) => (
                    <CustomSelect
                      value={field.value}
                      onChange={field.onChange}
                      options={[
                        { value: "ACTIVO", label: "Activo" },
                        { value: "INACTIVO", label: "Inactivo" },
                      ]}
                    />
                  )}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    );
  }

  // --- Standard mode (create page) ---
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>
          {isEditing ? "Editar Personal" : "Nuevo Personal"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input id="nombre" {...register("nombre")} />
              {errors.nombre && (
                <p className="text-sm text-red-600">{errors.nombre.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="apellido">Apellido</Label>
              <Input id="apellido" {...register("apellido")} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="telefono">Telefono</Label>
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
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="especialidad">Especialidad</Label>
              <Input id="especialidad" {...register("especialidad")} />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Controller
                name="tipo"
                control={control}
                render={({ field }) => (
                  <CustomSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={[
                      { value: "JARDINERO", label: "Jardinero" },
                      { value: "CHOFER", label: "Chofer" },
                      { value: "SUPERVISOR", label: "Supervisor" },
                      { value: "MECANICO", label: "Mecanico" },
                    ]}
                    placeholder="Seleccionar tipo"
                  />
                )}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sueldo">Sueldo (USD)</Label>
              <Input
                id="sueldo"
                type="number"
                step="0.01"
                min="0"
                placeholder="Ej: 450.00"
                {...register("sueldo")}
              />
              {errors.sueldo && (
                <p className="text-sm text-red-600">{errors.sueldo.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Estado</Label>
            <Controller
              name="estado"
              control={control}
              render={({ field }) => (
                <CustomSelect
                  value={field.value}
                  onChange={field.onChange}
                  options={[
                    { value: "ACTIVO", label: "Activo" },
                    { value: "INACTIVO", label: "Inactivo" },
                  ]}
                />
              )}
            />
          </div>

          <div className="flex gap-4">
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : "Guardar"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard/personal")}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
