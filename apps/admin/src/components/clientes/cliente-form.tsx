"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  clienteConPropiedadSchema,
  type ClienteConPropiedadFormData,
} from "@/lib/validations/cliente";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/ui/phone-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TarjetaSeccion } from "@/components/shared/tarjeta-seccion";
import { StickyFormActions } from "@/components/shared/sticky-form-actions";
import { toast } from "sonner";
import {
  DondeEsta,
  EnElMapa,
  NotasDePropiedad,
  QueHayQueMantener,
  type SectorElegible,
} from "./campos-de-propiedad";

interface ClienteFormProps {
  initialData?: {
    id: string;
    nombre: string;
    apellido: string | null;
    empresa: string | null;
    email: string | null;
    telefono: string | null;

    notas: string | null;
  };
  /** Para el selector de sector de la primera propiedad. Solo al crear. */
  sectores?: SectorElegible[];
  onSuccess?: () => void;
  compact?: boolean;
  /**
   * Modo tarjetas: General, Ubicacion y Notas como tarjetas separadas dentro de
   * una grilla de 3 columnas. La actividad ocupa 2 y los datos 1.
   * La edición se controla desde afuera con `cardsEditing`.
   */
  cards?: boolean;
  cardsEditing?: boolean;
  onEditDone?: () => void;
  /**
   * Propiedades, órdenes, suscripciones y visitas. Va en la columna ancha: es
   * lo que se mira, mientras que los datos del cliente son referencia.
   */
  actividadContent?: React.ReactNode;
  /** Debajo de los datos, en la columna angosta. */
  rightColumnContent?: React.ReactNode;
  /**
   * Filas de Información General que en el escritorio viven en el
   * encabezado —el estado, el sector, desde cuándo— y en el teléfono, donde el
   * encabezado es solo el nombre, van con el resto de los datos.
   */
  filasSoloMovil?: { label: string; value: React.ReactNode }[];
}

/**
 * La primera propiedad arranca vacía, con cada campo en su valor "sin cargar":
 * `""` para el texto (un `undefined` deja el input sin controlar y el mapa sin
 * qué leer), `null` para el punto y `false` para las jardineras.
 */
const PROPIEDAD_VACIA: ClienteConPropiedadFormData["propiedad"] = {
  nombre: "",
  ciudad: "",
  sectorId: "",
  direccion: "",
  numeroCasa: "",
  referencia: "",
  notas: "",
  lat: null,
  lng: null,
  jardinerasPlantaAlta: false,
};

