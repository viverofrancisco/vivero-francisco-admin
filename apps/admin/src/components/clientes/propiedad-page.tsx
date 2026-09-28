"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Trash2 } from "lucide-react";
import { propiedadSchema, type PropiedadFormData } from "@/lib/validations/cliente";
import {
  DondeEsta,
  EnElMapa,
  NotasDePropiedad,
  QueHayQueMantener,
  type SectorElegible,
} from "./campos-de-propiedad";

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
 *
 * Los campos son `campos-de-propiedad.tsx`, los mismos que pide el alta del
 * cliente: acá se los reparte en dos columnas, allá van en una.
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
  sectores: SectorElegible[];
  backHref: string;
}) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const form = useForm<PropiedadFormData>({
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

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="p-4 md:p-6">
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
            <DondeEsta sectores={sectores} />
            <EnElMapa />
            <QueHayQueMantener />
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

            <NotasDePropiedad />
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
    </FormProvider>
  );
}
