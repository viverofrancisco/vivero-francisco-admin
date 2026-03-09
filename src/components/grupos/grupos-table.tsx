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

interface Grupo {
  id: string;
  nombre: string;
  descripcion: string | null;
  miembros: {
    jardinero: { nombre: string };
  }[];
}

export function GruposTable({ grupos }: { grupos: Grupo[] }) {
  const router = useRouter();

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/grupos/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Error al eliminar");
  };

  return (
    <div className="rounded-md border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead>Miembros</TableHead>
            <TableHead className="w-24">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {grupos.map((grupo) => (
            <TableRow key={grupo.id}>
              <TableCell className="font-medium">{grupo.nombre}</TableCell>
              <TableCell>{grupo.descripcion ?? "—"}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary">
                    {grupo.miembros.length} jardinero(s)
                  </Badge>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      router.push(`/dashboard/grupos/${grupo.id}`)
                    }
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <DeleteDialog
                    title={`¿Eliminar "${grupo.nombre}"?`}
                    description="Se eliminará este grupo permanentemente."
                    onDelete={() => handleDelete(grupo.id)}
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
