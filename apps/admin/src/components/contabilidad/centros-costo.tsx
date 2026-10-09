"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CentroCostoFila } from "@vivero/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";

/**
 * Las partes de la empresa: Administración, las sucursales, Mantenimiento,
 * Obras. Son pocas, así que es una lista sin buscador; tocar una la abre para
 * renombrarla o desactivarla.
 */
export function CentrosCosto({ centros }: { centros: CentroCostoFila[] }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState<CentroCostoFila | "nuevo" | null>(null);

  return (
    <>
      <PageHeader
        title="Centros de costo"
        actions={[
          { label: "Nuevo centro de costo", icon: "plus", primary: true, onClick: () => setAbierto("nuevo") },
        ]}
      />
      <p className="-mt-1 max-w-2xl text-sm text-muted-foreground md:-mt-3">
        Las partes de la empresa. Cada movimiento lleva su centro de costo para saber cuánto
        cuesta y cuánto deja cada una; las obras pertenecen a uno.
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-md border bg-card">
        {centros.length === 0 ? (
          <EmptyState message="Todavía no hay centros de costo" />
        ) : (
          <ul className="divide-y">
            {centros.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setAbierto(c)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50",
                    !c.activo && "opacity-50"
                  )}
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{c.nombre}</span>
                  <span className="text-sm text-muted-foreground">
                    {c.obras === 0 ? "Sin obras" : `${c.obras} obra${c.obras === 1 ? "" : "s"}`}
                  </span>
                  {!c.activo ? <span className="text-xs text-muted-foreground">Inactivo</span> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {abierto ? (
        <DialogoCentro
          key={abierto === "nuevo" ? "nuevo" : abierto.id}
          centro={abierto === "nuevo" ? null : abierto}
          onCerrar={() => setAbierto(null)}
          onGuardado={() => {
            setAbierto(null);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}

function DialogoCentro({
  centro,
  onCerrar,
  onGuardado,
}: {
  centro: CentroCostoFila | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [nombre, setNombre] = useState(centro?.nombre ?? "");
  const [activo, setActivo] = useState(centro?.activo ?? true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cambio = !centro || nombre.trim() !== centro.nombre || activo !== centro.activo;

  async function enviar(metodo: "POST" | "PUT" | "DELETE") {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(
        centro ? `/api/contabilidad/centros-costo/${centro.id}` : "/api/contabilidad/centros-costo",
        {
          method: metodo,
          headers: { "Content-Type": "application/json" },
          body: metodo === "DELETE" ? undefined : JSON.stringify({ nombre, activo }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "No se pudo guardar");
      toast.success(
        metodo === "DELETE" ? "Centro de costo eliminado" : centro ? "Centro de costo guardado" : "Centro de costo creado"
      );
      onGuardado();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{centro ? centro.nombre : "Nuevo centro de costo"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nombre-centro">Nombre</Label>
            <Input
              id="nombre-centro"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Vivero Aurora"
              autoFocus={!centro}
            />
          </div>
          {centro ? (
            <label className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
              <span className="text-sm">
                <span className="block font-medium">Activo</span>
                <span className="block text-xs text-muted-foreground">
                  Uno inactivo no se ofrece para nuevos movimientos ni obras.
                </span>
              </span>
              <Switch checked={activo} onCheckedChange={setActivo} />
            </label>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {centro && centro.obras === 0 ? (
            <Button variant="ghost" className="text-destructive" onClick={() => enviar("DELETE")} disabled={guardando}>
              Eliminar
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={() => enviar(centro ? "PUT" : "POST")} disabled={guardando || !cambio || !nombre.trim()}>
            {centro ? "Guardar" : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
