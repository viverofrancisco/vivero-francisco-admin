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
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { Pencil } from "lucide-react";

interface Cliente {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  ciudad: string | null;
  direccion: string | null;
  referencia: string | null;
  sector?: { id: string; nombre: string } | null;
}

function formatUbicacion(cliente: Cliente): string {
  const parts = [cliente.sector?.nombre, cliente.ciudad].filter(Boolean);
  return parts.join(", ") || "—";
}

export function ClientesTable({ clientes }: { clientes: Cliente[] }) {
  const router = useRouter();

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/clientes/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Error al eliminar");
  };

  return (
    <div className="rounded-md border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Ubicación</TableHead>
            <TableHead>Dirección</TableHead>
            <TableHead className="w-24">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clientes.map((cliente) => (
            <TableRow key={cliente.id}>
              <TableCell className="font-medium">{cliente.nombre}</TableCell>
              <TableCell>{cliente.telefono ?? "—"}</TableCell>
              <TableCell>{formatUbicacion(cliente)}</TableCell>
              <TableCell>{cliente.direccion ?? "—"}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      router.push(`/dashboard/clientes/${cliente.id}`)
                    }
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <DeleteDialog
                    title={`¿Eliminar a ${cliente.nombre}?`}
                    description="Se eliminará este cliente permanentemente."
                    onDelete={() => handleDelete(cliente.id)}
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
