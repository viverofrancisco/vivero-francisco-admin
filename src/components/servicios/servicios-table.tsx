"use client";

import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

interface Servicio {
  id: string;
  nombre: string;
  tipo: string;
  _count: { clientes: number };
}

export function ServiciosTable({ servicios }: { servicios: Servicio[] }) {
  const router = useRouter();

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/servicios/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json();
      toast.error(body.error || "Error al eliminar");
      throw new Error(body.error);
    }
  };

  return (
    <div className="rounded-md border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Clientes</TableHead>
            <TableHead className="w-24">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {servicios.map((servicio) => (
            <TableRow key={servicio.id}>
              <TableCell className="font-medium">{servicio.nombre}</TableCell>
              <TableCell>
                <Badge variant={servicio.tipo === "RECURRENTE" ? "secondary" : "outline"}>
                  {servicio.tipo === "RECURRENTE" ? "Recurrente" : "Único"}
                </Badge>
              </TableCell>
              <TableCell>{servicio._count.clientes}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      router.push(`/dashboard/servicios/${servicio.id}`)
                    }
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <DeleteDialog
                    title={`¿Eliminar "${servicio.nombre}"?`}
                    description="Se eliminará este servicio permanentemente."
                    onDelete={() => handleDelete(servicio.id)}
                    onSuccess={() => router.refresh()}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
