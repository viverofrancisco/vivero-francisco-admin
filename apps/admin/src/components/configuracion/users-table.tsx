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

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead className="text-right">Fecha de registro</TableHead>
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
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
