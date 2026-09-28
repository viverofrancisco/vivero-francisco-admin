"use client";

import dynamic from "next/dynamic";
import { Controller, useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { CustomSelect } from "@/components/ui/custom-select";
import { TarjetaSeccion } from "@/components/shared/tarjeta-seccion";
import { CIUDADES_ECUADOR } from "@/lib/constants/ciudades-ecuador";

/**
 * El SDK de Google Maps toca `window` al importarse, así que el mapa no puede
 * renderizarse en el servidor.
 */
const MapaPropiedad = dynamic(
  () => import("./mapa-propiedad").then((m) => m.MapaPropiedad),
  {
    ssr: false,
    // El mismo alto que el mapa: si no, la tarjeta salta cuando termina de
    // cargar.
    loading: () => <div className="h-[450px] animate-pulse rounded-xl bg-muted" />,
  }
);

/**
 * Los campos de una propiedad, para el formulario que los pida.
 *
 * Son los de la página de la propiedad y también los del alta del cliente. El
 * cliente nace con su primera propiedad, y ese formulario pedía la dirección y
 * los metros totales y nada más —ni el sector, ni el punto en el mapa, ni las
 * otras medidas, ni sus notas—, así que la propiedad quedaba a medio cargar y
 * había que reabrirla para terminarla: justo el segundo paso que nacer juntos
 * viene a evitar. Dos listas de los mismos campos son dos listas que se
 * separan; ahora hay una, y cada formulario la arma en su propia disposición
 * (la página de la propiedad en dos columnas, el alta del cliente en una).
 *
 * Leen el formulario por contexto (`FormProvider`) porque los campos viven en
 * la raíz en la página de la propiedad y bajo `propiedad.` en el alta del
 * cliente: `prefijo` es lo único que cambia entre las dos.
 */
export type PrefijoDePropiedad = "" | "propiedad.";

export interface SectorElegible {
  id: string;
  nombre: string;
}

function useCamposDePropiedad(prefijo: PrefijoDePropiedad) {
  const { register, control, setValue, watch, getFieldState, formState } =
    useFormContext();
  const campo = (nombre: string) => `${prefijo}${nombre}`;
  const error = (nombre: string) =>
    getFieldState(campo(nombre), formState).error?.message as string | undefined;
  return { register, control, setValue, watch, campo, error };
}

/** Nombre, ciudad, sector, dirección, número de casa y referencia. */
export function DondeEsta({
  prefijo = "",
  sectores,
  titulo = "Dónde está",
  nombreOpcional = false,
}: {
  prefijo?: PrefijoDePropiedad;
  sectores: SectorElegible[];
  titulo?: string;
  /**
   * En el alta del cliente el nombre puede quedar vacío y el servidor le pone
   * "Principal": la mayoría tiene una sola propiedad y no hay nada que
   * distinguir.
   */
  nombreOpcional?: boolean;
}) {
  const { register, control, campo, error } = useCamposDePropiedad(prefijo);

  return (
    <TarjetaSeccion titulo={titulo}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={campo("nombre")}>
            {nombreOpcional ? "Nombre de la propiedad" : "Nombre"}
          </Label>
          <Input
            id={campo("nombre")}
            placeholder="Casa, Oficina, Villa…"
            {...register(campo("nombre"))}
          />
          <p className="text-xs text-muted-foreground">
            Para distinguirla si el cliente tiene más de una.
            {nombreOpcional ? " Si la dejas vacía se llama Principal." : ""}
          </p>
          {error("nombre") && (
            <p className="text-sm text-destructive">{error("nombre")}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Ciudad</Label>
          <Controller
            name={campo("ciudad")}
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
            name={campo("sectorId")}
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
          <Label htmlFor={campo("direccion")}>Dirección</Label>
          <Input
            id={campo("direccion")}
            placeholder="Calle principal e intersección"
            {...register(campo("direccion"))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={campo("numeroCasa")}>Número de casa</Label>
          <Input
            id={campo("numeroCasa")}
            placeholder="Ej: N45-123"
            {...register(campo("numeroCasa"))}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={campo("referencia")}>Referencia</Label>
          <Textarea
            id={campo("referencia")}
            rows={2}
            placeholder="Ej: Frente al parque, casa blanca con portón verde"
            {...register(campo("referencia"))}
          />
        </div>
      </div>
    </TarjetaSeccion>
  );
}

/**
 * El punto exacto: la dirección escrita no alcanza para encontrar una casa
 * adentro de una urbanización.
 */
export function EnElMapa({ prefijo = "" }: { prefijo?: PrefijoDePropiedad }) {
  const { setValue, watch, campo } = useCamposDePropiedad(prefijo);
  const lat = watch(campo("lat")) as number | null | undefined;
  const lng = watch(campo("lng")) as number | null | undefined;

  return (
    <TarjetaSeccion titulo="En el mapa">
      <MapaPropiedad
        lat={lat ?? null}
        lng={lng ?? null}
        onCambio={(punto) => {
          setValue(campo("lat"), punto?.lat ?? null, { shouldDirty: true });
          setValue(campo("lng"), punto?.lng ?? null, { shouldDirty: true });
        }}
      />
    </TarjetaSeccion>
  );
}

/** Las seis medidas y las jardineras en planta alta: con lo que se cotiza. */
export function QueHayQueMantener({
  prefijo = "",
}: {
  prefijo?: PrefijoDePropiedad;
}) {
  const { register, control, campo, error } = useCamposDePropiedad(prefijo);

  /** Un número con su unidad adentro del campo. */
  const numero = (nombre: string, etiqueta: string, sufijo: string) => (
    <div className="space-y-2">
      <Label htmlFor={campo(nombre)}>{etiqueta}</Label>
      <div className="relative">
        <Input
          id={campo(nombre)}
          type="number"
          step="0.1"
          min="0"
          {...register(campo(nombre))}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {sufijo}
        </span>
      </div>
      {error(nombre) && (
        <p className="text-sm text-destructive">{error(nombre)}</p>
      )}
    </div>
  );

  return (
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
          name={campo("jardinerasPlantaAlta")}
          control={control}
          render={({ field }) => (
            <label className="flex items-center gap-3 rounded-xl border p-3">
              <Switch checked={!!field.value} onCheckedChange={field.onChange} />
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
  );
}

/** Lo que hay que saber del lugar: el perro, el portón, la llave de agua. */
export function NotasDePropiedad({
  prefijo = "",
  titulo = "Notas",
}: {
  prefijo?: PrefijoDePropiedad;
  titulo?: string;
}) {
  const { register, campo } = useCamposDePropiedad(prefijo);

  return (
    <TarjetaSeccion titulo={titulo}>
      <Textarea
        id={campo("notas")}
        rows={6}
        placeholder="Perro suelto, portón que se traba, dónde está la llave de agua…"
        {...register(campo("notas"))}
      />
    </TarjetaSeccion>
  );
}
