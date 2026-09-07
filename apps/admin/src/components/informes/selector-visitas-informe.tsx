"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge, type EstadoVisitaUI } from "@/components/ui/status-badge";
import { Loader2 } from "lucide-react";

interface VisitaOpcion {
  id: string;
  numero: number;
  estado: string;
  fechaProgramada: string;
  fechaRealizada?: string | null;
}

/**
 * Qué visitas cubre un informe ya generado.
 *
 * Se puede cambiar porque las visitas **no salen impresas**: son el vínculo con
 * el trabajo que el informe cuenta, y ese vínculo se corrige —alguien marcó una
 * de más, o faltó la del martes—. Lo que sigue sin tocarse es el documento.
 *
 * Trae **todas** las del cliente, sin filtro de fechas: acá no se está armando
 * un informe sino arreglando una lista, y lo que falta suele ser justo lo que
 * quedó fuera del rango que se usó al crearlo.
 */
export function SelectorVisitasInforme({
  informeId,
  clienteId,
  elegidas,
  onGuardado,
  onCerrar,
}: {
  informeId: string;
  clienteId: string;
  elegidas: string[];
  onGuardado: () => void;
  onCerrar: () => void;
}) {
  const [items, setItems] = useState<VisitaOpcion[] | null>(null);
  const [pedido, setPedido] = useState(false);
  const [seleccion, setSeleccion] = useState<string[]>(elegidas);
  const [guardando, setGuardando] = useState(false);

  // Se dispara al renderizar en vez de con un efecto: no hay dependencias que
  // sincronizar ni un `setState` después de pintar.
  if (!pedido) {
    setPedido(true);
    fetch(`/api/admin/informes/visitas?clienteId=${clienteId}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .catch(() => setItems([]));
  }

  const guardar = async () => {
    setGuardando(true);
    try {
      const res = await fetch(`/api/informes/${informeId}/visitas`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitaIds: seleccion }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error");
      toast.success("Visitas actualizadas");
      onGuardado();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos guardar");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Visitas del informe</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="max-h-[50vh] divide-y overflow-y-auto rounded-md border">
            {items === null ? (
              <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando…
              </p>
            ) : items.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Este cliente no tiene visitas.
              </p>
            ) : (
              items.map((v) => (
                <label
                  key={v.id}
                  className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/50"
                >
                  <Checkbox
                    checked={seleccion.includes(v.id)}
                    onCheckedChange={(c) =>
                      setSeleccion((prev) =>
                        c ? [...prev, v.id] : prev.filter((x) => x !== v.id)
                      )
                    }
                  />
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="font-medium tabular-nums">#{v.numero}</span>
                    <span className="ml-2 text-muted-foreground">
                      {fecha(v.fechaRealizada ?? v.fechaProgramada)}
                    </span>
                  </span>
                  <StatusBadge estado={v.estado as EstadoVisitaUI} size="sm" />
                </label>
              ))
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t pt-4">
            <span className="text-xs text-muted-foreground">
              {seleccion.length === 0
                ? "Sin visitas: el informe queda sin vínculo con el trabajo."
                : `${seleccion.length} ${seleccion.length === 1 ? "visita" : "visitas"}`}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onCerrar} disabled={guardando}>
                Cancelar
              </Button>
              <Button onClick={guardar} disabled={guardando}>
                {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
