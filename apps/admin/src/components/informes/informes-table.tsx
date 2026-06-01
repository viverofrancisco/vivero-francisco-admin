"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface InformeListItem {
  id: string;
  titulo: string;
  fechaDesde: string | null;
  fechaHasta: string | null;
  pdfUrl: string;
  generatedAt: string;
  cliente: { id: string; nombre: string };
  generatedBy: { nombre: string };
  visitasCount: number;
}

export function InformesTable({ items }: { items: InformeListItem[] }) {
  const router = useRouter();

  async function deleteInforme(id: string) {
    if (!confirm("¿Eliminar este informe? El PDF también será eliminado.")) return;
    const res = await fetch(`/api/admin/informes/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
      toast.success("Informe eliminado");
    } else {
      toast.error("No pudimos eliminar");
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-12 text-center">
        <h3 className="text-base font-medium">No hay informes</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Genera el primero pulsando &quot;Generar nuevo informe&quot;.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <Card key={item.id}>
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium">{item.titulo}</p>
                <span className="text-xs text-muted-foreground">
                  · {item.cliente.nombre}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.visitasCount} visita{item.visitasCount === 1 ? "" : "s"}
                {item.fechaDesde && item.fechaHasta ? (
                  <>
                    {" · "}
                    {formatRange(item.fechaDesde, item.fechaHasta)}
                  </>
                ) : null}
                {" · Generado por "}
                {item.generatedBy.nombre || "—"}
                {" · "}
                {formatGeneratedAt(item.generatedAt)}
              </p>
            </div>
            <div className="flex flex-none items-center gap-1">
              <a href={item.pdfUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="icon" title="Descargar PDF">
                  <Download className="h-4 w-4" />
                </Button>
              </a>
              <Link href={`/dashboard/informes/${item.id}`}>
                <Button variant="ghost" size="icon" title="Editar / regenerar">
                  <Pencil className="h-4 w-4" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteInforme(item.id)}
                title="Eliminar"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function formatRange(fromIso: string, toIso: string): string {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  const fmt = (d: Date) =>
    d.toLocaleDateString("es-EC", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  if (
    from.getUTCFullYear() === to.getUTCFullYear() &&
    from.getUTCMonth() === to.getUTCMonth() &&
    from.getUTCDate() === to.getUTCDate()
  ) {
    return fmt(from);
  }
  return `${fmt(from)} → ${fmt(to)}`;
}

function formatGeneratedAt(iso: string): string {
  return new Date(iso).toLocaleString("es-EC", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
