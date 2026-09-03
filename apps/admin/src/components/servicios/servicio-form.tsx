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
    categoriaId?: string | null;
    codigo?: string | null;
  };
  /** Para agruparlo en el portal. Vacío mientras no haya ninguna creada. */
  categorias?: { id: string; nombre: string }[];
}

export function ServicioForm({ initialData, categorias = [] }: ServicioFormProps) {
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
    resolver: zodResolver(servicioSchema as any) as any,
    defaultValues: {
      nombre: initialData?.nombre ?? "",
      descripcion: initialData?.descripcion ?? "",
      tipo: (initialData?.tipo as "SERVICIO" | "BIEN") ?? "SERVICIO",
      categoriaId: initialData?.categoriaId ?? null,
      codigo: initialData?.codigo ?? null,
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

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Error al guardar");
      }

      toast.success(isEditing ? "Producto actualizado" : "Producto creado");
      router.push("/dashboard/productos");
      router.refresh();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Error al guardar el producto"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="mx-auto max-w-2xl space-y-5 pb-24">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEditing ? "Editar producto" : "Nuevo producto"}
          </h1>
          <p className="text-muted-foreground">
            Nombre, tipo y descripción del producto.
          </p>
        </div>
        <Card>
          <CardContent className="space-y-4">
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
                    disabled={isEditing}
                    options={[
                      { value: "SERVICIO", label: "Servicio (se ejecuta)" },
                      { value: "BIEN", label: "Bien (se despacha)" },
                    ]}
                  />
                )}
              />
              <p className="text-xs text-muted-foreground">
                {isEditing
                  ? "No se puede cambiar: ya hay suscripciones y facturación que dependen de esto."
                  : "Un servicio se ejecuta; un bien se despacha."}
              </p>
              {errors.tipo && (
                <p className="text-sm text-destructive">{errors.tipo.message}</p>
              )}
            </div>

            {/* Sin categorías creadas no se muestra: sería un campo con una
                sola opción vacía. */}
            {categorias.length > 0 && (
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Controller
                  name="categoriaId"
                  control={control}
                  render={({ field }) => (
                    <CustomSelect
                      value={field.value ?? ""}
                      onChange={(v) => field.onChange(v || null)}
                      options={[
                        { value: "", label: "Sin categoría" },
                        ...categorias.map((c) => ({
                          value: c.id,
                          label: c.nombre,
                        })),
                      ]}
                      placeholder="Sin categoría"
                      searchable
                      searchPlaceholder="Buscar categoría..."
                    />
                  )}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Textarea id="descripcion" rows={4} {...register("descripcion")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="codigo">Código</Label>
              <Input
                id="codigo"
                {...register("codigo", {
                  setValueAs: (v) => (typeof v === "string" && v.trim() ? v.trim() : null),
                })}
                placeholder="Ej: MANT-01"
              />
              {/* Es el `codigoPrincipal` de cada detalle del XML. Opcional
                  porque el SRI no lo mira: si falta, se emite con uno derivado
                  del id, que es único igual. */}
              <p className="text-xs text-muted-foreground">
                Sale impreso en la factura. Si lo dejás vacío se usa uno derivado
                del producto.
              </p>
              {errors.codigo && (
                <p className="text-sm text-destructive">{errors.codigo.message}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <StickyFormActions
        saveLabel={isEditing ? "Guardar cambios" : "Crear producto"}
        saving={loading}
        onCancel={() => router.push("/dashboard/productos")}
      />
    </form>
  );
}
