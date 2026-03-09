"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
}

interface SectorRow {
  id: string;
  nombre: string;
  _count: { clientes: number };
  admins: { user: AdminUser }[];
}

interface SectoresTableProps {
  sectores: SectorRow[];
}

export function SectoresTable({ sectores }: SectoresTableProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este sector?")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/sectores/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error);
      }
      toast.success("Sector eliminado");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="rounded-md border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sector</TableHead>
            <TableHead>Clientes</TableHead>
            <TableHead>Jardineros Admin</TableHead>
            <TableHead className="w-16">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sectores.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">
                <Link href={`/dashboard/sectores/${s.id}`} className="hover:underline">
                  {s.nombre}
                </Link>
              </TableCell>
              <TableCell>{s._count.clientes}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {s.admins.length > 0 ? (
                    s.admins.map((a) => (
                      <Badge key={a.user.id} variant="secondary">
                        {a.user.name ?? a.user.email}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-gray-400">—</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button variant="ghost" size="icon" className="h-8 w-8" />}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      render={<Link href={`/dashboard/sectores/${s.id}`} />}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={deleting === s.id}
                      onClick={() => handleDelete(s.id)}
                      variant="destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
