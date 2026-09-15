"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";
import { ubicacionActual } from "@/lib/ubicacion";
import type { PersonalDeVisita } from "@/lib/visita-tareas";

/**
 * Marcar mi entrada y mi salida, desde el encabezado de la visita.
 *
 * Vive donde la oficina tiene *Editar* y *Completar*, porque es la acción de
 * esta pantalla: tenía una tarjeta propia arriba de todo y ocupaba media
 * pantalla para mostrar dos guiones y un botón. Las horas marcadas se leen en
 * *Detalles*, con el resto de lo que pasó.
 *
 * Los dos momentos los **sella el servidor** al apretar, en vez de dos campos
 * donde escribir una hora: eso es lo que convierte el dato en "estuvo ahí a esa
 * hora" y no "alguien dijo que estuvo". Al salir se pregunta qué hizo, porque
 * recién ahí lo sabe.
 *
 * Las fotos no están acá: se suben desde *Archivos*, en cualquier momento,
 * porque se sacan mientras se trabaja.
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
  const [abierto, setAbierto] = useState(false);
  const [elegidas, setElegidas] = useState<Set<string>>(
    () => new Set(parte.tareas.map((t) => t.tarea.id))
  );

  const entrada = parte.entradaEl;
  const salida = parte.salidaEl;

  const exigidas = new Set(obligatoriasIds);
  /** Las obligatorias primero: al final de una lista de diecisiete se esconden. */
  const tareas = [
    ...catalogo.filter((t) => exigidas.has(t.tareaId)),
    ...catalogo.filter((t) => !exigidas.has(t.tareaId)),
  ];

  async function marcar(tipo: "ENTRADA" | "SALIDA") {
    setCargando(true);
    try {
      // La ubicación se pide antes de mandar y no se exige: si no llega, la
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
      setAbierto(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos marcar");
    } finally {
      setCargando(false);
    }
  }

  /** Corregir lo que hizo, después de haber salido. No mueve las marcas. */
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
      setAbierto(false);
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
      {!entrada ? (
        <Button onClick={() => marcar("ENTRADA")} disabled={cargando}>
          <LogIn className="mr-2 h-4 w-4" />
          {cargando ? "Marcando…" : "Marcar entrada"}
        </Button>
      ) : !salida ? (
        <Button onClick={() => setAbierto(true)} disabled={cargando}>
          <LogOut className="mr-2 h-4 w-4" />
          Marcar salida
        </Button>
      ) : (
        // Después de salir queda poder corregir lo que marcó: sin esto, una
        // tarea tildada por error no se arregla desde ningún lado.
        <Button
          variant="outline"
          onClick={() => setAbierto(true)}
          disabled={cargando}
        >
          Editar mi parte
        </Button>
      )}

      {/* Al salir se pregunta qué hizo: recién ahí lo sabe. Preguntárselo al
          llegar sería pedirle que adivine. */}
      <Dialog
        open={abierto}
        onOpenChange={(v) => !v && !cargando && setAbierto(false)}
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
              onClick={() => setAbierto(false)}
              disabled={cargando}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => (salida ? guardarTareas() : marcar("SALIDA"))}
              disabled={cargando}
            >
              {cargando ? "Guardando…" : salida ? "Guardar" : "Marcar salida"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
