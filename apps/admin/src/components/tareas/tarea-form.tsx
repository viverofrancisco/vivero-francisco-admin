"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface TareaEditable {
  id: string;
  nombre: string;
  descripcion: string | null;
}

/**
 * La ficha de una tarea: es lo que abre el clic en la fila.
 *
 * Eliminar vive acá adentro y no como un botón en la tabla. La lista es corta y
 * se toca poco, así que una columna de acciones repetida en cada fila gasta
 * ancho permanente para algo que pasa una vez cada tanto — y pone un tacho al
 * lado del renglón que se quiere apretar para leerlo.
 */
export function TareaForm({
  tarea,
  onClose,
  onGuardada,
}: {
  /** `null` para crear una nueva. */
  tarea: TareaEditable | null;
  onClose: () => void;
  onGuardada: () => void;
}) {
  const [nombre, setNombre] = useState(tarea?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(tarea?.descripcion ?? "");
  const [guardando, setGuardando] = useState(false);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [borrando, setBorrando] = useState(false);

  const esEdicion = tarea !== null;

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch(
        esEdicion ? `/api/tareas/${tarea.id}` : "/api/tareas",
        {
          method: esEdicion ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: nombre.trim(),
            descripcion: descripcion.trim() || null,
          }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        // El servidor dice *por qué* —"ya existe una tarea llamada X"—, que es
        // lo único accionable.
        throw new Error(body.error ?? "No pudimos guardar la tarea");
      }
      toast.success(esEdicion ? "Tarea actualizada" : "Tarea creada");
      onGuardada();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos guardar");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (!tarea) return;
    setBorrando(true);
    try {
      const res = await fetch(`/api/tareas/${tarea.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "No pudimos eliminar la tarea");
      }
      toast.success("Tarea eliminada");
      onGuardada();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos eliminar");
      setBorrando(false);
    }
  }

  // La confirmación reemplaza al formulario en vez de abrir un segundo diálogo
  // encima: un modal sobre otro modal deja dos capas de fondo oscurecido y no
  // se entiende cuál se está cerrando al tocar afuera.
  if (confirmandoBorrado && tarea) {
    return (
      <Dialog open onOpenChange={(abierto) => !abierto && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Eliminar &ldquo;{tarea.nombre}&rdquo;?</DialogTitle>
            <DialogDescription>
              Deja de ofrecerse al cerrar una visita, pero las visitas donde ya
              se hizo la siguen nombrando y los informes no cambian.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmandoBorrado(false)}
              disabled={borrando}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={eliminar}
              disabled={borrando}
            >
              {borrando ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onClose()}>
      {/* A pantalla completa en el teléfono: ver la nota de `DialogContent`. */}
      <DialogContent pantallaCompletaEnMovil className="sm:max-w-md">
        <DialogHeader className="flex-none">
          <DialogTitle>{esEdicion ? "Editar tarea" : "Nueva tarea"}</DialogTitle>
        </DialogHeader>
        {/* El cuerpo scrollea y los botones se quedan: con el teclado abierto,
            un formulario que arrastra su pie fuera de la pantalla obliga a
            cerrar el teclado para poder guardar. */}
        <form onSubmit={guardar} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre *</Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Poda de setos"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">
              Descripción{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </Label>
            <Textarea
              id="descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="En qué consiste. Es lo que se propone como texto de la sección cuando el informe agrupa fotos por tarea."
              rows={3}
            />
          </div>

          {esEdicion ? (
            <p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              Cambiar el nombre lo cambia también en las visitas donde ya se
              hizo: sirve para corregir, no para reemplazar la tarea por otra.
            </p>
          ) : null}

          </div>

          {/* Eliminar a la izquierda y separado de Guardar: es la acción que no
              se deshace, y no tiene que quedar pegada a la que se busca. */}
          <div className="mt-4 flex flex-none items-center justify-between gap-4 border-t pt-3">
            {esEdicion ? (
              <Button
                type="button"
                variant="ghost"
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => setConfirmandoBorrado(true)}
              >
                Eliminar
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={guardando}>
                {guardando ? "Guardando..." : esEdicion ? "Guardar" : "Crear"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
