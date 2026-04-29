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
import { Badge } from "@/components/ui/badge";

interface UserData {
  id: string;
  name: string | null;
  apellido: string | null;
  email: string;
  role: string;
  createdAt: string;
}

const roleBadge = (role: string) => {
  switch (role) {
    case "ADMIN":
      return { label: "Administrador", variant: "default" as const };
    case "STAFF":
      return { label: "Staff", variant: "secondary" as const };
    case "PERSONAL_ADMIN":
      return { label: "Personal Admin", variant: "outline" as const };
    case "PERSONAL":
      return { label: "Personal", variant: "outline" as const };
    default:
      return { label: role, variant: "outline" as const };
  }
};

export function UsersTable({ users }: { users: UserData[] }) {
  const router = useRouter();

  return (
    <div className="rounded-md border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Fecha de registro</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const badge = roleBadge(user.role);
            return (
              <TableRow
                key={user.id}
                className="cursor-pointer"
                onClick={() => router.push(`/dashboard/configuracion/usuarios/${user.id}`)}
              >
                <TableCell className="font-medium">
                  {[user.name, user.apellido].filter(Boolean).join(" ") || "—"}
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </TableCell>
                <TableCell>
                  {new Date(user.createdAt).toLocaleDateString("es-EC")}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
