"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { clienteSchema, type ClienteFormData } from "@/lib/validations/cliente";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/ui/phone-input";
import { CustomSelect } from "@/components/ui/custom-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StickyFormActions } from "@/components/shared/sticky-form-actions";
import { toast } from "sonner";
import { CIUDADES_ECUADOR } from "@/lib/constants/ciudades-ecuador";

interface ClienteFormProps {
  initialData?: {
    id: string;
    nombre: string;
    apellido: string | null;
    email: string | null;
    telefono: string | null;
    ciudad: string | null;
    direccion: string | null;
    numeroCasa: string | null;
    referencia: string | null;
    notas: string | null;
    metrosCuadrados: number | null;
  };
  onSuccess?: () => void;
  compact?: boolean;
  /**
   * Cards layout mode: renders General, Ubicacion, and Notas as separate cards
   * inside a 3-column grid. General + Ubicacion span 2 cols, Notas spans 1 col.
   * Controlled externally via cardsEditing.
   */
  cards?: boolean;
  cardsEditing?: boolean;
  onEditDone?: () => void;
  /** Extra content to render in the right column (below the notes card) */
  rightColumnContent?: React.ReactNode;
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between py-2.5 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value || "—"}</span>
    </div>
  );
}

export function ClienteForm({
  initialData,
  onSuccess,
  compact,
  cards,
  cardsEditing,
  onEditDone,
  rightColumnContent,
}: ClienteFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isEditing = !!initialData;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<ClienteFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(clienteSchema) as any,
    defaultValues: {
      nombre: initialData?.nombre ?? "",
      apellido: initialData?.apellido ?? "",
      email: initialData?.email ?? "",
      telefono: initialData?.telefono ?? "",
      ciudad: initialData?.ciudad ?? "",
      direccion: initialData?.direccion ?? "",
      numeroCasa: initialData?.numeroCasa ?? "",
      referencia: initialData?.referencia ?? "",
      notas: initialData?.notas ?? "",
      metrosCuadrados: initialData?.metrosCuadrados ?? ("" as unknown as undefined),
    },
  });

  // Reset form when leaving edit mode externally (header cancel)
  const prevEditing = useRef(cardsEditing);
  useEffect(() => {
    if (prevEditing.current && !cardsEditing && initialData) {
      reset({
        nombre: initialData.nombre ?? "",
        apellido: initialData.apellido ?? "",
        email: initialData.email ?? "",
        telefono: initialData.telefono ?? "",
        ciudad: initialData.ciudad ?? "",
        direccion: initialData.direccion ?? "",
        numeroCasa: initialData.numeroCasa ?? "",
        referencia: initialData.referencia ?? "",
        notas: initialData.notas ?? "",
        metrosCuadrados: initialData.metrosCuadrados ?? ("" as unknown as undefined),
      });
    }
    prevEditing.current = cardsEditing;
  }, [cardsEditing, initialData, reset]);

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

      if (cards) {
        reset(data);
        onEditDone?.();
        router.refresh();
      } else if (onSuccess) {
        onSuccess();
        router.refresh();
      } else {
        router.push("/dashboard/clientes");
        router.refresh();
      }
    } catch {
      toast.error("Error al guardar el cliente");
    } finally {
      setLoading(false);
    }
  };

  // --- Cards layout mode ---
  if (cards) {
    if (!cardsEditing) {
      // Read-only: use a plain div grid (no form needed)
      return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Informacion General</CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <InfoRow label="Nombre" value={initialData?.nombre} />
                <InfoRow label="Apellido" value={initialData?.apellido} />
                <InfoRow label="Email" value={initialData?.email} />
                <InfoRow label="Telefono" value={initialData?.telefono} />
                <InfoRow
                  label="Metros cuadrados"
                  value={initialData?.metrosCuadrados ? `${initialData.metrosCuadrados} m²` : null}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b">
                <CardTitle>Ubicacion</CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <InfoRow label="Ciudad" value={initialData?.ciudad} />
                <InfoRow label="Direccion" value={initialData?.direccion} />
                <InfoRow label="Numero de casa" value={initialData?.numeroCasa} />
                <InfoRow label="Referencia" value={initialData?.referencia} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b">
                <CardTitle>Notas</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {initialData?.notas ? (
                  <p className="text-sm whitespace-pre-wrap">{initialData.notas}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin notas</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {rightColumnContent}
          </div>
        </div>
      );
    }

    // Edit mode: form wraps the entire grid
    return (
      <form id="cliente-cards-form" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
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
                      <p className="text-sm text-destructive">{errors.nombre.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apellido">Apellido</Label>
                    <Input id="apellido" {...register("apellido")} />
                    {errors.apellido && (
                      <p className="text-sm text-destructive">{errors.apellido.message}</p>
                    )}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" {...register("email")} />
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email.message}</p>
                    )}
                  </div>
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
                    {errors.telefono && (
                      <p className="text-sm text-destructive">{errors.telefono.message}</p>
                    )}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="metrosCuadrados">Metros cuadrados del jardin</Label>
                    <Input
                      id="metrosCuadrados"
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="Ej: 150"
                      {...register("metrosCuadrados")}
                    />
                    {errors.metrosCuadrados && (
                      <p className="text-sm text-destructive">{errors.metrosCuadrados.message}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b">
                <CardTitle>Ubicacion</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Ciudad</Label>
                    <Controller
                      name="ciudad"
                      control={control}
                      render={({ field }) => (
                        <CustomSelect
                          value={field.value}
                          onChange={field.onChange}
                          options={CIUDADES_ECUADOR.map((ciudad) => ({
                            value: ciudad,
                            label: ciudad,
                          }))}
                          placeholder="Seleccionar ciudad"
                          searchable
                          searchPlaceholder="Buscar ciudad..."
                        />
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="direccion">Direccion</Label>
                    <Input
                      id="direccion"
                      placeholder="Calle principal e interseccion"
                      {...register("direccion")}
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="numeroCasa">Numero de casa</Label>
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
                    rows={2}
                    placeholder="Ej: Frente al parque, casa blanca con porton verde"
                    {...register("referencia")}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b">
                <CardTitle>Notas</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <Textarea
                  id="notas"
                  rows={4}
                  placeholder="Notas sobre el cliente..."
                  {...register("notas")}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {rightColumnContent}
          </div>
        </div>
      </form>
    );
  }

  // --- Standard / compact mode ---
  const fieldError = (msg?: string) =>
    msg ? <p className="text-sm text-destructive">{msg}</p> : null;

  const sections = (
    <div className="space-y-5">
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Datos del cliente</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 pt-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre *</Label>
            <Input id="nombre" {...register("nombre")} />
            {fieldError(errors.nombre?.message)}
          </div>
          <div className="space-y-2">
            <Label htmlFor="apellido">Apellido</Label>
            <Input id="apellido" {...register("apellido")} />
            {fieldError(errors.apellido?.message)}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input id="email" type="email" {...register("email")} />
            {fieldError(errors.email?.message)}
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
            {fieldError(errors.telefono?.message)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Ubicación</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 pt-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Ciudad</Label>
            <Controller
              name="ciudad"
              control={control}
              render={({ field }) => (
                <CustomSelect
                  value={field.value}
                  onChange={field.onChange}
                  options={CIUDADES_ECUADOR.map((ciudad) => ({
                    value: ciudad,
                    label: ciudad,
                  }))}
                  placeholder="Seleccionar ciudad"
                  searchable
                  searchPlaceholder="Buscar ciudad..."
                />
              )}
            />
          </div>
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
          <div className="space-y-2">
            <Label htmlFor="metrosCuadrados">Metros cuadrados del jardín</Label>
            <Input
              id="metrosCuadrados"
              type="number"
              step="0.1"
              min="0"
              placeholder="Ej: 150"
              {...register("metrosCuadrados")}
            />
            {fieldError(errors.metrosCuadrados?.message)}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="referencia">Referencia</Label>
            <Textarea
              id="referencia"
              rows={2}
              placeholder="Ej: Frente al parque, casa blanca con portón verde"
              {...register("referencia")}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Notas</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <Textarea
            id="notas"
            rows={4}
            placeholder="Indicaciones especiales, horarios preferidos, mascotas…"
            {...register("notas")}
          />
        </CardContent>
      </Card>
    </div>
  );

  if (compact) {
    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {sections}
        <Button type="submit" disabled={loading}>
          {loading ? "Guardando..." : "Guardar"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="mx-auto max-w-3xl space-y-5 pb-24">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEditing ? "Editar cliente" : "Nuevo cliente"}
          </h1>
          <p className="text-muted-foreground">
            Información de contacto, ubicación y notas del cliente.
          </p>
        </div>
        {sections}
      </div>

      <StickyFormActions
        saveLabel={isEditing ? "Guardar cambios" : "Crear cliente"}
        saving={loading}
        onCancel={() => router.push("/dashboard/clientes")}
      />
    </form>
  );
}