function InfoRow({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 py-2.5 border-b border-border last:border-0 ${className ?? ""}`}
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value || "—"}</span>
    </div>
  );
}

export function ClienteForm({
  initialData,
  sectores = [],
  onSuccess,
  compact,
  cards,
  cardsEditing,
  onEditDone,
  actividadContent,
  rightColumnContent,
  filasSoloMovil = [],
}: ClienteFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isEditing = !!initialData;

  /*
   * El mismo formulario para crear y para editar, con la primera propiedad
   * adentro.
   *
   * Crear un cliente sin ningún lugar donde trabajar deja algo que no sirve
   * para agendar, y pedirlo en dos pasos es garantizar que alguien se olvide
   * del segundo. Editando, esos campos no se dibujan —cada propiedad se toca
   * en su propia tarjeta— así que viajan en `undefined` y el PUT los ignora.
   */
  const form = useForm<ClienteConPropiedadFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(clienteConPropiedadSchema as any) as any,
    defaultValues: {
      nombre: initialData?.nombre ?? "",
      apellido: initialData?.apellido ?? "",
      empresa: initialData?.empresa ?? "",
      email: initialData?.email ?? "",
      telefono: initialData?.telefono ?? "",
      notas: initialData?.notas ?? "",
      ...(isEditing ? {} : { propiedad: PROPIEDAD_VACIA }),
    },
  });
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = form;

  // Reset form when leaving edit mode externally (header cancel)
  const prevEditing = useRef(cardsEditing);
  useEffect(() => {
    if (prevEditing.current && !cardsEditing && initialData) {
      reset({
        nombre: initialData.nombre ?? "",
        apellido: initialData.apellido ?? "",
        empresa: initialData.empresa ?? "",
        email: initialData.email ?? "",
        telefono: initialData.telefono ?? "",
        notas: initialData.notas ?? "",
      });
    }
    prevEditing.current = cardsEditing;
  }, [cardsEditing, initialData, reset]);

  const onSubmit = async (data: ClienteConPropiedadFormData) => {
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
          {/* Columna ancha: la actividad del cliente, que es lo que se mira. */}
          <div className="lg:col-span-2 space-y-6">{actividadContent}</div>

          {/* Columna angosta: los datos, que son referencia. */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Informacion General</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Primero y solo en el teléfono: así la última fila sigue
                    siendo Telefono en el escritorio y no queda una línea de
                    más. */}
                {filasSoloMovil.map((fila) => (
                  <InfoRow
                    key={fila.label}
                    label={fila.label}
                    value={fila.value}
                    className="md:hidden"
                  />
                ))}
                <InfoRow label="Nombre" value={initialData?.nombre} />
                <InfoRow label="Apellido" value={initialData?.apellido} />
                <InfoRow label="Empresa" value={initialData?.empresa} />
                <InfoRow label="Email" value={initialData?.email} />
                <InfoRow label="Telefono" value={initialData?.telefono} />
              </CardContent>
            </Card>

            {/* La dirección ya no está acá: es de cada propiedad, y la tarjeta
                de Propiedades la muestra con todo lo demás del lugar. */}
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Notas</CardTitle>
              </CardHeader>
              <CardContent>
                {initialData?.notas ? (
                  <p className="text-sm whitespace-pre-wrap">{initialData.notas}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin notas</p>
                )}
              </CardContent>
            </Card>

            {rightColumnContent}
          </div>
        </div>
      );
    }

    // Edit mode: form wraps the entire grid
    return (
      <form id="cliente-cards-form" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna ancha: la actividad del cliente, que es lo que se mira. */}
          <div className="lg:col-span-2 space-y-6">{actividadContent}</div>

          {/* Columna angosta: los datos, que son referencia. */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Informacion General</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="nombre">Nombre</Label>
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
                <div className="space-y-2">
                  <Label htmlFor="empresa">Empresa</Label>
                  <Input
                    id="empresa"
                    placeholder="Nombre de la empresa (opcional)"
                    {...register("empresa")}
                  />
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b">
                <CardTitle>Notas</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  id="notas"
                  rows={4}
                  placeholder="Notas sobre el cliente..."
                  {...register("notas")}
                />
              </CardContent>
            </Card>

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
      <TarjetaSeccion titulo="Datos del cliente">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" {...register("nombre")} />
            {fieldError(errors.nombre?.message)}
          </div>
          <div className="space-y-2">
            <Label htmlFor="apellido">Apellido</Label>
            <Input id="apellido" {...register("apellido")} />
            {fieldError(errors.apellido?.message)}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="empresa">Empresa</Label>
            <Input
              id="empresa"
              placeholder="Nombre de la empresa (opcional)"
              {...register("empresa")}
            />
            {fieldError(errors.empresa?.message)}
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
        </div>
      </TarjetaSeccion>

      {/* La primera propiedad, entera y en el mismo formulario: los mismos
          campos que su propia página —dirección, sector, el punto en el mapa,
          lo que hay que mantener y sus notas—. Pedía la dirección y los metros
          totales y nada más, y la propiedad quedaba a medio cargar hasta que
          alguien la reabría. Después se agregan más desde la ficha del
          cliente, cada una con su página. */}
      {!isEditing && (
        <>
          <DondeEsta
            prefijo="propiedad."
            sectores={sectores}
            titulo="Dónde se trabaja"
            nombreOpcional
          />
          <EnElMapa prefijo="propiedad." />
          <QueHayQueMantener prefijo="propiedad." />
          <NotasDePropiedad prefijo="propiedad." titulo="Notas de la propiedad" />
        </>
      )}

      <TarjetaSeccion titulo={isEditing ? "Notas" : "Notas del cliente"}>
        <Textarea
          id="notas"
          rows={4}
          placeholder="Indicaciones especiales, horarios preferidos, mascotas…"
          {...register("notas")}
        />
      </TarjetaSeccion>
    </div>
  );

  if (compact) {
    return (
      <FormProvider {...form}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {sections}
          <Button type="submit" disabled={loading}>
            {loading ? "Guardando..." : "Guardar"}
          </Button>
        </form>
      </FormProvider>
    );
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="mx-auto max-w-3xl space-y-5 pb-24">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isEditing ? "Editar cliente" : "Nuevo cliente"}
            </h1>
            <p className="text-muted-foreground">
              {isEditing
                ? "Información de contacto y notas del cliente."
                : "Sus datos de contacto y su primera propiedad: dónde se trabaja, el punto en el mapa y lo que hay que mantener."}
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
    </FormProvider>
  );
}
