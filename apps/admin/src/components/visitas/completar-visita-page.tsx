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
import { Textarea } from "@/components/ui/textarea";
import { CustomSelect } from "@/components/ui/custom-select";
import { PersonalSelector } from "@/components/grupos/personal-selector";
import { StatusBadge, type EstadoVisitaUI } from "@/components/ui/status-badge";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { nombreCliente } from "@vivero/shared";
import { hoyISOEcuador } from "@/lib/fechas";
import {
  obligatoriasSinCubrir,
  personalSinRegistrar,
  tareasHechas,
  type PersonalDeVisita,
  type TareaDeVisita,
} from "@/lib/visita-tareas";

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
  tareasObligatorias: { tarea: TareaDeVisita }[];
  /** Los partes cargados, para mirar antes de cerrar. */
  personal: PersonalDeVisita[];
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
 * Cerrar una visita: darla por terminada, o no.
 *
 * **Es de oficina.** El trabajo lo carga cada jardinero en su parte —sus horas
 * y las tareas que él hizo— y eso pasa mientras la visita ocurre. Lo que se
 * decide acá es si con eso alcanza: por eso la pantalla muestra lo cargado y lo
 * que falta, y no vuelve a pedir horas ni tareas.
 *
 * Las fotos se suben desde la ficha, mientras el trabajo pasa: juntarlas para
 * el momento de cerrar era pedirle a alguien que se acuerde.
 */
export function CompletarVisitaPage({
  visita,
  personalList,
  backHref,
}: {
  visita: VisitaData;
  personalList: { id: string; nombre: string; apellido: string | null }[];
  /** A dónde vuelve al cancelar o al terminar. */
  backHref: string;
}) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  /**
   * Quién fue de verdad. Arranca con lo asignado al agendar, que es una
   * intención: el día del trabajo cambia quién pudo ir, y este es el momento
   * en que alguien lo sabe.
   */
  const [personalIds, setPersonalIds] = useState(
    visita.personal.map((p) => p.personalId)
  );

  const hechas = tareasHechas(visita);
  const faltantes = obligatoriasSinCubrir(visita);
  const sinRegistrar = personalSinRegistrar(visita.personal);

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
        body: JSON.stringify({ ...data, personalIds }),
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
                <div className="space-y-1.5 sm:col-span-2">
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

        <div className="space-y-6">
        {/* Lo que hay que mirar antes de decir que está terminada: qué se
            cargó, qué se exigía y no está, y quién no cargó nada. */}
        <Card>
          <CardHeader className="border-b py-3">
            <CardTitle className="text-base">Lo que se registró</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {faltantes.length > 0 && (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs">
                Sin hacer, y eran obligatorias:{" "}
                <span className="font-semibold">
                  {faltantes.map((t) => t.nombre).join(", ")}
                </span>
              </p>
            )}
            {sinRegistrar.length > 0 && (
              <p className="rounded-md border bg-muted/40 p-2.5 text-xs">
                Todavía no cargaron su parte:{" "}
                <span className="font-semibold">
                  {sinRegistrar
                    .map((p) =>
                      [p.personal.nombre, p.personal.apellido]
                        .filter(Boolean)
                        .join(" ")
                    )
                    .join(", ")}
                </span>
                . Se puede cerrar igual — quién decide que está terminada es
                quien mira, no la cuenta.
              </p>
            )}
            {hechas.length === 0 ? (
              <p className="text-muted-foreground">
                Nadie registró tareas todavía.
              </p>
            ) : (
              <ul className="divide-y">
                {hechas.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 py-2">
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {t.nombre}
                    </span>
                    <span className="flex-none text-xs text-muted-foreground">
                      {t.porQuienes.join(", ")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b py-3">
            <CardTitle className="text-base">Quién fue</CardTitle>
          </CardHeader>
          <CardContent>
            <PersonalSelector
              personalList={personalList}
              selectedIds={personalIds}
              onChange={setPersonalIds}
            />
          </CardContent>
        </Card>
        </div>
      </div>
    </form>
  );
}
