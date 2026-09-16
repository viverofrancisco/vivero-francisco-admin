"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { CustomSelect } from "@/components/ui/custom-select";
import { TarjetaSeccion } from "@/components/shared/tarjeta-seccion";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Trash2 } from "lucide-react";
import { CIUDADES_ECUADOR } from "@/lib/constants/ciudades-ecuador";
import { propiedadSchema, type PropiedadFormData } from "@/lib/validations/cliente";

/**
 * Leaflet toca `window` al importarse, así que no puede renderizarse en el
 * servidor.
 */
const MapaPropiedad = dynamic(
  () => import("./mapa-propiedad").then((m) => m.MapaPropiedad),
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-xl bg-muted" /> }
);

export interface PropiedadEditable {
  id: string;
  nombre: string;
  ciudad: string | null;
  sectorId: string | null;
  direccion: string | null;
  numeroCasa: string | null;
  referencia: string | null;
  notas: string | null;
  lat: number | null;
  lng: number | null;
  m2Total: number | null;
  jardinerasPlantaAlta: boolean;
  numeroArboles: number | null;
  mlVegetacionBaja: number | null;
  mlVegetacionMedia: number | null;
  mlVegetacionAlta: number | null;
  m2Cesped: number | null;
  visitas: number;
}

/**
 * Una propiedad, en su propia página.
 *
 * Empezó como un diálogo y no entraba: el mapa pide alto de verdad —no se
 * elige un punto en una tira de 200 px—, y detrás vienen la dirección, siete
 * medidas y las notas. Un diálogo con scroll interno adentro de una página que
 * también scrollea es dos scrolls compitiendo, y el mapa se come la rueda del
 * mouse en el medio.
 *
 * Usa el mismo esquema que la ficha de la visita: encabezado con el título y
 * las acciones, dos columnas 1.6/1, y tarjetas con el título en negrita sin
 * línea. Dos fichas del portal no deberían tener dos formas de verse.
 */
