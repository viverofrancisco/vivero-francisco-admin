"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  completarVisitaSchema,
  type CompletarVisitaFormData,
} from "@/lib/validations/visita";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { Textarea } from "@/components/ui/textarea";
import { CustomSelect } from "@/components/ui/custom-select";
import { StatusBadge, type EstadoVisitaUI } from "@/components/ui/status-badge";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { nombreCliente } from "@vivero/shared";
import { hoyISOEcuador } from "@/lib/fechas";
import type { ProductoDeVisita } from "@/lib/visita-productos";

interface VisitaData {
  id: string;
  numero: number;
  estado: string;
  fechaProgramada: string;
  cliente: {
    nombre: string;
    apellido?: string | null;
    empresa?: string | null;
  };
  productos: ProductoDeVisita[];
}

const fechaLarga = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("es-EC", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

/**
 * Cerrar una visita: qué pasó y cuándo.
 *
 * Solo eso. Las fotos se suben desde la ficha de la visita, mientras el
 * trabajo pasa, y no acá al final: quien está en el jardín va cargando lo que
 * lleva, y juntar todo para el momento de cerrarla era pedirle que se acuerde.
 */
export function CompletarVisitaPage({
  visita,
  backHref,
}: {
  visita: VisitaData;
  /** A dónde vuelve al cancelar o al terminar. */
  backHref: string;
}) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<CompletarVisitaFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(completarVisitaSchema as any) as any,
    defaultValues: {
      estado: "COMPLETADA",
      fechaRealizada: hoyISOEcuador(),
      horaEntrada: "",
      horaSalida: "",
      notas: "",
      notasIncompleto: "",
    },
  });

  const estado = watch("estado");

  const onSubmit = async (data: CompletarVisitaFormData) => {
    setGuardando(true);
    try {
      const res = await fetch(`/api/visitas/${visita.id}/completar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Error");

      const titulos: Record<string, string> = {
        COMPLETADA: "Visita completada",
        INCOMPLETA: "Visita marcada como incompleta",
        CANCELADA: "Visita cancelada",
      };
      toast.success(titulos[data.estado]);
      router.push(backHref);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pb-6">
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b bg-card/95 px-4 py-3 backdrop-blur-sm md:px-6">
        <Link href={backHref}>
          <Button type="button" variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h1 className="truncate text-2xl font-bold">
              Completar visita #{visita.numero}
            </h1>
            <StatusBadge estado={visita.estado as EstadoVisitaUI} size="sm" />
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {nombreCliente(visita.cliente)} ·{" "}
            {fechaLarga(visita.fechaProgramada)}
          </p>
        </div>
        <div className="flex flex-none items-center gap-2">
          <Link href={backHref}>
            <Button type="button" variant="outline" disabled={guardando}>
              Cancelar
            </Button>
          </Link>
          <Button type="submit" disabled={guardando}>
            {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-6 px-4 md:px-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="overflow-visible">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Resultado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">¿Cómo terminó? *</Label>
                <Controller
                  name="estado"
                  control={control}
                  render={({ field }) => (
                    <CustomSelect
                      value={field.value}
                      onChange={field.onChange}
                      options={[
                        { value: "COMPLETADA", label: "Completada" },
                        { value: "INCOMPLETA", label: "Incompleta" },
                        { value: "CANCELADA", label: "Cancelada" },
                      ]}
                    />
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Fecha realizada *</Label>
                  <Controller
                    name="fechaRealizada"
                    control={control}
                    render={({ field }) => (
                      <DatePicker
                        value={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />
                  {errors.fechaRealizada && (
                    <p className="text-xs text-red-600">
                      {errors.fechaRealizada.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Hora entrada</Label>
                  <Controller
                    name="horaEntrada"
                    control={control}
                    render={({ field }) => (
                      <TimePicker
                        value={field.value ?? ""}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Hora salida</Label>
                  <Controller
                    name="horaSalida"
                    control={control}
                    render={({ field }) => (
                      <TimePicker
                        value={field.value ?? ""}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </div>
              </div>

              {estado === "INCOMPLETA" && (
                <div className="space-y-1.5">
                  <Label htmlFor="notasIncompleto" className="text-xs">
                    Razón de incompleto *
                  </Label>
                  <Textarea
                    id="notasIncompleto"
                    rows={3}
                    placeholder="Explicá por qué no se completó..."
                    {...register("notasIncompleto")}
                  />
                </div>
              )}

              {estado === "CANCELADA" && (
                <div className="space-y-1.5">
                  <Label htmlFor="notasIncompleto" className="text-xs">
                    Razón de cancelación
                  </Label>
                  <Textarea
                    id="notasIncompleto"
                    rows={3}
                    placeholder="Explicá por qué se canceló..."
                    {...register("notasIncompleto")}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Notas del trabajo</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={4}
                placeholder="Qué se hizo, qué quedó pendiente..."
                {...register("notas")}
              />
            </CardContent>
          </Card>
        </div>

        {/* Qué se fue a hacer, para tenerlo delante al escribir las notas. */}
        <Card>
          <CardHeader className="border-b py-3">
            <CardTitle className="text-base">Productos de la visita</CardTitle>
          </CardHeader>
          <CardContent>
            {visita.productos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                La visita no tiene productos.
              </p>
            ) : (
              <ul className="divide-y text-sm">
                {visita.productos.map((p) => (
                  <li key={p.productoId} className="truncate py-2 font-medium">
                    {p.producto.nombre}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
