"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * En qué cuadrillas está la persona, desde su ficha: un diálogo con todos
 * los grupos y una casilla por cada uno; *Guardar* manda la lista entera
 * (`PUT /api/personal/[id]/grupos`). Es lo mismo que la app hace en su
 * pantalla de grupos, y lo mismo que las categorías de un producto. Hasta
 * ahora había que abrir cada grupo para mover a alguien.
 */
export function EditarGrupos({
  personalId,
  actuales,
  todos,
}: {
  personalId: string;
  actuales: string[];
  todos: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [marcados, setMarcados] = useState<string[]>(actuales);
  const [guardando, setGuardando] = useState(false);

  const abrir = (v: boolean) => {
    if (v) setMarcados(actuales);
    setAbierto(v);
  };

  const hayCambios =
    marcados.length !== actuales.length || actuales.some((id) => !marcados.includes(id));

  async function guardar() {
    setGuardando(true);
    try {
      const res = await fetch(`/api/personal/${personalId}/grupos`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grupoIds: marcados }),
      });
      const datos = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(datos.error ?? "No pudimos guardar los grupos");
      toast.success("Grupos actualizados");
      setAbierto(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos guardar los grupos");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => abrir(true)}>
        Editar
      </Button>
      <Dialog open={abierto} onOpenChange={abrir}>
        <DialogContent pantallaCompletaEnMovil className="sm:max-w-md">
          <DialogHeader className="flex-none">
            <DialogTitle>Grupos</DialogTitle>
            <DialogDescription>Con quiénes sale habitualmente.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {todos.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">Todavía no hay grupos creados.</p>
            ) : (
              todos.map((g) => {
                const marcado = marcados.includes(g.id);
                return (
                  <label
                    key={g.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted"
                  >
                    <Checkbox
                      checked={marcado}
                      onCheckedChange={(v) =>
                        setMarcados((m) =>
                          v === true ? [...m, g.id] : m.filter((id) => id !== g.id)
                        )
                      }
                      aria-label={g.nombre}
                    />
                    <span className="text-sm font-medium">{g.nombre}</span>
                  </label>
                );
              })
            )}
          </div>
          <DialogFooter className="flex-none">
            <Button type="button" variant="outline" onClick={() => abrir(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button type="button" onClick={guardar} disabled={!hayCambios || guardando}>
              {guardando ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
