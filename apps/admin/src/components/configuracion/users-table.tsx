"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { KeyRound, Loader2, MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { EnlaceAcceso, type EnlaceGenerado } from "./enlace-acceso";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InitialsAvatar } from "@/components/shared/initials-avatar";

interface UserData {
  id: string;
  name: string | null;
  apellido: string | null;
  email: string;
  role: string;
  createdAt: string;
}

/** Role pill style: ADMIN green, sector-admin sky, others neutral. */
const roleMeta = (role: string) => {
  switch (role) {
    case "ADMIN":
      return { label: "Administrador", className: "bg-secondary text-green-700" };
    case "STAFF":
      return { label: "Staff", className: "bg-muted text-muted-foreground" };
    case "PERSONAL_ADMIN":
      return { label: "Admin de sector", className: "bg-info/12 text-info" };
    case "PERSONAL":
      return { label: "Personal", className: "bg-muted text-muted-foreground" };
    default:
      return { label: role, className: "bg-muted text-muted-foreground" };
  }
};

export function UsersTable({ users }: { users: UserData[] }) {
  const router = useRouter();
  /** A quién se le está generando el enlace, para no repetir el clic. */
  const [generando, setGenerando] = useState<string | null>(null);
  const [enlace, setEnlace] = useState<
    (EnlaceGenerado & { correo: string }) | null
  >(null);

  async function generarEnlace(user: UserData) {
    setGenerando(user.id);
    try {
      const res = await fetch(`/api/users/${user.id}/enlace-acceso`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No pudimos generar el enlace");
      setEnlace({ ...data, correo: user.email });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No pudimos generar el enlace"
      );
    } finally {
      setGenerando(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead className="text-right">Fecha de registro</TableHead>
            <TableHead className="w-16 text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const meta = roleMeta(user.role);
            const name =
              [user.name, user.apellido].filter(Boolean).join(" ") || "—";
            return (
              <TableRow
                key={user.id}
                className="cursor-pointer"
                onClick={() => router.push(`/dashboard/configuracion/usuarios/${user.id}`)}
              >
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <InitialsAvatar name={name} size={36} />
                    <span className="font-bold text-foreground">{name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.email}
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${meta.className}`}
                  >
                    {meta.label}
                  </span>
                </TableCell>
                <TableCell className="text-right text-muted-foreground tabular-nums">
                  {new Date(user.createdAt).toLocaleDateString("es-EC")}
                </TableCell>
                <TableCell
                  className="text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={generando === user.id}
                          aria-label={`Acciones de ${name}`}
                        />
                      }
                    >
                      {generando === user.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MoreVertical className="h-4 w-4" />
                      )}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {/* Sirve igual para el que perdió su contraseña y para
                          el que nunca abrió su invitación: emitir uno nuevo
                          anula el anterior. */}
                      <DropdownMenuItem onClick={() => generarEnlace(user)}>
                        <KeyRound className="mr-2 h-4 w-4" />
                        Enviar enlace de contraseña
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={enlace !== null} onOpenChange={(v) => !v && setEnlace(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enlace para cambiar la contraseña</DialogTitle>
          </DialogHeader>
          {enlace ? (
            <div className="space-y-4">
              <EnlaceAcceso datos={enlace} correo={enlace.correo} />
              <div className="flex justify-end">
                <Button onClick={() => setEnlace(null)}>Listo</Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
