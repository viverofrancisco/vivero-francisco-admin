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
import { Button } from "@/components/ui/button";
import {
  ContificoSyncDialog,
  type ContificoProducto,
} from "@/components/servicios/contifico-sync-dialog";
import { AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";

/** Cómo queda el producto respecto de Contífico al crearlo. */
type PlanContifico =
  | { modo: "ninguno" }
  | { modo: "vincular"; producto: ContificoProducto; actualizarNombre: boolean }
  | { modo: "crear" };

interface ServicioFormProps {
  initialData?: {
    id: string;
    nombre: string;
    descripcion: string | null;
    tipo: string;
    categoriaId?: string | null;
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
    watch,
    formState: { errors },
  } = useForm<ServicioFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(servicioSchema as any) as any,
    defaultValues: {
      nombre: initialData?.nombre ?? "",
      descripcion: initialData?.descripcion ?? "",
      tipo: (initialData?.tipo as "SERVICIO" | "BIEN") ?? "SERVICIO",
      categoriaId: initialData?.categoriaId ?? null,
    },
  });

  const nombre = watch("nombre");

  // El vínculo con Contífico se elige acá pero se aplica al guardar: todavía no
  // hay id de producto, y el código para crear se deriva de él.
  const [syncOpen, setSyncOpen] = useState(false);
  const [plan, setPlan] = useState<PlanContifico>({ modo: "ninguno" });

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
        body: JSON.stringify({
          ...data,
          ...(isEditing || plan.modo === "ninguno"
            ? {}
            : plan.modo === "crear"
              ? { crearEnContifico: true }
              : {
                  contificoProductoId: plan.producto.id,
                  codigo: plan.producto.codigo,
                  actualizarNombre: plan.actualizarNombre,
                }),
        }),
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
                  : "Define cómo se registra en Contífico."}
              </p>
              {errors.tipo && (
                <p className="text-sm text-destructive">{errors.tipo.message}</p>
              )}
            </div>

            {/* Agrupa el catálogo acá, y de paso decide con qué categoría
                nace en Contífico —que es lo que define en qué cuenta contable
                cae la venta—. Sin categorías creadas no se muestra: sería un
                campo con una sola opción vacía. */}
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

            {/* Sin vínculo con Contífico el producto se guarda igual, pero no
                se puede vender. Vincular acá evita el segundo viaje. */}
            {!isEditing && (
              <div className="space-y-2 border-t pt-4">
                <Label>Contífico</Label>
                {plan.modo === "vincular" ? (
                  <div className="flex items-start justify-between gap-3 rounded-md border p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {plan.producto.nombre}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-mono">{plan.producto.codigo}</span>
                        {plan.actualizarNombre &&
                          ` · se va a renombrar a "${nombre}"`}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setPlan({ modo: "ninguno" })}
                      aria-label="Quitar vínculo"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : plan.modo === "crear" ? (
                  <div className="flex items-start justify-between gap-3 rounded-md border p-3">
                    <p className="text-sm">
                      Se va a crear en Contífico al guardar.
                      <span className="block text-xs text-muted-foreground">
                        No se puede borrar después, solo desactivar.
                      </span>
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setPlan({ modo: "ninguno" })}
                      aria-label="Quitar"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <p className="flex items-start gap-1.5 text-xs text-amber-700">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" />
                      Sin vincular no se puede agregar a una orden ni contratar
                      en una suscripción. Se puede hacer después.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-none"
                      disabled={!nombre?.trim()}
                      onClick={() => setSyncOpen(true)}
                    >
                      Vincular
                    </Button>
                  </div>
                )}
                {!nombre?.trim() && plan.modo === "ninguno" && (
                  <p className="text-xs text-muted-foreground">
                    Escribí el nombre primero: es con lo que se busca.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Montado solo cuando está abierto: así el asistente arranca siempre en
          el primer paso, sin tener que resetearlo a mano. */}
      {!isEditing && syncOpen && (
        <ContificoSyncDialog
          producto={{
            // Todavía no existe: el código se deriva del id al guardar.
            id: null,
            nombre: nombre ?? "",
            descripcion: watch("descripcion") || null,
            tipo: watch("tipo"),
            ivaTasa: null,
          }}
          open={syncOpen}
          onOpenChange={setSyncOpen}
          onElegir={(producto, opciones) => {
            setPlan({
              modo: "vincular",
              producto,
              actualizarNombre: opciones.actualizarNombre,
            });
            setSyncOpen(false);
          }}
          onCrearNuevo={() => {
            setPlan({ modo: "crear" });
            setSyncOpen(false);
          }}
        />
      )}

      <StickyFormActions
        saveLabel={isEditing ? "Guardar cambios" : "Crear producto"}
        saving={loading}
        onCancel={() => router.push("/dashboard/productos")}
      />
    </form>
  );
}
