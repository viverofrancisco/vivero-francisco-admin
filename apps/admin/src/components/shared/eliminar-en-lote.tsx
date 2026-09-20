"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Fallo {
  id: string;
  nombre: string | null;
  motivo: string;
}

/**
 * Borrar de a varios contra un endpoint de lote.
 *
 * La respuesta no es "salió bien" o "salió mal": trae cuántos salieron y
 * **cuáles** se quedaron, con su motivo. Por eso el aviso los nombra uno por
 * uno en vez de decir "algunos fallaron", que deja a quien lo hizo sin saber
 * cuál reintentar.
 */
export function useEliminarEnLote({
  endpoint,
  sustantivo,
  plural,
  onListo,
}: {
  endpoint: string;
  /** "persona", "grupo": cómo se lo nombra en singular. */
  sustantivo: string;
  plural: string;
  onListo: () => void;
}) {
  const [eliminando, setEliminando] = useState(false);

  async function eliminar(ids: string[]) {
    setEliminando(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        throw new Error(data?.error || `No pudimos eliminar ${plural}`);
      }
      if (data.eliminados > 0) {
        toast.success(
          data.eliminados === 1
            ? `1 ${sustantivo} eliminada`
            : `${data.eliminados} ${plural} eliminadas`
        );
      }
      if (data.errores?.length > 0) {
        toast.error(
          data.errores.length === 1
            ? `1 ${sustantivo} no se pudo eliminar`
            : `${data.errores.length} ${plural} no se pudieron eliminar`,
          {
            // Una lista y no un texto con saltos de línea: el aviso los ignora
            // y quedaba todo en un renglón.
            description: (
              <ul className="mt-1 space-y-0.5">
                {data.errores.slice(0, 5).map((e: Fallo) => (
                  <li key={e.id}>
                    {e.nombre ? `${e.nombre}: ` : ""}
                    {e.motivo}
                  </li>
                ))}
                {data.errores.length > 5 && (
                  <li>y {data.errores.length - 5} más</li>
                )}
              </ul>
            ),
          }
        );
      }
      onListo();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : `No pudimos eliminar ${plural}`
      );
    } finally {
      setEliminando(false);
    }
  }

  return { eliminar, eliminando };
}

/**
 * La confirmación. **Acá sí va el rojo**: la barra de selección lo evita porque
 * sobre su fondo oscuro desaparece, y el color pertenece al momento en que se
 * decide, que es este.
 */
export function DialogoEliminarEnLote({
  abierto,
  onOpenChange,
  cuantas,
  sustantivo,
  plural,
  detalle,
  eliminando,
  onConfirmar,
}: {
  abierto: boolean;
  onOpenChange: (v: boolean) => void;
  cuantas: number;
  sustantivo: string;
  plural: string;
  /** Qué pasa de verdad al eliminar. Cada pantalla tiene lo suyo que avisar. */
  detalle: string;
  eliminando: boolean;
  onConfirmar: () => void;
}) {
  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {cuantas === 1
              ? `¿Eliminar 1 ${sustantivo}?`
              : `¿Eliminar ${cuantas} ${plural}?`}
          </DialogTitle>
          <DialogDescription>{detalle}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={eliminando}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirmar}
            disabled={eliminando}
          >
            {eliminando ? "Eliminando..." : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
