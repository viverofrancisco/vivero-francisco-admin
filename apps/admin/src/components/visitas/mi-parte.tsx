"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { TimePicker } from "@/components/ui/time-picker";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { PersonalDeVisita } from "@/lib/visita-tareas";

/**
 * Lo que **yo** hice en esta visita.
 *
 * Cada asignado carga lo suyo: sus horas y sus tareas. No cierra la visita
 * —eso lo decide la oficina mirando lo que cargó cada uno— y no toca el parte
 * de nadie más.
 *
 * Existía solo en la app móvil. En el navegador el jardinero veía su visita,
 * veía que le faltaba cargar el parte, y no tenía por dónde: el endpoint
 * estaba, el formulario no.
 *
 * **No pide que la visita sea de hoy.** El servidor tampoco lo pide: una visita
 * del mes pasado que quedó sin cargar se carga igual, que es exactamente cuando
 * hace falta.
 */
export function MiParte({
  visitaId,
  parte,
  obligatoriasIds,
  catalogo,
}: {
  visitaId: string;
  /** Mi asignación, con lo que ya haya cargado. */
  parte: PersonalDeVisita;
  /** Lo que la visita exige. Van primero. */
  obligatoriasIds: string[];
  catalogo: { tareaId: string; nombre: string }[];
}) {
  const router = useRouter();
  const [horaEntrada, setHoraEntrada] = useState(parte.horaEntrada ?? "");
  const [horaSalida, setHoraSalida] = useState(parte.horaSalida ?? "");
  const [elegidas, setElegidas] = useState<Set<string>>(
    () => new Set(parte.tareas.map((t) => t.tarea.id))
  );
  const [guardando, setGuardando] = useState(false);

  const yaCargado = parte.registradoEl !== null;

  /**
   * Las obligatorias primero: es lo que hay que dejar hecho, así que tenerlas
   * al final de una lista de diecisiete es esconderlas. El resto va en el orden
   * del catálogo, que es el que eligió la oficina.
   */
  const exigidas = new Set(obligatoriasIds);
  const tareas = [
    ...catalogo.filter((t) => exigidas.has(t.tareaId)),
    ...catalogo.filter((t) => !exigidas.has(t.tareaId)),
  ];

  function alternar(tareaId: string) {
    setElegidas((antes) => {
      const ahora = new Set(antes);
      if (ahora.has(tareaId)) ahora.delete(tareaId);
      else ahora.add(tareaId);
      return ahora;
    });
  }

  async function guardar() {
    setGuardando(true);
    try {
      const res = await fetch(`/api/visitas/${visitaId}/parte`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          horaEntrada: horaEntrada || null,
          horaSalida: horaSalida || null,
          // Lo que llega **reemplaza** lo que había: el formulario es una lista
          // de casillas, así que lo que se manda ya es el estado final. Si
          // agregara, no habría forma de desmarcar algo cargado por error.
          tareaIds: [...elegidas],
        }),
      });
      const datos = await res.json().catch(() => null);
      if (!res.ok) throw new Error(datos?.error ?? "No pudimos guardar tu parte");
      toast.success(yaCargado ? "Parte actualizado" : "Parte cargado");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No pudimos guardar tu parte"
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 border-b">
        <CardTitle className="text-base">Mi parte</CardTitle>
        {yaCargado ? (
          <Badge variant="secondary">Cargado</Badge>
        ) : (
          <Badge variant="outline">Sin cargar</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Hora de entrada</Label>
            <TimePicker value={horaEntrada} onChange={setHoraEntrada} />
          </div>
          <div className="space-y-2">
            <Label>Hora de salida</Label>
            <TimePicker value={horaSalida} onChange={setHoraSalida} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>¿Qué hiciste?</Label>
          {tareas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay tareas en el catálogo.
            </p>
          ) : (
            <div className="grid gap-1 sm:grid-cols-2">
              {tareas.map((t) => (
                <label
                  key={t.tareaId}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 hover:bg-muted/50"
                >
                  <Checkbox
                    checked={elegidas.has(t.tareaId)}
                    onCheckedChange={() => alternar(t.tareaId)}
                  />
                  <span className="min-w-0 flex-1 text-sm">{t.nombre}</span>
                  {exigidas.has(t.tareaId) && (
                    <span className="flex-none text-[11px] font-bold text-warning-foreground">
                      Obligatoria
                    </span>
                  )}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando…" : yaCargado ? "Guardar cambios" : "Cargar mi parte"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
