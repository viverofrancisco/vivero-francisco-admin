import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { InviteForm } from "@/components/configuracion/invite-form";

const roleBadge = (role: string) => {
  switch (role) {
    case "ADMIN":
      return { label: "Administrador", variant: "default" as const };
    case "STAFF":
      return { label: "Staff", variant: "secondary" as const };
    case "JARDINERO_ADMIN":
      return { label: "Jardinero Admin", variant: "outline" as const };
    case "JARDINERO":
      return { label: "Jardinero", variant: "outline" as const };
    default:
      return { label: role, variant: "outline" as const };
  }
};

export default async function ConfiguracionPage() {
  await requireAdmin();

  const [users, sectores] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.sector.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-gray-500">Administra usuarios y configuración del sistema</p>
      </div>

      <Tabs defaultValue="usuarios">
        <TabsList>
          <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="space-y-4">
          <div className="flex justify-end">
            <InviteForm sectores={sectores} />
          </div>

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
                {users.map((user: typeof users[number]) => {
                  const badge = roleBadge(user.role);
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.name ?? "—"}
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
