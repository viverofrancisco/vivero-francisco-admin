"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LogIn, LogOut, MapPin, MapPinOff } from "lucide-react";
import { toast } from "sonner";
import { ubicacionActual } from "@/lib/ubicacion";
import { horaLocal } from "./formato-marca";
import type { PersonalDeVisita } from "@/lib/visita-tareas";

/**
 * Mi entrada y mi salida en esta visita.
 *
 * Dos botones que **sellan el momento** en vez de dos campos donde escribir una
 * hora: eso es lo que convierte el dato en "estuvo ahí a esa hora" en lugar de
 * "alguien dijo que estuvo". Al salir se pregunta qué hizo, porque recién ahí
 * lo sabe.
 *
 * Las fotos no viven acá: se suben desde *Archivos*, en cualquier momento y en
 * cualquier estado, porque se sacan mientras se trabaja y hacerlo esperar a un
 * botón en otra pantalla es pedirle que se acuerde.
 */
export function MiParte({
  visitaId,
  parte,
  obligatoriasIds,
  catalogo,
}: {
  visitaId: string;
  parte: PersonalDeVisita;
  obligatoriasIds: string[];
  catalogo: { tareaId: string; nombre: string }[];
}) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const [elegidas, setElegidas] = useState<Set<string>>(
    () => new Set(parte.tareas.map((t) => t.tarea.id))
  );

  const entrada = parte.entradaEl ? new Date(parte.entradaEl) : null;
  const salida = parte.salidaEl ? new Date(parte.salidaEl) : null;

  /**
   * Las obligatorias primero: es lo que hay que dejar hecho, así que tenerlas
   * al final de una lista de diecisiete es esconderlas.
   */
  const exigidas = new Set(obligatoriasIds);
  const tareas = [
    ...catalogo.filter((t) => exigidas.has(t.tareaId)),
    ...catalogo.filter((t) => !exigidas.has(t.tareaId)),
  ];

  async function marcar(tipo: "ENTRADA" | "SALIDA") {
    setCargando(true);
    try {
      // La ubicación se pide **antes** de mandar y no se exige: si no llega, la
      // marca sale igual y la oficina ve que vino sin ubicación.
      const ubicacion = await ubicacionActual();
      const res = await fetch(`/api/visitas/${visitaId}/marca`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          ubicacion,
          ...(tipo === "SALIDA" ? { tareaIds: [...elegidas] } : {}),
        }),
      });
      const datos = await res.json().catch(() => null);
      if (!res.ok) throw new Error(datos?.error ?? "No pudimos marcar");
      toast.success(tipo === "ENTRADA" ? "Entrada marcada" : "Salida marcada");
      if (!ubicacion) {
        toast.warning("Se marcó sin ubicación: no pudimos obtenerla.");
      }
      setSaliendo(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos marcar");
    } finally {
      setCargando(false);
    }
  }

  /** Corregir lo que hizo, después de haber salido. */
  async function guardarTareas() {
    setCargando(true);
    try {
      const res = await fetch(`/api/visitas/${visitaId}/parte`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tareaIds: [...elegidas] }),
      });
      const datos = await res.json().catch(() => null);
      if (!res.ok) throw new Error(datos?.error ?? "No pudimos guardar");
      toast.success("Listo");
      setSaliendo(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos guardar");
    } finally {
      setCargando(false);
    }
  }

  function alternar(tareaId: string) {
    setElegidas((antes) => {
      const ahora = new Set(antes);
      if (ahora.has(tareaId)) ahora.delete(tareaId);
      else ahora.add(tareaId);
      return ahora;
    });
  }

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 border-b">
          <CardTitle className="text-base">Mi parte</CardTitle>
          {salida ? (
            <Badge variant="secondary">Terminado</Badge>
          ) : entrada ? (
            <Badge variant="outline">En el jardín</Badge>
          ) : (
            <Badge variant="outline">Sin marcar</Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Marca
              etiqueta="Entrada"
              fecha={entrada}
              ubicacion={
                parte.entradaLat !== null
                  ? { precision: parte.entradaPrecision }
                  : null
              }
            />
            <Marca
              etiqueta="Salida"
              fecha={salida}
              ubicacion={
                parte.salidaLat !== null
                  ? { precision: parte.salidaPrecision }
                  : null
              }
            />
          </div>

          {salida && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Lo que hice
              </p>
              {parte.tareas.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No marcaste ninguna tarea.
                </p>
              ) : (
                <p className="text-sm">
                  {parte.tareas.map((t) => t.tarea.nombre).join(", ")}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            {!entrada && (
              <Button onClick={() => marcar("ENTRADA")} disabled={cargando}>
                <LogIn className="mr-2 h-4 w-4" />
                {cargando ? "Marcando…" : "Marcar entrada"}
              </Button>
            )}
            {entrada && !salida && (
              <Button onClick={() => setSaliendo(true)} disabled={cargando}>
                <LogOut className="mr-2 h-4 w-4" />
                Marcar salida
              </Button>
            )}
            {salida && (
              <Button
                variant="outline"
                onClick={() => setSaliendo(true)}
                disabled={cargando}
              >
                Corregir lo que hice
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Al salir se pregunta qué hizo: recién ahí lo sabe. Preguntárselo al
          llegar sería pedirle que adivine. */}
      <Dialog
        open={saliendo}
        onOpenChange={(v) => !v && !cargando && setSaliendo(false)}
      >
        <DialogContent className="sm:max-w-lg" pantallaCompletaEnMovil>
          <DialogHeader>
            <DialogTitle>{salida ? "Lo que hice" : "¿Qué hiciste?"}</DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {tareas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay tareas en el catálogo.
              </p>
            ) : (
              tareas.map((t) => (
                <label
                  key={t.tareaId}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2.5 hover:bg-muted/50"
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
              ))
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSaliendo(false)}
              disabled={cargando}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => (salida ? guardarTareas() : marcar("SALIDA"))}
              disabled={cargando}
            >
              {cargando
                ? "Guardando…"
                : salida
                  ? "Guardar"
                  : "Marcar salida"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Una de las dos marcas: la hora, y si vino con ubicación o sin ella. */
function Marca({
  etiqueta,
  fecha,
  ubicacion,
}: {
  etiqueta: string;
  fecha: Date | null;
  ubicacion: { precision: number | null } | null;
}) {
  return (
    <div className="rounded-lg border border-border px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{etiqueta}</p>
      <p className="text-lg font-extrabold tabular-nums">
        {fecha ? horaLocal(fecha) : "—"}
      </p>
      {fecha && (
        <p className="mt-0.5 flex items-center gap-1 text-[11.5px] font-semibold text-muted-foreground">
          {ubicacion ? (
            <>
              <MapPin className="h-3 w-3 flex-none" />
              Con ubicación
              {ubicacion.precision !== null &&
                ` · ±${Math.round(ubicacion.precision)} m`}
            </>
          ) : (
            <>
              <MapPinOff className="h-3 w-3 flex-none" />
              Sin ubicación
            </>
          )}
        </p>
      )}
    </div>
  );
}
