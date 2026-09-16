"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { CustomSelect } from "@/components/ui/custom-select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { CIUDADES_ECUADOR } from "@/lib/constants/ciudades-ecuador";
import { propiedadSchema, type PropiedadFormData } from "@/lib/validations/cliente";

/**
 * Leaflet toca `window` al importarse, así que no puede renderizarse en el
 * servidor. Y el mapa solo hace falta cuando alguien abre el editor.
 */
const MapaPropiedad = dynamic(
  () => import("./mapa-propiedad").then((m) => m.MapaPropiedad),
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-xl bg-muted" /> }
);

export interface PropiedadData {
  id: string;
  nombre: string;
  ciudad: string | null;
  sectorId: string | null;
  sector: { id: string; nombre: string } | null;
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
  /** Cuántas visitas pasaron ahí. Una con visitas no se borra. */
  visitas: number;
}

/**
 * Las propiedades de un cliente: dónde se trabaja.
 *
 * La dirección era del cliente y se mudó acá, junto con el sector y los metros:
 * un cliente con dos casas tiene dos direcciones y ninguna es "la suya", y el
 * sector es geográfico —del lugar, no de la persona—.
 *
 * Los números de cada una son **lo que hay que mantener**, que es con lo que se
 * cotiza: cuántos metros de césped cortar, cuántos metros lineales de seto
 * podar y a qué altura, cuántos árboles. Todos opcionales, porque se van
 * midiendo con el tiempo y una propiedad recién cargada ya sirve para agendar.
 */
export function PropiedadesCard({
  clienteId,
  propiedades,
  sectores,
  puedeEditar,
}: {
  clienteId: string;
  propiedades: PropiedadData[];
  sectores: { id: string; nombre: string }[];
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState<PropiedadData | "nueva" | null>(null);
  const [borrando, setBorrando] = useState<PropiedadData | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  async function eliminar(p: PropiedadData) {
    setTrabajando(true);
    try {
      const res = await fetch(`/api/clientes/${clienteId}/propiedades/${p.id}`, {
        method: "DELETE",
      });
      const datos = await res.json().catch(() => null);
      if (!res.ok) throw new Error(datos?.error ?? "No pudimos eliminarla");
      toast.success("Propiedad eliminada");
      setBorrando(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos eliminarla");
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Propiedades</CardTitle>
          {puedeEditar && (
            <CardAction>
              <Button size="sm" variant="outline" onClick={() => setEditando("nueva")}>
                <Plus className="mr-2 h-3.5 w-3.5" />
                Agregar
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {propiedades.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              Sin propiedades. Agrega una para poder agendarle visitas.
            </p>
          ) : (
            <ul className="divide-y">
              {propiedades.map((p) => (
                <li key={p.id} className="flex items-start gap-3 py-3 first:pt-0">
                  <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-secondary text-green-700">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{p.nombre}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[p.direccion, p.numeroCasa].filter(Boolean).join(" ") ||
                        "Sin dirección"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[p.sector?.nombre, p.ciudad].filter(Boolean).join(" · ") ||
                        "Sin sector"}
                      {p.m2Total ? ` · ${p.m2Total} m²` : ""}
                      {p.lat !== null ? " · con pin" : ""}
                    </p>
                  </div>
                  {puedeEditar && (
                    <div className="flex flex-none items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Editar ${p.nombre}`}
                        onClick={() => setEditando(p)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        aria-label={`Eliminar ${p.nombre}`}
                        onClick={() => setBorrando(p)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {editando && (
        <PropiedadDialog
          clienteId={clienteId}
          propiedad={editando === "nueva" ? null : editando}
          sectores={sectores}
          onCerrar={() => setEditando(null)}
        />
      )}

      <Dialog open={borrando !== null} onOpenChange={(v) => !v && setBorrando(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar {borrando?.nombre}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {borrando && borrando.visitas > 0
              ? `Esta propiedad tiene ${borrando.visitas} visita${
                  borrando.visitas === 1 ? "" : "s"
                }, así que no se puede eliminar: esas visitas pasaron ahí. Si ya no se trabaja en ella, deja de agendarla.`
              : "Deja de aparecer al agendar. No se puede deshacer desde el portal."}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBorrando(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={trabajando || (borrando?.visitas ?? 0) > 0}
              onClick={() => borrando && eliminar(borrando)}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** El formulario de una propiedad: dónde está y qué hay que mantener. */
function PropiedadDialog({
  clienteId,
  propiedad,
  sectores,
  onCerrar,
}: {
  clienteId: string;
  propiedad: PropiedadData | null;
  sectores: { id: string; nombre: string }[];
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);

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
      onCerrar();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos guardar");
    } finally {
      setGuardando(false);
    }
  };

  const numero = (id: keyof PropiedadFormData, etiqueta: string, sufijo: string) => (
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
    <Dialog open onOpenChange={(v) => !v && !guardando && onCerrar()}>
      <DialogContent className="sm:max-w-2xl" pantallaCompletaEnMovil>
        <DialogHeader>
          <DialogTitle>
            {propiedad ? propiedad.nombre : "Nueva propiedad"}
          </DialogTitle>
        </DialogHeader>

        <form
          id="propiedad-form"
          onSubmit={handleSubmit(onSubmit)}
          className="min-h-0 flex-1 space-y-5 overflow-y-auto"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input id="nombre" placeholder="Casa, Oficina, Villa…" {...register("nombre")} />
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

          {/* El punto exacto. La dirección escrita no alcanza para encontrar una
              casa adentro de una urbanización. */}
          <div className="space-y-2">
            <Label>Ubicación en el mapa</Label>
            <MapaPropiedad
              lat={lat ?? null}
              lng={lng ?? null}
              onCambio={(punto) => {
                setValue("lat", punto?.lat ?? null, { shouldDirty: true });
                setValue("lng", punto?.lng ?? null, { shouldDirty: true });
              }}
            />
          </div>

          {/* Lo que hay que mantener, que es con lo que se cotiza. */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Qué hay que mantener
            </Label>
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
                <label className="flex items-center gap-3 rounded-lg border p-3">
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

          <div className="space-y-2">
            <Label htmlFor="notas">Notas</Label>
            <Textarea
              id="notas"
              rows={3}
              placeholder="Perro suelto, portón que se traba, dónde está la llave de agua…"
              {...register("notas")}
            />
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button type="submit" form="propiedad-form" disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
