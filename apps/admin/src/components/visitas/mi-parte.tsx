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
import { Smartphone } from "lucide-react";
import { toast } from "sonner";
import type { PersonalDeVisita } from "@/lib/visita-tareas";

/**
 * Lo que el asignado puede hacer con su parte **desde el portal**.
 *
 * Marcar entrada y salida no está acá, y no por falta de ganas: marcar
 * significa "estuve acá a esta hora", y en el navegador la ubicación que lo
 * respalda se falsea en tres clics —las DevTools de Chrome traen un override,
 * sin instalar nada—. Una marca hecha desde la web no dice nada que no diga
 * escribir la hora a mano, y encima parece que sí. En el teléfono el permiso se
 * pide en serio, la lectura es mucho mejor y Android delata las de mock.
 *
 * Así que desde acá se corrige lo que uno marcó —qué tareas hizo, que no tiene
 * nada que ver con dónde estaba— y las horas se leen en *Detalles*. Las fotos
 * se suben desde *Archivos*, en cualquier momento.
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

  const exigidas = new Set(obligatoriasIds);
  /** Las obligatorias primero: al final de una lista de diecisiete se esconden. */
  const tareas = [
    ...catalogo.filter((t) => exigidas.has(t.tareaId)),
    ...catalogo.filter((t) => !exigidas.has(t.tareaId)),
  ];

  /** Corregir lo que hizo. No toca las marcas: la hora a la que llegó ya pasó. */
  async function guardar() {
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

  // Todavía no salió: lo que corresponde es marcar, y eso es del teléfono. Se
  // dice justo donde estaría el botón, que es donde lo van a buscar.
  if (!parte.salidaEl) {
    return (
      <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <Smartphone className="h-4 w-4 flex-none" />
        {parte.entradaEl ? "Marca tu salida" : "Marca tu entrada"} desde la app
      </span>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setAbierto(true)}
        disabled={cargando}
      >
        Editar mi parte
      </Button>

      <Dialog
        open={abierto}
        onOpenChange={(v) => !v && !cargando && setAbierto(false)}
      >
        <DialogContent className="sm:max-w-lg" pantallaCompletaEnMovil>
          <DialogHeader>
            <DialogTitle>Lo que hice</DialogTitle>
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
            <Button onClick={guardar} disabled={cargando}>
              {cargando ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
