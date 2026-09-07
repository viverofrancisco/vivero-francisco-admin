"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FileText, Trash2 } from "lucide-react";

export interface BorradorInformeItem {
  id: string;
  titulo: string | null;
  cliente: string | null;
  updatedAt: string;
  actualizadoPor: string | null;
}

function cuando(iso: string): string {
  return new Date(iso).toLocaleString("es-EC", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Los informes a medio armar, arriba del listado.
 *
 * Acá y no en una página aparte: son pocos y de paso, y esconderlos detrás de
 * un clic haría que se olviden — que es exactamente lo que un borrador no puede
 * hacer. Cuando no hay ninguno, no se dibuja nada.
 */
export function BorradoresInforme({ items }: { items: BorradorInformeItem[] }) {
  const router = useRouter();
  const [borrando, setBorrando] = useState<string | null>(null);

  if (items.length === 0) return null;

  const eliminar = async (id: string) => {
    setBorrando(id);
    try {
      const res = await fetch(`/api/admin/informes/borradores/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("No pudimos eliminarlo");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos eliminarlo");
    } finally {
      setBorrando(null);
    }
  };

  return (
    <div className="rounded-lg border bg-amber-50/60 p-3">
      <p className="mb-2 px-1 text-xs font-medium text-amber-900">
        Sin terminar ({items.length})
      </p>
      <ul className="space-y-1">
        {items.map((b) => (
          <li
            key={b.id}
            className="flex items-center gap-3 rounded-md bg-card px-3 py-2"
          >
            <FileText className="h-4 w-4 flex-none text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {b.titulo || "Sin título"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {b.cliente ?? "Sin cliente"} · {cuando(b.updatedAt)}
                {b.actualizadoPor ? ` · ${b.actualizadoPor}` : ""}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href={`/dashboard/informes/nuevo?borrador=${b.id}`} />}
            >
              Continuar
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => eliminar(b.id)}
              disabled={borrando === b.id}
              title="Eliminar el borrador"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
