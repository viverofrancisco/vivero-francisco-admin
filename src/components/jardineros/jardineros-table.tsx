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

interface Jardinero {
  id: string;
  nombre: string;
  telefono: string | null;
  especialidad: string | null;
  disponible: boolean;
}

export function JardinerosTable({ jardineros }: { jardineros: Jardinero[] }) {
  const router = useRouter();

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/jardineros/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Error al eliminar");
  };

  return (
    <div className="rounded-md border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Especialidad</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="w-24">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jardineros.map((jardinero) => (
            <TableRow key={jardinero.id}>
              <TableCell className="font-medium">{jardinero.nombre}</TableCell>
              <TableCell>{jardinero.telefono ?? "—"}</TableCell>
              <TableCell>{jardinero.especialidad ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={jardinero.disponible ? "default" : "secondary"}>
                  {jardinero.disponible ? "Disponible" : "No disponible"}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      router.push(`/dashboard/jardineros/${jardinero.id}`)
                    }
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <DeleteDialog
                    title={`¿Eliminar a ${jardinero.nombre}?`}
                    description="Se eliminará este jardinero permanentemente."
                    onDelete={() => handleDelete(jardinero.id)}
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
