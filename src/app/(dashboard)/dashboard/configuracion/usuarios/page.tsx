import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { InviteForm } from "@/components/configuracion/invite-form";
import { UsersTable } from "@/components/configuracion/users-table";

export default async function UsuariosPage() {
  await requireAdmin();

  const [users, sectores] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        apellido: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.sector.findMany({
      where: { deletedAt: null },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <p className="text-gray-500">Administra los usuarios del sistema</p>
      </div>

      <div className="flex justify-end">
        <InviteForm sectores={sectores} />
      </div>

      <UsersTable
        users={users.map((u) => ({
          ...u,
          createdAt: u.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