export function PropiedadPage({
  clienteId,
  clienteNombre,
  propiedad,
  sectores,
  backHref,
}: {
  clienteId: string;
  clienteNombre: string;
  /** `null` = una nueva. */
  propiedad: PropiedadEditable | null;
  sectores: { id: string; nombre: string }[];
  backHref: string;
}) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PropiedadFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(propiedadSchema as any) as any,
    defaultValues: {
      nombre: propiedad?.nombre ?? "Principal",
      ciudad: propiedad?.ciudad ?? "",
      sectorId: propiedad?.sectorId ?? "",
      direccion: propiedad?.direccion ?? "",
      numeroCasa: propiedad?.numeroCasa ?? "",
      referencia: propiedad?.referencia ?? "",
      notas: propiedad?.notas ?? "",
      lat: propiedad?.lat ?? null,
      lng: propiedad?.lng ?? null,
      m2Total: propiedad?.m2Total ?? undefined,
      jardinerasPlantaAlta: propiedad?.jardinerasPlantaAlta ?? false,
      numeroArboles: propiedad?.numeroArboles ?? undefined,
      mlVegetacionBaja: propiedad?.mlVegetacionBaja ?? undefined,
      mlVegetacionMedia: propiedad?.mlVegetacionMedia ?? undefined,
      mlVegetacionAlta: propiedad?.mlVegetacionAlta ?? undefined,
      m2Cesped: propiedad?.m2Cesped ?? undefined,
    },
  });

  const lat = watch("lat");
  const lng = watch("lng");

  const onSubmit = async (data: PropiedadFormData) => {
    setGuardando(true);
    try {
      const url = propiedad
        ? `/api/clientes/${clienteId}/propiedades/${propiedad.id}`
        : `/api/clientes/${clienteId}/propiedades`;
      const res = await fetch(url, {
        method: propiedad ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const datos = await res.json().catch(() => null);
      if (!res.ok) throw new Error(datos?.error ?? "No pudimos guardar");
      toast.success(propiedad ? "Propiedad actualizada" : "Propiedad agregada");
      router.push(backHref);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos guardar");
      setGuardando(false);
    }
  };

  async function eliminar() {
    if (!propiedad) return;
    setBorrando(true);
    try {
      const res = await fetch(
        `/api/clientes/${clienteId}/propiedades/${propiedad.id}`,
        { method: "DELETE" }
      );
      const datos = await res.json().catch(() => null);
      if (!res.ok) throw new Error(datos?.error ?? "No pudimos eliminarla");
      toast.success("Propiedad eliminada");
      router.push(backHref);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos eliminarla");
      setBorrando(false);
      setConfirmando(false);
    }
  }

  /** Un número con su unidad adentro del campo. */
  const numero = (
    id: keyof PropiedadFormData,
    etiqueta: string,
    sufijo: string
  ) => (
    <div className="space-y-2">
      <Label htmlFor={id}>{etiqueta}</Label>
      <div className="relative">
        <Input id={id} type="number" step="0.1" min="0" {...register(id)} />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {sufijo}
        </span>
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-4 md:p-6">
      {/* El encabezado de la ficha de visita: título con sus acciones, nada
          más. Guardar y Cancelar viven acá para que estén siempre a la vista
          —la página es larga y el mapa se lleva media pantalla—. */}
      <div className="mb-[22px] flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link href={backHref}>
            <Button type="button" variant="ghost" size="icon" className="-ml-2 flex-none">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-extrabold tracking-[-0.02em]">
              {propiedad ? propiedad.nombre : "Nueva propiedad"}
            </h1>
            <p className="truncate text-sm font-semibold text-ink-2">
              {clienteNombre}
            </p>
          </div>
        </div>

        <div className="flex flex-none items-center gap-2">
          <Link href={backHref}>
            <Button type="button" variant="outline" disabled={guardando}>
              Cancelar
            </Button>
          </Link>
          <Button type="submit" disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar"}
          </Button>
          {propiedad && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              aria-label="Eliminar propiedad"
              title="Eliminar propiedad"
              onClick={() => setConfirmando(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-[18px]">
          <TarjetaSeccion titulo="Dónde está">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="nombre">Nombre</Label>
                <Input
                  id="nombre"
                  placeholder="Casa, Oficina, Villa…"
                  {...register("nombre")}
                />
                <p className="text-xs text-muted-foreground">
                  Para distinguirla si el cliente tiene más de una.
                </p>
                {errors.nombre && (
                  <p className="text-sm text-destructive">{errors.nombre.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Ciudad</Label>
                <Controller
                  name="ciudad"
                  control={control}
                  render={({ field }) => (
                    <CustomSelect
                      value={field.value}
                      onChange={field.onChange}
                      options={CIUDADES_ECUADOR.map((c) => ({ value: c, label: c }))}
                      placeholder="Seleccionar ciudad"
                      searchable
                      searchPlaceholder="Buscar ciudad..."
                      clearable
                    />
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label>Sector</Label>
                <Controller
                  name="sectorId"
                  control={control}
                  render={({ field }) => (
                    <CustomSelect
                      value={field.value}
                      onChange={field.onChange}
                      options={sectores.map((s) => ({ value: s.id, label: s.nombre }))}
                      placeholder="Sin sector"
                      searchable
                      searchPlaceholder="Buscar sector..."
                      clearable
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
                <Input id="numeroCasa" placeholder="Ej: N45-123" {...register("numeroCasa")} />
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
            </div>
          </TarjetaSeccion>

          {/* El punto exacto: la dirección escrita no alcanza para encontrar
              una casa adentro de una urbanización. */}
          <TarjetaSeccion titulo="En el mapa">
            <MapaPropiedad
              lat={lat ?? null}
              lng={lng ?? null}
              onCambio={(punto) => {
                setValue("lat", punto?.lat ?? null, { shouldDirty: true });
                setValue("lng", punto?.lng ?? null, { shouldDirty: true });
              }}
            />
          </TarjetaSeccion>

          <TarjetaSeccion titulo="Qué hay que mantener">
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Es con lo que se cotiza. Todo opcional: se completa a medida que
                alguien lo mide.
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                {numero("m2Total", "Total", "m²")}
                {numero("m2Cesped", "Césped", "m²")}
                {numero("numeroArboles", "Árboles", "u")}
                {numero("mlVegetacionBaja", "Vegetación baja", "ml")}
                {numero("mlVegetacionMedia", "Vegetación media", "ml")}
                {numero("mlVegetacionAlta", "Vegetación alta", "ml")}
              </div>
              <Controller
                name="jardinerasPlantaAlta"
                control={control}
                render={({ field }) => (
                  <label className="flex items-center gap-3 rounded-xl border p-3">
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">
                        Jardineras en planta alta
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        Cambia cómo se sube el material y las herramientas.
                      </span>
                    </span>
                  </label>
                )}
              />
            </div>
          </TarjetaSeccion>
        </div>

        <div className="flex flex-col gap-[18px]">
          {/* De quién es, en verde: es lo que ubica esta página, igual que en
              la ficha de la visita. */}
          <Card className="gap-0 rounded-2xl border-transparent bg-linear-135 from-green-deep to-green-700 py-0 text-white">
            <CardContent className="p-5">
              <p className="text-[12.5px] font-bold tracking-[0.04em] text-white/75">
                CLIENTE
              </p>
              <Link
                href={`/dashboard/clientes/${clienteId}`}
                className="mt-1.5 block truncate text-[15.5px] font-extrabold hover:underline"
              >
                {clienteNombre}
              </Link>
              {propiedad && (
                <p className="mt-1 text-[12.5px] font-semibold text-white/75">
                  {propiedad.visitas === 0
                    ? "Sin visitas todavía"
                    : `${propiedad.visitas} visita${
                        propiedad.visitas === 1 ? "" : "s"
                      } acá`}
                </p>
              )}
            </CardContent>
          </Card>

          <TarjetaSeccion titulo="Notas">
            <Textarea
              id="notas"
              rows={6}
              placeholder="Perro suelto, portón que se traba, dónde está la llave de agua…"
              {...register("notas")}
            />
          </TarjetaSeccion>
        </div>
      </div>

      <Dialog open={confirmando} onOpenChange={(v) => !v && setConfirmando(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar {propiedad?.nombre}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {propiedad && propiedad.visitas > 0
              ? `Esta propiedad tiene ${propiedad.visitas} visita${
                  propiedad.visitas === 1 ? "" : "s"
                }: esas visitas pasaron acá, así que no se puede eliminar. Si ya no se trabaja en ella, deja de agendarla.`
              : "Deja de aparecer al agendar. No se puede deshacer desde el portal."}
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmando(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={borrando || (propiedad?.visitas ?? 0) > 0}
              onClick={eliminar}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
